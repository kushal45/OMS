import { Customer } from '@app/auth/src/entity/customer.entity';
import { Inventory } from '@app/inventory/src/entity/inventory.entity';
import { Order } from '@app/order/src/entity/order.entity';
import { OrderItems } from '@app/order/src/entity/orderItems.entity';
import { Product } from '@app/product/src/entity/product.entity';
import { Address } from '@lib/address/entity/address.entity';
import { CustomerAddress } from '@lib/address/entity/customerAdress.entity';
import { Cart } from '@app/cart/src/entity/cart.entity';
import { CartItem } from '@app/cart/src/entity/cart-item.entity';
import { OutboxEvent } from '@app/cart/src/entity/outbox-event.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';


export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (configService: ConfigService): Promise<TypeOrmModuleOptions> => {
    console.log("DB_USERNAME",configService);
    console.log("DB_HOST",configService.get<string>('DB_HOST'));
    console.log("DB_PORT",configService.get<string>('DB_PORT'));
    console.log("DB_PASSWORD",configService.get<string>('DB_PASSWORD'));
    return {
      type: 'postgres',
      host: configService.get<string>('DB_HOST'),
      port: configService.get<number>('DB_PORT'),
      username: configService.get<string>('DB_USERNAME'),
      password: configService.get<string>('DB_PASSWORD'),
      database: configService.get<string>('DB_NAME'),
      entities: [
        Customer,
        Address,
        CustomerAddress,
        Order,
        OrderItems,
        Product,
        Inventory,
        Cart,
        CartItem,
        OutboxEvent,
      ],
      migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
      extra: {
        charset: 'utf8mb4_unicode_ci',
      },
      synchronize: false,
      logging: true,
    };
  },
};