
module.exports = async () => {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5433,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres', // Connect to default db to drop test_db
  });

  await client.connect();
  // Terminate all connections to test_db before dropping
  await client.query(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'test_db' AND pid <> pg_backend_pid();
  `);
  // Drop test_db if it exists
  await client
    .query('DROP DATABASE IF EXISTS test_db')
    .catch(err => {
      // Ignore error if db does not exist
      if (err.code !== '3D000') throw err;
    });
  await client.end();
};