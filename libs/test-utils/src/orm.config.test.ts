import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';

// Import all entities
import { Order } from '@app/order/src/entity/order.entity';
import { OrderItems } from '@app/order/src/entity/orderItems.entity';
import { Customer } from '@app/auth/src/entity/customer.entity';
import { Product } from '@app/product/src/entity/product.entity';
import { Inventory } from '@app/inventory/src/entity/inventory.entity';
import { Address } from '@lib/address/entity/address.entity';
import { CustomerAddress } from '@lib/address/entity/customerAdress.entity'; // Note: filename is customerAdress.entity.ts

@Injectable()
class GlobalTestOrmConfigService implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: process.env.TEST_DB_HOST || 'localhost', // Allow overriding for CI/different environments
      port: parseInt(process.env.TEST_DB_PORT, 10) || 5433,
      username: process.env.TEST_DB_USERNAME || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres',
      database: process.env.TEST_DB_NAME || 'test_db',
      entities: [
        Order,
        OrderItems,
        Customer,
        Product,
        Inventory,
        Address,
        CustomerAddress,
      ],
      synchronize: true, // Key for testing: drops and recreates schema based on entities.
      // dropSchema: true, // Ensures a clean slate, used with synchronize:true
      logging: process.env.TEST_DB_LOGGING === 'true' ? true : false, // Optional: enable logging for debugging
    };
  }
}

export default GlobalTestOrmConfigService;