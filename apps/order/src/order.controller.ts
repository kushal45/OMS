import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from './entity/order.entity';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body() order: Partial<Order>): Promise<Order> {
    return this.orderService.createOrder(order);
  }

  @Get(':id')
  async getOrderById(@Param('id') id: number): Promise<Order> {
    return this.orderService.getOrderById(id);
  }

  @Get('user/:userId')
  async getOrders(@Param('userId') userId: number): Promise<Order[]> {
    return this.orderService.getOrders(userId);
  }

  @Put(':id')
  async updateOrder(@Param('id') id: number, @Body() order: Partial<Order>): Promise<Order> {
    return this.orderService.updateOrder(id, order);
  }

  @Delete(':id')
  async deleteOrder(@Param('id') id: number): Promise<void> {
    return this.orderService.deleteOrder(id);
  }
}