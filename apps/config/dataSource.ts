import { DataSource } from 'typeorm';
import { join } from 'path';

const credObj={
    username: 'postgres',
    password: 'postgres',
    host: 'localhost',
    port:5433,
    database:'oms',
}
console.log(join(__dirname, '/../', 'database/migrations/*{.ts,.js}'));
export const connectionSource = new DataSource({
  type: 'postgres',
  host: credObj.host,
  port: credObj.port,
  username: credObj.username,
  password: credObj.password,
  database: credObj.database,
  logging: true,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [join(__dirname, '/../', 'database/migrations/*{.ts,.js}')],
  synchronize: false,
  migrationsTableName: 'typeorm_migrations',
  migrationsRun: false,
});