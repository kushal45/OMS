import { Injectable } from '@nestjs/common';
import { InventoryRepository } from './repository/inentory.repository';
import { Inventory } from './entity/inventory.entity';

@Injectable()
export class InventoryService {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async createInventory(inventory: Partial<Inventory>): Promise<Inventory> {
    return this.inventoryRepository.create(inventory);
  }

  async getInventories(): Promise<Inventory[]> {
    return this.inventoryRepository.findAll();
  }

  async getInventoryById(id: number): Promise<Inventory> {
    return this.inventoryRepository.findOne(id);
  }

  async updateInventory(id: number, inventory: Partial<Inventory>): Promise<Inventory> {
    return this.inventoryRepository.update(id, inventory);
  }

  async deleteInventory(id: number): Promise<boolean> {
    return this.inventoryRepository.delete(id);
  }
}