import { EntityManager, Repository } from 'typeorm';
import { Order } from '../entity/order.entity';
import { OrderInput } from '../interfaces/create-order.interface';
import { BaseRepository } from '../util/interfaces/base-repository.interface';

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

  async create(order:OrderInput): Promise<Exclude<Order,"id">> {
    const newOrder = this.orderRepo.create(order);
    return this.orderRepo.save(newOrder);
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
