import { Injectable } from '@nestjs/common';
import { OrderRepository } from './repository/order.repository';
import { Order } from './entity/order.entity';

@Injectable()
export class OrderService {
  constructor(
    private orderRepository: OrderRepository,
  ) {}

  async createOrder(order: Partial<Order>): Promise<Order> {
    return this.orderRepository.create(order);
  }

  async getOrders(userId): Promise<Order[]> {
    return this.orderRepository.find(userId);
  }

  async getOrderById(id: number): Promise<Order> {
    return this.orderRepository.findOne(id);
  }

  async updateOrder(id: number, order: Partial<Order>): Promise<Order> {
    await this.orderRepository.update(id, order);
    return this.orderRepository.findOne(id);
  }

  async deleteOrder(id: number): Promise<void> {
    await this.orderRepository.delete(id);
  }
}