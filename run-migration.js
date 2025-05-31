// Ensure .env.db is loaded. dotenv-cli in package.json should handle this.
const { Client } = require('pg'); // Still needed for a quick check or direct inserts if preferred
const path = require('path');
const AppDataSource = require('./apps/config/dataSource').default;

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

async function ensureMigrationsTableExists(dataSource) {
  logStep('Ensuring "migrations" table exists...');
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    // This is a standard TypeORM migrations table structure.
    // Using IF NOT EXISTS for safety.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "migrations" (
        "id" SERIAL NOT NULL PRIMARY KEY,
        "timestamp" BIGINT NOT NULL,
        "name" VARCHAR NOT NULL
      )
    `);
    logStep('"migrations" table check/creation complete.');
  } catch (err) {
    console.error('Error ensuring "migrations" table exists:', err);
    throw err;
  } finally {
    await queryRunner.release();
  }
}

async function prepareMigrationsWithDataSource(dataSource) {
  logStep('Preparing (marking as run) other migrations using DataSource');
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    let existingMigrationNames = new Set();
    try {
      const existingMigrationsResult = await queryRunner.query('SELECT name FROM migrations');
      if (Array.isArray(existingMigrationsResult)) {
        existingMigrationNames = new Set(existingMigrationsResult.map(r => r.name));
      }
    } catch (err) {
      console.warn('Migrations table does not exist yet, proceeding as if empty.');
    }

    // Dynamically read migration files from the migrations directory
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = path.resolve(__dirname, 'apps/database/migrations');
    const allMigrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.match(/^\d+-.*\.(ts|js)$/));

    // Only mark as run those migration files that are not already in the migrations table
    for (const fileName of allMigrationFiles) {
      if (!existingMigrationNames.has(fileName)) {
        // Extract timestamp and class name from file name
        const match = fileName.match(/^(\d+)-([^.]+)\.(ts|js)$/);
        if (!match) continue;
        const timestamp = match[1];
        const className = `${match[2]}${timestamp}`;
        logStep(`Inserting ${fileName} into migrations table`);
        await queryRunner.query(
          'INSERT INTO migrations (timestamp, name) VALUES ($1, $2)',
          [BigInt(timestamp), fileName]
        );
        console.log(` -> Marked ${fileName} as run.`);
      } else {
        console.log(` -> ${fileName} already marked as run.`);
      }
    }
  } finally {
    await queryRunner.release();
  }
}

async function printMigrationsTableWithDataSource(dataSource) {
  logStep('Reading migrations table using DataSource...');
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    const res = await queryRunner.query('SELECT * FROM migrations ORDER BY id');
    console.log('Current migrations table:', JSON.stringify(res));
  } catch (err) {
    console.error('Error reading migrations table:', err);
  }finally {
    await queryRunner.release();
  }
}

async function runTargetMigrationProgrammatically(dataSource, MigrationClass, mClassName, mFileName, mTimestamp) {
  logStep(`Programmatically processing target migration: ${mClassName}`);
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  logStep(`Connected QueryRunner for ${mClassName}.`);

  const checkQuery = `SELECT * FROM "migrations" WHERE "name" = $1 OR "name" = $2`;
  const existingRecords = await queryRunner.query(checkQuery, [mClassName, mFileName]);

  if (existingRecords.length > 0) {
    console.log(` -> Target migration ${mClassName} (or file ${mFileName}) is already marked as run.`);
    existingRecords.forEach(rec => console.log(`    Found existing record: ID=${rec.id}, Name=${rec.name}, Timestamp=${rec.timestamp}`));
    await queryRunner.release();
    logStep(`Released QueryRunner for ${mClassName}.`);
    return;
  }

  logStep(`Starting transaction for ${mClassName}.`);
  await queryRunner.startTransaction();
  try {
    logStep(`Executing up() method for ${mClassName}...`);
    const migrationInstance = new MigrationClass();
    await migrationInstance.up(queryRunner);
    logStep(`up() method for ${mClassName} completed.`);
    logStep(`Recording ${mClassName} (class name) in migrations table...`);
    await queryRunner.query(
      `INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)`,
      [BigInt(mTimestamp), mClassName]
    );
    logStep(`Committing transaction for ${mClassName}.`);
    await queryRunner.commitTransaction();
    console.log(` -> Successfully ran and recorded ${mClassName}.`);
  } catch (err) {
    console.error(`Error during migration ${mClassName}:`, err.message, err.stack);
    logStep(`Rolling back transaction for ${mClassName}.`);
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
    logStep(`Released QueryRunner for ${mClassName}.`);
  }
}

// Dynamically determine new migration files and run only those
async function runNewMigrations(dataSource) {
  logStep('Checking for new migration files to run...');
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    // Get all migration names already in the migrations table
    let existingMigrationNames = new Set();
    try {
      const existingMigrationsResult = await queryRunner.query('SELECT name FROM migrations');
      if (Array.isArray(existingMigrationsResult)) {
        existingMigrationNames = new Set(existingMigrationsResult.map(r => r.name));
      }
    } catch (err) {
      console.warn('Migrations table does not exist yet, proceeding as if empty.');
    }

    // Read all migration files in the migrations directory
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = path.resolve(__dirname, 'apps/database/migrations');
    const allMigrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.match(/^\d+-.*\.(ts|js)$/));

    // Find migration files not present in the migrations table
    const newMigrationFiles = allMigrationFiles.filter(f => !existingMigrationNames.has(f));
    if (newMigrationFiles.length === 0) {
      console.log('No new migration files to run.');
      return;
    }
    console.log('New migration files to run:', newMigrationFiles);

    for (const fileName of newMigrationFiles) {
      const match = fileName.match(/^(\d+)-([^.]+)\.(ts|js)$/);
      if (!match) continue;
      const timestamp = match[1];
      const className = `${match[2]}${timestamp}`;
      const migrationFilePath = path.resolve(migrationsDir, fileName);
      const migrationModule = require(migrationFilePath);
      const MigrationClass = migrationModule[className];
      if (!MigrationClass) {
        console.warn(`Could not find migration class ${className} in file ${fileName}`);
        continue;
      }
      logStep(`Running new migration: ${fileName}`);
      await runTargetMigrationProgrammatically(
        dataSource,
        MigrationClass,
        className,
        fileName,
        timestamp
      );
    }
  } finally {
    await queryRunner.release();
  }
}

async function main() {
  try {
    logStep('Checking required environment variables');
    const requiredVars = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME'];
    if (!checkEnvVars(requiredVars)) process.exit(1);
    requiredVars.forEach((v) => console.log(`${v}: ${process.env[v]}`));

    logStep('Initializing TypeORM DataSource...');
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
    logStep('TypeORM DataSource initialized.');

    await ensureMigrationsTableExists(AppDataSource);
    logStep('Migrations table after preparation step:');
    await printMigrationsTableWithDataSource(AppDataSource);

    // Dynamically run only new migration files
    await runNewMigrations(AppDataSource);

    logStep('Final migrations table state:');
    await printMigrationsTableWithDataSource(AppDataSource);

    console.log('\nMigration script finished successfully.');
    process.exit(0);

  } catch (error) {
    console.error('\n[Migration Script Error]', error.message || error, error.stack || '');
    process.exit(1);
  } finally {
    if (AppDataSource && AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logStep('AppDataSource destroyed.');
    }
  }
}

main();
