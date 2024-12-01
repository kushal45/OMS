import { EntityManager, Repository } from 'typeorm';
import { Order, OrderStatus } from '../entity/order.entity';
import { OrderInput } from '../interfaces/create-order.interface';
import { BaseRepository } from '../util/interfaces/base-repository.interface';
import { v4 as uuidv4 } from 'uuid';

export class OrderRepository implements BaseRepository<OrderRepository> {
  constructor(private readonly orderRepo: Repository<Order>) {}
  getRepository(entityManager: EntityManager): OrderRepository {
    return new OrderRepository(entityManager.getRepository(Order));
  }

  async findOne(id: number): Promise<Order> {
    return await this.orderRepo.findOne({
      where: { id },
    });
  }

  async create(order:OrderInput): Promise<Order> {
    const newOrder = order as unknown as Order;
    newOrder.orderStatus= OrderStatus.Pending;
    newOrder.aliasId= uuidv4();
    const createdOrder = this.orderRepo.create(newOrder);
    return await this.orderRepo.save(createdOrder);
  }

  async update(id: number, order: Partial<Order>): Promise<Order> {
    await this.orderRepo.update(id, order);
    return await this.findOne(id);
  }

  find(userId: number): Promise<Order[]> {
    return this.orderRepo.find({
      where: { user:{id:userId} },  
    });
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.orderRepo.delete(id);
    if (result.affected > 0) {
      return true;
    }
    return false;
  }
}
