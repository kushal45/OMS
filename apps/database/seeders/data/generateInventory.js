const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker');

// Load the products data
const productsData = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'products.json'), 'utf8')
);

// Function to generate a single inventory entry
function generateInventory(productId) {
  return {
    productId: productId,
    quantity: faker.number.int({ min: 50, max: 200 }), // Random quantity between 50 and 200
    reservedQuantity: 0, // Random reserved quantity between 0 and 50
    location: faker.helpers.arrayElement(["Warehouse A", "Warehouse B", "Warehouse C"]),
    status: faker.helpers.arrayElement(["in-stock"])
  };
}

// Generate inventory entries based on the products data
const inventories = productsData.map((product, index) => generateInventory(index + 1));

// Save the generated inventory data to inventories.json
const filePath = path.resolve(__dirname, 'inventories.json');
fs.writeFileSync(filePath, JSON.stringify(inventories, null, 2));

console.log('Generated inventory data for each product and saved to data/inventories.json');
