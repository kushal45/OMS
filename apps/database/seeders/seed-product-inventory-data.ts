import { getRepository } from 'typeorm';
import { Product } from '../../product/src/entity/product.entity';
import { Inventory } from '../../inventory/src/entity/inventory.entity';
import * as fs from 'fs';
import * as path from 'path';

export async function seedProductsAndInventory() {
  const productRepository = getRepository(Product);
  const inventoryRepository = getRepository(Inventory);

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
    console.log("inventoryData-->",inventoryData);
    const inventory = inventoryRepository.create(inventoryData);
    await inventoryRepository.save(inventory);
  }

  console.log('Seed data for inventories added successfully');
}