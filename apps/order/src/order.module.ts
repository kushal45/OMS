import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { ConfigModule } from '@nestjs/config';
import * as path from "path";

@Module({
  imports: [ConfigModule.forRoot({
    envFilePath: path.resolve("apps/order/.env"), // Loads the .env file specific to this microservice
    isGlobal: true,       // Makes the environment variables available globally
})],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
