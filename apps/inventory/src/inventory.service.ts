import { Injectable } from '@nestjs/common';
import { InventoryRepository } from './repository/inventory.repository';
import { Inventory } from './entity/inventory.entity';
import { ValidateOrderItemsReqDto } from './dto/validate-order-items-req.dto';
import { QueryInput } from './interfaces/query-input.interface';
import { CheckProductIdHandler } from './util/check-product-id-handler';
import { CheckQuantityHandler } from './util/check-quantity-handler';
import { ValidateOrderItemsResponseDto } from './dto/validate-order-items-res.dto';
import { KafkaConsumer } from '@lib/kafka/KafkaConsumer';
import { ModuleRef } from '@nestjs/core';
import { TransactionService } from '@app/utils/transaction.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private moduleRef: ModuleRef,
  ) {}

  async createInventory(inventory: Partial<Inventory>): Promise<Inventory> {
    return this.inventoryRepository.create(inventory);
  }

  async getInventories(): Promise<Inventory[]> {
    return this.inventoryRepository.findAll();
  }

  async validate(
    items: ValidateOrderItemsReqDto,
  ): Promise<ValidateOrderItemsResponseDto> {
    try {
      const productIds = items.orderItems.map((item) => item.productId);
      const matchingInventories = await this.inventoryRepository.findAll({
        productId: productIds,
        status: QueryInput.InventoryStatus.IN_STOCK,
      });
      /**
       * 1. Check if all products are in stock
       * 2. Check if the quantity of each product in the inventory is greater than or equal with the order Items requested quantity
       * 3. If any of the above conditions fail, return those products which are not in stock or have insufficient quantity
       * Invalid match can be of two types:
       * 1. Product is not in stock
       * 2. Product is in stock but the quantity is less than the requested quantity
       * In both cases, return those entries with the product id and the quantity that is not in stock or is less than the requested quantity
       */
      const invalidOrderItems = this.matchInventoriesWithOrderItems(
        items,
        matchingInventories,
      );
      if (invalidOrderItems.length > 0) {
        return {
          success: false,
          invalidOrderItems,
        };
      } else {
        return {
          success: true,
        };
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private matchInventoriesWithOrderItems(
    items: ValidateOrderItemsReqDto,
    inventories: Inventory[],
  ): Array<QueryInput.InvalidOrderItemWithReason> {
    const invalidOrderItems: Array<QueryInput.InvalidOrderItemWithReason> = [];

    const checkProductIdHandler = new CheckProductIdHandler();
    const checkQuantityHandler = new CheckQuantityHandler();

    checkProductIdHandler.setNext(checkQuantityHandler);

    for (const orderItem of items.orderItems) {
      const reasons = checkProductIdHandler.handle(orderItem, inventories);
      if (reasons.length > 0) {
        invalidOrderItems.push({ orderItem, reasons });
      }
    }

    return invalidOrderItems;
  }

  async fetch(productId: number): Promise<Inventory> {
    return await this.inventoryRepository.findOne(productId);
  }

  async update(
    productId: number,
    orderItem: Partial<Inventory>,
    inventoryRepo: InventoryRepository,
  ): Promise<Inventory> {
    // check the current quantity of the product and compare it with the incoming orderItem
    // reduce quantity of the inventory product and increasse the reserved quantity

    const inventory = await this.inventoryRepository.findOne(productId);
    if (inventory) {
      inventory.quantity -= orderItem.quantity;
      inventory.reservedQuantity += orderItem.quantity;
      return await inventoryRepo.update(productId, inventory);
    }
  }

  async eventBasedUpdate(kafkaConsumer: KafkaConsumer) {
    let index = 0;
    let count = 0;
    let orderItemsToUpdate: Partial<Inventory>[] = [];
    await kafkaConsumer.postSubscribeCallback(
      async (topic, partition, message, headers) => {
        console.log(
          `Received message from topic ${topic} partition ${partition} message ${message}`,
        );
        const orderItemPayload = JSON.parse(message);
        console.log('headers', headers);
        count = parseInt(headers.messageCount as string);
        console.log('count', count);
        index++;

        orderItemsToUpdate.push({
          productId: orderItemPayload.productId,
          quantity: orderItemPayload.quantity,
        });

        if (index === count && count > 0) {
          index = 0;
          await this.inventoryRepository.updateBulk(orderItemsToUpdate);
          orderItemsToUpdate = [];
        }
      },
    );
  }

  async delete(productId: number): Promise<boolean> {
    return this.inventoryRepository.delete(productId);
  }
}
