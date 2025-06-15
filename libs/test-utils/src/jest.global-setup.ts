const { Client } = require('pg');

module.exports = async () => {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5433,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres', // Connect to default db to create test_db
  });

  await client.connect();
  // Create test_db if it doesn't exist
  await client.query(`CREATE DATABASE test_db WITH OWNER = '${process.env.DB_USERNAME || 'postgres'}'`)
    .catch(err => {
      if (err.code !== '42P04') { // 42P04 = duplicate_database
        throw err;
      }
    });
  await client.end();
};