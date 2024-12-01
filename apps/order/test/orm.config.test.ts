import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { Order } from '../src/entity/order.entity';
import { Address } from '@lib/address/src/entity/address.entity';
import { Customer } from '@app/auth/src/entity/customer.entity';
import { OrderItems } from '../src/entity/orderItems.entity';
import { Product } from '@app/product/src/entity/product.entity';
import { CustomerAddress } from '@lib/address/src/entity/customerAdress.entity';

class TestOrmConfigService implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: 'localhost',
      port: 5433,
      username: 'postgres',
      password: 'postgres',
      database: 'test_db',
      entities: [Order, Address,CustomerAddress, Customer, OrderItems,Product],
      synchronize: true, // Set to true for testing, but false in production
    };
  }
}

export default TestOrmConfigService;