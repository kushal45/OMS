// create-migrations-table.ts
// This script creates the migrations table and marks all existing migrations as applied, so TypeORM will not re-run them.
// Usage: npm run prepare:migrations

import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: process.env.ENV_PATH || '.env.db' });

function logStep(message: string) {
  console.log(`\n=== ${message} ===`);
}

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  try {
    logStep('Checking required environment variables');
    const requiredVars = [
      'DATABASE_HOST',
      'DATABASE_PORT',
      'DATABASE_USER',
      'DATABASE_PASSWORD',
      'DATABASE_NAME',
    ];
    requiredVars.forEach(getEnvOrThrow);

    logStep('Connecting to database');
    let dataSource: DataSource;
    try {
      const dsModule = require(path.resolve(__dirname, 'apps/config/dataSource'));
      dataSource = dsModule.default || dsModule;
    } catch (e) {
      try {
        const dsModule = require(path.resolve(process.cwd(), 'apps/config/dataSource'));
        dataSource = dsModule.default || dsModule;
      } catch (e2) {
        throw new Error('Cannot find module "./apps/config/dataSource". Please check the path.');
      }
    }
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
    const queryRunner = dataSource.createQueryRunner();

    logStep('Ensuring migrations table exists');
    const migrationsTableExists = await queryRunner.hasTable('migrations');
    if (!migrationsTableExists) {
      await queryRunner.query(`CREATE TABLE "migrations" (
        "id" SERIAL PRIMARY KEY,
        "timestamp" bigint NOT NULL,
        "name" varchar NOT NULL
      )`);
      console.log('Created migrations table.');
    } else {
      console.log('Migrations table already exists.');
    }

    // Print database connection info for troubleshooting
    console.log('DB HOST:', process.env.DATABASE_HOST);
    console.log('DB PORT:', process.env.DATABASE_PORT);
    console.log('DB USER:', process.env.DATABASE_USER);
    console.log('DB NAME:', process.env.DATABASE_NAME);

    // Dynamically read migration files and exclude new ones
    logStep('Reading migration files');
    const migrationsDir = path.resolve(__dirname, 'apps/database/migrations');
    const allMigrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.match(/^\d+-.*\.(ts|js)$/));

    // Exclude only the new migration(s) you want to run
    const excludedMigrations = [
      // Add the new migration(s) you want to run here, e.g.:
      '20250531220000-CreateCartTable.ts', // <-- adjust as needed
      '20250531220000-CreateCartTable.js', // <-- if running compiled JS
    ];

    // Build migrationNames array, inserting both .ts and .js for each migration if both exist
    const migrationNames = [];
    allMigrationFiles
      .filter(f => !excludedMigrations.includes(f))
      .forEach(f => {
        const match = f.match(/^(\d+)-/);
        if (!match) throw new Error(`Migration file ${f} does not start with a timestamp`);
        migrationNames.push({ timestamp: Number(match[1]), name: f });
        // Also add .js if .ts exists and vice versa, to cover both
        if (f.endsWith('.ts')) {
          const jsName = f.replace(/\.ts$/, '.js');
          if (fs.existsSync(path.join(migrationsDir, jsName))) {
            migrationNames.push({ timestamp: Number(match[1]), name: jsName });
          }
        } else if (f.endsWith('.js')) {
          const tsName = f.replace(/\.js$/, '.ts');
          if (fs.existsSync(path.join(migrationsDir, tsName))) {
            migrationNames.push({ timestamp: Number(match[1]), name: tsName });
          }
        }
      });

    // Debug: print the migration names being marked as applied
    console.log('Migration files being marked as applied:');
    migrationNames.forEach(m => console.log(m.name));

    logStep('Marking existing migrations as applied');
    for (const { timestamp, name } of migrationNames) {
      const exists = await queryRunner.query(
        `SELECT 1 FROM "migrations" WHERE "name" = $1`, [name]
      );
      if (exists.length === 0) {
        await queryRunner.query(
          `INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)`,
          [timestamp, name]
        );
        console.log(`Marked migration as applied: ${name}`);
      } else {
        console.log(`Migration already marked as applied: ${name}`);
      }
    }

    await queryRunner.release();
    await dataSource.destroy();
    logStep('Migrations table is now correct. You can now safely run: npm run migration:run');
    process.exit(0);
  } catch (error: any) {
    console.error('\n[Migration Error]', error.message || error);
    process.exit(1);
  }
}

main();
