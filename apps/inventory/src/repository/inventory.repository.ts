import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Inventory } from '../entity/inventory.entity';
import { BaseRepository } from '@app/order/src/util/interfaces/base-repository.interface';
import { QueryInput } from '../interfaces/query-input.interface';
import { convertOptions } from '../util/queryTransform';

@Injectable()
export class InventoryRepository  implements BaseRepository<InventoryRepository> {
  constructor(
    @InjectRepository(Inventory)
    private readonly repository: Repository<Inventory>,
  ) {}
  
  getRepository(entityManager: EntityManager): InventoryRepository { // Reverted return type
    // This creates a new instance of InventoryRepository with the transactional EntityManager's repository
    return new InventoryRepository(entityManager.getRepository(Inventory));
  }

  async create(inventory: Partial<Inventory>): Promise<Inventory> {
    const newInventory = this.repository.create(inventory);
    return this.repository.save(newInventory);
  }

  async findAll(options?:QueryInput.FetchInStockProductsInput): Promise<Inventory[]> {
    try {
      if(!options) return this.repository.find();
      // convert options to be usable in where clause and compatible with FindOptionsWhere<Inventory> of typeorm
      const whereOptions= convertOptions<Inventory>(options as Inventory);
      
      return this.repository.find(
        {
          where: whereOptions
        }
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  
  }

  async findOne(id: number, entityManager?: EntityManager): Promise<Inventory> {
    const repository = entityManager ? entityManager.getRepository(Inventory) : this.repository;
    return repository.findOne({
        where: { id },
    });
  }

  async findByProductId(productId: string, entityManager?: EntityManager): Promise<Inventory | null> {
    const repository = entityManager ? entityManager.getRepository(Inventory) : this.repository;
    return repository.findOne({ where: { productId } });
  }


  async update(id: number, inventory: Partial<Inventory>, entityManager?: EntityManager): Promise<Inventory> {
    const repository = entityManager ? entityManager.getRepository(Inventory) : this.repository;
    await repository.update(id, inventory);
    return repository.findOne({ // Use the same repository instance for findOne
        where: { id },
    });
  }

  async updateBulk(orderItems: Partial<Inventory>[]): Promise<number> {
    return await this.repository.manager.transaction(async (transactionalEntityManager: EntityManager) => {
      let updatedItemCount = 0;

      for (const item of orderItems) {
        const result = await transactionalEntityManager.update(Inventory, { productId: item.productId }, item);
        if (result.affected && result.affected > 0) {
          const updatedItem = await transactionalEntityManager.findOne(Inventory, { where: { productId: item.productId } });
          if (updatedItem) {
            updatedItemCount++;
          }
        } else {
          throw new Error(`Failed to update item with productId: ${item.productId}`);
        }
      }

      if ( updatedItemCount !== orderItems.length) {
        throw new Error('Not all items were updated successfully');
      }

      return updatedItemCount;
    });
  }

  async delete(id: number, entityManager?: EntityManager): Promise<boolean> {
    const repository = entityManager ? entityManager.getRepository(Inventory) : this.repository;
    const deleteRes=await repository.delete(id);
    if(deleteRes.affected>0) return true;
    return false;
  }
}