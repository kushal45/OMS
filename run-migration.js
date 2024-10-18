const { exec } = require('child_process');
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return reject(error);
      }
      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);
      resolve(stdout);
    });
  });
}

async function runMigrations() {
  try {
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5433';
    process.env.DB_USERNAME = 'postgres';
    process.env.DB_PASSWORD = 'postgres';
    process.env.DB_NAME = 'oms';

    // Log the environment variables to verify they are set correctly
    console.log(`DB_HOST: ${process.env.DB_HOST}`);
    console.log(`DB_PORT: ${process.env.DB_PORT}`);
    console.log(`DB_USERNAME: ${process.env.DB_USERNAME}`);
    console.log(`DB_PASSWORD: ${process.env.DB_PASSWORD}`);
    console.log(`DB_NAME: ${process.env.DB_NAME}`);
    await runCommand('npm run migration:run');
    console.log('Both commands completed successfully');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

runMigrations();
