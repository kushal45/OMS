// Ensure .env.db is loaded. dotenv-cli in package.json should handle this.
const { Client } = require('pg'); // Still needed for a quick check or direct inserts if preferred
const path = require('path');
const AppDataSource = require('./apps/config/dataSource').default;

const targetCartsMigrationFileNameOnly = '20250531120000-CreateCartsTable.ts';
const targetCartsMigrationClassName = 'CreateCartsTable20250531120000';
const targetCartsMigrationTimestamp = '20250531120000';
const targetCartsMigrationFilePath = path.resolve(__dirname, 'apps/database/migrations', targetCartsMigrationFileNameOnly);
const { [targetCartsMigrationClassName]: TargetCartsMigrationClass } = require(targetCartsMigrationFilePath);

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

const migrationsToPrepare = [
  { timestamp: '20250524221000', name: 'CreateCustomerTable20250524221000', fileName: '20250524221000-CreateCustomerTable.ts' },
  { timestamp: '20250524221001', name: 'CreateAddressTable20250524221001', fileName: '20250524221001-CreateAddressTable.ts' },
  { timestamp: '20250524221002', name: 'CreateProductTable20250524221002', fileName: '20250524221002-CreateProductTable.ts' },
  { timestamp: '20250524221003', name: 'CreateCustomerAddressTable20250524221003', fileName: '20250524221003-CreateCustomerAddressTable.ts' },
  { timestamp: '20250524221004', name: 'CreateInventoryTable20250524221004', fileName: '20250524221004-CreateInventoryTable.ts' },
  { timestamp: '20250524221005', name: 'CreateOrderTable20250524221005', fileName: '20250524221005-CreateOrderTable.ts' },
  { timestamp: '20250524221006', name: 'CreateOrderItemsTable20250524221006', fileName: '20250524221006-CreateOrderItemsTable.ts' },
];

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
      // TypeORM's query returns an array of objects, not { rows: [...] }
      if (Array.isArray(existingMigrationsResult)) {
        existingMigrationNames = new Set(existingMigrationsResult.map(r => r.name));
      }
    } catch (err) {
      // Table does not exist yet, so no migrations are marked as run
      console.warn('Migrations table does not exist yet, proceeding as if empty.');
    }

    for (const migration of migrationsToPrepare) {
      if (!existingMigrationNames.has(migration.name) && !existingMigrationNames.has(migration.fileName)) {
        logStep(`Inserting ${migration.name} (class name) into migrations table`);
        const timestampBigInt = BigInt(migration.timestamp);
        await queryRunner.query(
          'INSERT INTO migrations (timestamp, name) VALUES ($1, $2)',
          [timestampBigInt, migration.name]
        );
        console.log(` -> Marked ${migration.name} as run.`);
      } else if (existingMigrationNames.has(migration.name)) {
        console.log(` -> ${migration.name} (class name) already marked as run.`);
      } else if (existingMigrationNames.has(migration.fileName)) {
        console.log(` -> ${migration.fileName} (file name) already marked as run, implies ${migration.name} is covered.`);
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
    console.log('Current migrations table:', JSON.stringify(res.rows, null, 2));
  } finally {
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
    await prepareMigrationsWithDataSource(AppDataSource);
    logStep('Migrations table after preparation step:');
    await printMigrationsTableWithDataSource(AppDataSource);

    if (!TargetCartsMigrationClass) {
        throw new Error(`Failed to load target migration class: ${targetCartsMigrationClassName} from ${targetCartsMigrationFilePath}`);
    }

    await runTargetMigrationProgrammatically(
      AppDataSource,
      TargetCartsMigrationClass,
      targetCartsMigrationClassName,
      targetCartsMigrationFileNameOnly,
      targetCartsMigrationTimestamp
    );

    logStep('Target migration process completed.');
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
