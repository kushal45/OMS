import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Customer } from '../auth/src/entity/customer.entity';
import { Order } from '../order/src/entity/order.entity';
import { OrderItems } from '../order/src/entity/orderItems.entity';
import { Product } from '../product/src/entity/product.entity';
import { Inventory } from '../inventory/src/entity/inventory.entity';
import { Cart } from '../cart/src/entity/cart.entity';
import { CartItem } from '../cart/src/entity/cart-item.entity';
import { OutboxEvent } from '../cart/src/entity/outbox-event.entity';
import { Address } from '../../libs/address/src/entity/address.entity';



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
  entities: [Address,Customer,Order, OrderItems, Product, Inventory, Cart, CartItem, OutboxEvent],
  migrations: process.env.NODE_ENV === 'production' ?
    [path.join(process.cwd(), 'dist', 'apps', 'database', 'migrations', '*.js')] :
    [path.join(process.cwd(), 'apps', 'database', 'migrations', '*.ts')],
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
};

const dataSource = new DataSource(dataSourceOptions);

console.log(dataSource);

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
