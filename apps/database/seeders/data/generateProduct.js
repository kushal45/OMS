const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker');

// Function to generate a single product
function generateProduct(index) {
  return {
    name: `Product ${index + 1}`,
    description: faker.commerce.productDescription(),
    sku: `SKU${(index + 1).toString().padStart(3, '0')}`, // Ensures SKU format is like SKU001, SKU002, etc.
    price: parseFloat(faker.commerce.price(10, 1000, 2)), // Price between 10 and 1000 with 2 decimal places
    attributes: JSON.stringify({
      color: faker.color.human(),
      size: faker.helpers.arrayElement(['S', 'M', 'L', 'XL'])
    })
  };
}

// Generate 47 products
const products = Array.from({ length: 50 }, (_, index) => generateProduct(index));

// Save the generated data to products.json
const filePath = path.resolve(__dirname, 'products.json');
fs.writeFileSync(filePath, JSON.stringify(products, null, 2));

console.log('Generated 50 unique products and saved to data/products.json');