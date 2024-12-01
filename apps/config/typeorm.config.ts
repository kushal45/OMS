import { Customer } from '@app/auth/src/entity/customer.entity';
import { Address } from '@lib/address/src/entity/address.entity';
import { CustomerAddress } from '@lib/address/src/entity/customerAdress.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';


export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (configService: ConfigService): Promise<TypeOrmModuleOptions> => {
    console.log("DB_USERNAME",configService.get<string>('DB_USERNAME'));
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
      entities: [Customer,Address,CustomerAddress],
      migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
      extra: {
        charset: 'utf8mb4_unicode_ci',
      },
      synchronize: false,
      logging: true,
    };
  },
};