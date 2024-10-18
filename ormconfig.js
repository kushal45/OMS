const { DataSource } = require('typeorm');

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ['dist/**/*.entity.js'],  // path to compiled entities
  migrations: ['dist/database/migrations/*.js'],  // path to compiled migration files
  cli: {
    migrationsDir: 'apps/database/migrations',
  },
  synchronize: false,  // should be false in production
});

module.exports = dataSource;