import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables specifically for database migrations
// from .env.db at the project root.
dotenv.config({ path: path.resolve(process.cwd(), '.env.db') });

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT, 10) || 5433,
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'postgres',
  entities: process.env.NODE_ENV === 'production' ? [
    path.resolve(__dirname, '../**/src/entity/*.entity.js'),
    path.resolve(__dirname, '../../libs/**/src/entity/*.entity.js')
  ] : [
    '../**/entity/*.entity.ts',
    '../**/libs/**/entity/*.entity.ts'
  ],
  migrations: process.env.NODE_ENV === 'production' ?
    [path.resolve(__dirname, '../database/migrations/*.js')] :
    [path.resolve(__dirname, '../database/migrations/*.ts')],
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
};

const dataSource = new DataSource(dataSourceOptions);

async function initializeAndMigrate() {
  try {
    console.log('DataSource initialized with options:', dataSourceOptions);
    await dataSource.initialize();
    await dataSource.runMigrations({ transaction: 'all' });
    console.log('DataSource has been initialized and migrations have been run successfully.');
  } catch (error) {
    console.error('Error during DataSource initialization:', error);
  }
}

initializeAndMigrate().then(() => {
  console.log('DataSource initialization and migration process completed.');
}).catch((error) => {
  console.error('Error during DataSource initialization and migration process:', error);
});

export default dataSource;
