import { createConnection, DataSourceOptions } from 'typeorm';
import { seedProductsAndInventory } from './seed-product-inventory-data';
import { Product } from '../../product/src/entity/product.entity';
import { Inventory } from '../../inventory/src/entity/inventory.entity';


async function runSeed() {
    const connectionOptions: DataSourceOptions = {
        type: 'postgres', // Change this depending on your database type
        host: 'localhost',
        port: 5433,
        username: 'postgres', // Replace with your username
        password: 'postgres', // Replace with your password
        database: 'oms', // Replace with your database name
        entities: [Product, Inventory], // Include the necessary entities here
        synchronize: false, // Don't synchronize in production, use migrations
        logging: true, // Set to false in production
      };
  const connection = await createConnection(connectionOptions);
  await seedProductsAndInventory();
  await connection.close();
  console.log('Seeding completed successfully');
}

runSeed().catch((error) => console.error('Seeding failed', error));