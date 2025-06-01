import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Cart, CartStatus } from '../entity/cart.entity';

// Define interfaces for input/output if they become complex
export interface CreateCartInput {
  userId: string;
  status?: CartStatus;
  // other fields like subTotal, grandTotal can be calculated or set default
}

export interface UpdateCartInput {
  status?: CartStatus;
  subTotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  grandTotal?: number;
  totalItems?: number;
  expiresAt?: Date | null;
}

@Injectable()
export class CartDataService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepo: Repository<Cart>,
  ) {}

  public getRepository(entityManager: EntityManager): CartDataService {
    return new CartDataService(entityManager.getRepository(Cart));
  }

  async findById(id: string, entityManager?: EntityManager): Promise<Cart | null> {
    const repository = entityManager ? entityManager.getRepository(Cart) : this.cartRepo;
    return repository.findOne({ where: { id }, relations: ['items'] });
  }

  async findByUserId(userId: string, entityManager?: EntityManager): Promise<Cart | null> {
    const repository = entityManager ? entityManager.getRepository(Cart) : this.cartRepo;
    return repository.findOne({ where: { userId, status: CartStatus.ACTIVE }, relations: ['items'] });
  }

  async create(input: CreateCartInput, entityManager?: EntityManager): Promise<Cart> {
    const repository = entityManager ? entityManager.getRepository(Cart) : this.cartRepo;
    const newCart = repository.create({
      userId: input.userId,
      status: input.status || CartStatus.ACTIVE,
      // Initialize totals to 0 or calculate if items are added simultaneously
      subTotal: 0,
      grandTotal: 0,
      totalItems: 0,
    });
    return repository.save(newCart);
  }

  async update(id: string, input: UpdateCartInput, entityManager?: EntityManager): Promise<Cart | null> {
    const repository = entityManager ? entityManager.getRepository(Cart) : this.cartRepo;
    await repository.update(id, input);
    return this.findById(id, entityManager); // Fetch the updated cart with relations
  }

  async delete(id: string, entityManager?: EntityManager): Promise<boolean> {
    const repository = entityManager ? entityManager.getRepository(Cart) : this.cartRepo;
    const result = await repository.delete(id);
    return result.affected > 0;
  }

  // Example: Find abandoned carts older than a certain date
  async findAbandonedCarts(olderThan: Date, entityManager?: EntityManager): Promise<Cart[]> {
    const repository = entityManager ? entityManager.getRepository(Cart) : this.cartRepo;
    return repository.createQueryBuilder('cart')
      .where('cart.status = :status', { status: CartStatus.ABANDONED })
      .andWhere('cart.updatedAt < :olderThan', { olderThan })
      .getMany();
  }
}