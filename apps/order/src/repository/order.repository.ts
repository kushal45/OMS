import { EntityManager, In, Repository } from 'typeorm';
import { Order, OrderStatus } from '../entity/order.entity';
import { OrderInput } from '../interfaces/create-order.interface';
import { BaseRepository } from '../util/interfaces/base-repository.interface';
import { v4 as uuidv4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderQueryInterface } from '../interfaces/order-query-interface';

export class OrderRepository implements BaseRepository<OrderRepository> {
  
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>) {}
  getRepository(entityManager: EntityManager): OrderRepository {
    return new OrderRepository(entityManager.getRepository(Order));
  }

  async findOne(option:Partial<OrderQueryInterface.fetchOrderInput>): Promise<Order> {
    return await this.orderRepo.findOne({
      where: option,
      relations: ['address', 'user'], // Explicitly load relations
    });
  }

  async create(orderInput:OrderInput): Promise<Order> {
    const newOrderEntity = new Order();
    newOrderEntity.userId = orderInput.userId;
    newOrderEntity.addressId = orderInput.addressId;
    newOrderEntity.totalAmount = orderInput.totalAmount;
    newOrderEntity.deliveryCharge = orderInput.deliveryCharge;
    newOrderEntity.tax = orderInput.tax;
    newOrderEntity.orderStatus = OrderStatus.Pending;
    newOrderEntity.aliasId = uuidv4();

    // TypeORM's create method can take a partial object and merge it into a new entity instance
    // or we can pass the fully constructed entity.
    // Passing the constructed entity is more explicit here.
    const createdOrder = this.orderRepo.create(newOrderEntity);
    return await this.orderRepo.save(createdOrder);
  }

  async update(aliasId: string, order: OrderQueryInterface.UpdateOrderInput): Promise<Order> {
    await this.orderRepo.update({
      aliasId,
    }, order);
    return await this.findOne({
      aliasId
    });
  }

  find(userId: number): Promise<Order[]> {
    return this.orderRepo.find({
      where: { userId: userId }, // Simpler where clause for direct column
      relations: ['address', 'user'], // Explicitly load relations
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
