import { EntityManager, Repository } from 'typeorm';
import { OrderItems } from '../entity/orderItems.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderItemsInput } from '../interfaces/create-orderItems.interface';
import { BaseRepository } from '../util/interfaces/base-repository.interface';

export class OrderItemsRepository implements BaseRepository<OrderItemsRepository>{
  constructor(
    private readonly orderItemsRepo: Repository<OrderItems>,
  ) {}

  async findOne(id: number): Promise<OrderItems> {
    return await this.orderItemsRepo.findOne({
      where: { id },
    });
  }

  async createMany(orderItems: OrderItemsInput): Promise<number> {
    const orderItemsAggregated = orderItems.orderItems.map((orderItem) => {
        return {
            orderId: orderItems.orderId,
            productId: orderItem.productId,
            quantity: orderItem.quantity,
            price: orderItem.price,
        };
        });
    const result = await this.orderItemsRepo.createQueryBuilder()
      .insert()
      .into(OrderItems)
      .values(orderItemsAggregated)
      .execute();
    return result.identifiers.length;
  }

  async update(id: number, orderItem: Partial<OrderItems>): Promise<OrderItems> {
    await this.orderItemsRepo.update(id, orderItem);
    return await this.findOne(id);
  }

  async findAll(): Promise<OrderItems[]> {
    return this.orderItemsRepo.find();
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.orderItemsRepo.delete(id);
    return result.affected > 0;
  }

  getRepository(entityManager: EntityManager): OrderItemsRepository {
    return new OrderItemsRepository(entityManager.getRepository(OrderItems));
  }
}