import dataSource from '../../config/dataSource'; // Import the configured dataSource
import { seedProductsAndInventory } from './seed-product-inventory-data';
// Import other seeder functions here as you create them
// e.g., import { seedUsers } from './seed-users-data';

async function runAllSeeders() {
    if (!dataSource.isInitialized) {
        console.log('Initializing data source for seeding...');
        await dataSource.initialize();
        console.log('Data source initialized.');
    } else {
        console.log('Data source already initialized.');
    }

    try {
        console.log('Starting seeding process...');

        // Run seeders in the desired order
        // Pass the dataSource or a queryRunner/entityManager if needed by the seeder functions
        await seedProductsAndInventory(dataSource);
        // await seedUsers(dataSource); // Example of another seeder

        console.log('Seeding completed successfully.');
    } catch (error) {
        console.error('Seeding failed:', error);
        // Optionally, rethrow the error if you want the script to exit with a non-zero code
        // throw error; 
    } finally {
        if (dataSource.isInitialized) {
            console.log('Closing data source connection...');
            await dataSource.destroy(); // Use destroy() to close the connection
            console.log('Data source connection closed.');
        }
    }
}

runAllSeeders().catch((error) => {
    console.error('Unhandled error during seeding process:', error);
    process.exit(1); // Exit with error code
});