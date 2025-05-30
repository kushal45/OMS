const { spawn } = require('child_process');

function logStep(message) {
  console.log(`\n=== ${message} ===`);
}

function checkEnvVars(requiredVars) {
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

function runCommandRealtime(command, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit', shell: true });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}`));
      } else {
        resolve();
      }
    });
    proc.on('error', (err) => reject(err));
  });
}

async function runMigrations() {
  try {
    logStep('Checking required environment variables');
    const requiredVars = [
      'DATABASE_HOST',
      'DATABASE_PORT',
      'DATABASE_USER',
      'DATABASE_PASSWORD',
      'DATABASE_NAME',
    ];
    if (!checkEnvVars(requiredVars)) {
      process.exit(1);
    }
    requiredVars.forEach((v) => console.log(`${v}: ${process.env[v]}`));

    logStep('Running database migrations');
    await runCommandRealtime('npm', ['run', 'migration:run']);
    logStep('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n[Migration Error]', error.message || error);
    process.exit(1);
  }
}

runMigrations();
