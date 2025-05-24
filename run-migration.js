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
    // Ensure environment variables are used from the Docker environment
    // These will be set in the docker-compose.yml for the migration service
    console.log(`DB_HOST: ${process.env.DATABASE_HOST}`);
    console.log(`DB_PORT: ${process.env.DATABASE_PORT}`);
    console.log(`DB_USERNAME: ${process.env.DATABASE_USER}`);
    console.log(`DB_PASSWORD: ${process.env.DATABASE_PASSWORD}`);
    console.log(`DB_NAME: ${process.env.DATABASE_NAME}`);

    if (!process.env.DATABASE_HOST || !process.env.DATABASE_PORT || !process.env.DATABASE_USER || !process.env.DATABASE_PASSWORD || !process.env.DATABASE_NAME) {
      console.error('Database environment variables are not set. Please check your docker-compose.yml or environment setup.');
      process.exit(1);
    }

    // The migration:run script in package.json uses apps/config/dataSource.ts,
    // which should already be configured to use these environment variables.
    await runCommand('npm run migration:run');
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('An error occurred during migrations:', error);
    process.exit(1); // Exit with error code if migrations fail
  }
}

runMigrations();
