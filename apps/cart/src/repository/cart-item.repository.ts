import { EntityManager, Repository, UpdateResult } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CartItem } from '../entity/cart-item.entity';

export interface CreateCartItemInput {
  cartId: number;
  productId: number;
  quantity: number;
  price: number; // Price per unit at the time of adding
}

export interface UpdateCartItemInput {
  quantity?: number;
  price?: number; // If price can be updated in cart
  // Potentially other fields like metadata if added to entity
}


export class CartItemRepository {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartItemRepo: Repository<CartItem>,
  ) {}

  public getRepository(entityManager: EntityManager): CartItemRepository {
    return new CartItemRepository(entityManager.getRepository(CartItem));
  }

  async findById(id: number, entityManager?: EntityManager): Promise<CartItem | null> {
    const repository = entityManager ? entityManager.getRepository(CartItem) : this.cartItemRepo;
    return repository.findOneBy({ id });
  }

  async findByCartId(cartId: number, entityManager?: EntityManager): Promise<CartItem[]> {
    const repository = entityManager ? entityManager.getRepository(CartItem) : this.cartItemRepo;
    return repository.find({ where: { cartId } });
  }

  async findByCartIdAndProductId(cartId: number, productId: number, entityManager?: EntityManager): Promise<CartItem | null> {
    const repository = entityManager ? entityManager.getRepository(CartItem) : this.cartItemRepo;
    return this.findOne({ cartId, productId });
  }

  async create(input: CreateCartItemInput, entityManager?: EntityManager): Promise<CartItem> {
    const repository = entityManager ? entityManager.getRepository(CartItem) : this.cartItemRepo;
    const lineTotal = input.quantity * input.price;
    const newCartItem = repository.create({ ...input, lineTotal });
    return repository.save(newCartItem);
  }

  async createMultiple(inputs: CreateCartItemInput[], entityManager?: EntityManager): Promise<CartItem[]> {
    const repository = entityManager ? entityManager.getRepository(CartItem) : this.cartItemRepo;
    const itemsToSave = inputs.map(input => {
      const lineTotal = input.quantity * input.price;
      return repository.create({ ...input, lineTotal });
    });
    return repository.save(itemsToSave);
  }


  async update(id: number, input: UpdateCartItemInput, entityManager?: EntityManager): Promise<CartItem | null> {
    const repository = entityManager ? entityManager.getRepository(CartItem) : this.cartItemRepo;
    const itemToUpdate = await this.findById(id, entityManager);
    if (!itemToUpdate) return null;

    // Recalculate lineTotal if quantity or price changes
    const newQuantity = input.quantity !== undefined ? input.quantity : itemToUpdate.quantity;
    const newPrice = input.price !== undefined ? input.price : itemToUpdate.price;
    const newLineTotal = newQuantity * newPrice;

    await repository.update(id, { ...input, lineTotal: newLineTotal });
    return this.findById(id, entityManager);
  }

  async updateQuantity(id: number, quantity: number, entityManager?: EntityManager): Promise<CartItem | null> {
    const repository = entityManager ? entityManager.getRepository(CartItem) : this.cartItemRepo;
    const item = await repository.findOneBy({ id });
    if (item) {
      item.quantity = quantity;
      item.lineTotal = item.price * quantity;
      return repository.save(item);
    }
    return null;
  }


  async delete(id: string, entityManager?: EntityManager): Promise<boolean> {
    const repository = entityManager ? entityManager.getRepository(CartItem) : this.cartItemRepo;
    const result = await repository.delete(id);
    return result.affected > 0;
  }

  async deleteByCartId(cartId: number, entityManager?: EntityManager): Promise<number> {
    const repository = entityManager ? entityManager.getRepository(CartItem) : this.cartItemRepo;
    const result = await repository.delete({ cartId });
    return result.affected || 0;
  }

  async deleteByCartIdAndProductId(cartId: number, productId: number, entityManager?: EntityManager): Promise<boolean> {
    const repository = entityManager ? entityManager.getRepository(CartItem) : this.cartItemRepo;
    const result = await repository.delete({ cartId, productId });
    return result.affected > 0;
  }

  /**
   * Find a single cart item by arbitrary fields (e.g. id, cartId+productId, etc.)
   * @param where - Partial fields to match (e.g. { id }, { cartId, productId })
   */
  async findOne(where: Partial<CartItem>): Promise<CartItem | null> {
    return this.cartItemRepo.findOne({ where });
  }
}