import { DataSource } from 'typeorm';

export async function initializeDatabase(dataSource: DataSource) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  await dataSource.synchronize(true); // Drops and re-creates tables
}