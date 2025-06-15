import { DataSource } from 'typeorm'; // Import DataSource
import { Product } from '../../product/src/entity/product.entity';
import { Inventory } from '../../inventory/src/entity/inventory.entity';
import * as fs from 'fs';
import * as path from 'path';

// Updated function to accept a DataSource instance
export async function seedProductsAndInventory(dataSource: DataSource) { 
  const productRepository = dataSource.getRepository(Product);
  const inventoryRepository = dataSource.getRepository(Inventory);

  // Load product data from JSON file
  const productsData = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, './data/products.json'), 'utf8')
  );

  // Insert products into the database
  const products = [];
  for (const productData of productsData) {
    const product = productRepository.create(productData);
    products.push(await productRepository.save(product)); // Save the product and keep the reference
  }

  console.log('Seed data for products added successfully');

  // Load inventory data from JSON file
  const inventoriesData = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, './data/inventories.json'), 'utf8')
  );

  // Insert inventory data into the database, referencing the product ids
  for (let i = 0; i < inventoriesData.length; i++) {
    const inventoryData = inventoriesData[i];
    // Ensure productId is correctly mapped if your inventories.json doesn't directly have it
    // or if it needs to be linked to the `products` array created above.
    // For simplicity, assuming inventories.json contains a productId that matches an existing product.
    // If inventories.json refers to products by an index or name, you'll need to adjust:
    // Example: inventoryData.productId = products[someIndexBasedOnInventoryData].id;
    console.log("inventoryData-->",inventoryData);
    const inventory = inventoryRepository.create(inventoryData);
    await inventoryRepository.save(inventory);
  }

  console.log('Seed data for inventories added successfully');
}