import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventory } from '../entity/inventory.entity';

@Injectable()
export class InventoryRepository {
  constructor(
    @InjectRepository(Inventory)
    private readonly repository: Repository<Inventory>,
  ) {}

  async create(inventory: Partial<Inventory>): Promise<Inventory> {
    const newInventory = this.repository.create(inventory);
    return this.repository.save(newInventory);
  }

  async findAll(): Promise<Inventory[]> {
    return this.repository.find();
  }

  async findOne(id: number): Promise<Inventory> {
    return this.repository.findOne({
        where: { id },
    });
  }

  async update(id: number, inventory: Partial<Inventory>): Promise<Inventory> {
    await this.repository.update(id, inventory);
    return this.repository.findOne({
        where: { id },
    });
  }

  async delete(id: number): Promise<boolean> {
    const deleteRes=await this.repository.delete(id);
    if(deleteRes.affected>0) return true;
    return false;
  }
}