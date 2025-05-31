#!/usr/bin/env node
// deep-clean-migrations.js
// This script will drop the migrations table and its sequence from all schemas in a Postgres database.
// Usage: npm run deep-clean-migrations (after adding the script to package.json)

const { Client } = require('pg');

async function deepCleanMigrations() {
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });
  await client.connect();
  console.log('Connected to database for deep clean.');

  // Find and drop all migrations tables in all schemas
  const tablesRes = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_name = 'migrations'
  `);
  for (const row of tablesRes.rows) {
    const fullTable = `"${row.table_schema}"."${row.table_name}"`;
    console.log(`Dropping table: ${fullTable}`);
    await client.query(`DROP TABLE IF EXISTS ${fullTable} CASCADE;`);
  }

  // Find and drop all migrations_id_seq sequences in all schemas
  const seqRes = await client.query(`
    SELECT n.nspname as sequence_schema, c.relname as sequence_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S' AND c.relname = 'migrations_id_seq'
  `);
  for (const row of seqRes.rows) {
    const fullSeq = `"${row.sequence_schema}"."${row.sequence_name}"`;
    console.log(`Dropping sequence: ${fullSeq}`);
    await client.query(`DROP SEQUENCE IF EXISTS ${fullSeq} CASCADE;`);
  }

  await client.end();
  console.log('Deep clean of migrations table and sequence complete.');
}

deepCleanMigrations().catch(err => {
  console.error('Error during deep clean:', err);
  process.exit(1);
});
