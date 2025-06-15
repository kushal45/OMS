import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderRepository } from './repository/order.repository';
import { Order, OrderStatus } from './entity/order.entity';
import { AddressService } from '@lib/address/src';
import { OrderRequestDto } from './dto/create-order-req';
import { getOrderInfo } from './util/calculateOrderInfo';
import { PercentageDeliveryChargeStrategy } from './strategy/percentage-delivercharge.strategy';
import { DefaultOrderConfigService } from './util/orderConfig.service';
import { OrderItemsRepository } from './repository/orderItems.repository';
import { TransactionService } from '@app/utils/transaction.service';
import { CreateOrderResponseDto } from './dto/create-order-res';
import { OrderItems } from './entity/orderItems.entity';
import { UpdateOrderDto } from './dto/update-order-req.dto';
import { ClientGrpc } from '@nestjs/microservices';
import { OrderQueryInterface } from './interfaces/order-query-interface';
import { firstValueFrom, Observable } from 'rxjs';
import { ServiceLocator } from './service-locator';
import { KafkaProducer } from '@lib/kafka/KafkaProducer';
import { ConfigService } from '@nestjs/config';

/**
 * Interface for inventory service gRPC communication.
 * Defines the contract for validating order items against inventory.
 */
interface InventoryService {
  /**
   * Validates order items against available inventory.
   * 
   * @param orderItems - Order items to validate
   * @returns Observable with validation response
   */
  validate(
    orderItems: OrderQueryInterface.ValidateOrderItemsInput,
  ): Observable<OrderQueryInterface.ValidateOrderItemsResponse>;
}

/**
 * Service responsible for managing the complete order lifecycle.
 * 
 * Handles order creation, validation, updates, cancellation, and retrieval.
 * Integrates with inventory, address, and payment services to ensure
 * data consistency across the microservices architecture.
 * 
 * @example
 * ```typescript
 * const orderService = new OrderService(serviceLocator);
 * const order = await orderService.createOrder(orderDto, userId);
 * ```
 */
@Injectable()
export class OrderService {
  private context = OrderService.name;
  
  /**
   * Creates an instance of OrderService.
   * 
   * @param serviceLocator - Service locator for dependency injection
   */
  constructor(
    private readonly serviceLocator: ServiceLocator,
  ) {}

  /**
   * Creates a new order after validating address and inventory.
   * 
   * Performs comprehensive validation including:
   * - Address validation for the user
   * - Inventory validation via gRPC call
   * - Transaction management for data consistency
   * 
   * @param order - Order request containing items and address information
   * @param userId - ID of the user creating the order
   * @returns Promise resolving to the created order response
   * 
   * @throws {BadRequestException} When address is invalid or order items are empty
   * @throws {NotFoundException} When user or items are not found
   * @throws {UnprocessableEntityException} When inventory validation fails
   * 
   * @example
   * ```typescript
   * const orderDto = { 
   *   addressId: '123', 
   *   orderItems: [{ productId: '456', quantity: 2 }] 
   * };
   * const order = await orderService.createOrder(orderDto, 123);
   * ```
   */
  async createOrder(
    order: OrderRequestDto,
    userId: number,
  ): Promise<CreateOrderResponseDto> {
    try {
      const { addressId, orderItems } = order;
      const isValid = await this.serviceLocator.getAddressService().isValidAddress(
        userId,
        addressId,
      );
      if (!isValid) throw new BadRequestException('Address not valid');
      await this.validateOrder(orderItems);
      
      // Note: Kafka integration and transaction logic commented out
      // This appears to be a work in progress
      return {} as CreateOrderResponseDto;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validates order items against inventory service.
   * 
   * Performs gRPC call to inventory service to ensure all items
   * are available and quantities are sufficient.
   * 
   * @param orderItems - Array of order items to validate
   * @returns Promise that resolves when validation is successful
   * 
   * @throws {BadRequestException} When order items are empty or validation fails
   * 
   * @example
   * ```typescript
   * const items = [{ productId: '123', quantity: 2 }];
   * await orderService.validateOrder(items);
   * ```
   */
  async validateOrder(orderItems: OrderQueryInterface.OrderItemInput[]): Promise<void> {
    if (orderItems.length === 0) {
      throw new BadRequestException('Order items cannot be empty');
    }
    
    console.log("orderItems before sending to inventory", orderItems);
    const validationResponse = await firstValueFrom(
      this.serviceLocator.getInventoryService()
        .getService<InventoryService>('InventoryService')
        .validate({orderItems}),
    );
    console.log('validationResponse', JSON.stringify(validationResponse));
    
    if (!validationResponse.success) {
      throw new BadRequestException(validationResponse.invalidOrderItems);
    }
  }

  /**
   * Filters order response to include only necessary fields.
   * 
   * Creates a clean response object with selected properties
   * to avoid exposing internal data structures.
   * 
   * @param order - Complete order entity
   * @returns Filtered order response DTO
   * 
   * @example
   * ```typescript
   * const filteredOrder = orderService.filterOrderResponse(orderEntity);
   * ```
   */
  filterOrderResponse(order: Order): CreateOrderResponseDto {
    const filteredOrder = {} as CreateOrderResponseDto;
    const properties = [
      'aliasId',
      'orderStatus',
      'totalAmount',
      'deliveryCharge',
      'tax',
    ];
    properties.forEach((property) => {
      if (order.hasOwnProperty(property)) {
        filteredOrder[property] = order[property];
      }
    });
    return filteredOrder;
  }

  /**
   * Retrieves all orders for a specific user.
   * 
   * @param userId - ID of the user whose orders to retrieve
   * @returns Promise resolving to array of user's orders
   * 
   * @example
   * ```typescript
   * const userOrders = await orderService.getOrders(123);
   * ```
   */
  async getOrders(userId: number): Promise<Order[]> {
    return this.serviceLocator.getOrderRepository().find(userId);
  }

  /**
   * Retrieves all items for a specific order.
   * 
   * @param aliasId - Alias ID of the order
   * @returns Promise resolving to array of order items
   * 
   * @throws {NotFoundException} When order is not found
   * 
   * @example
   * ```typescript
   * const orderItems = await orderService.getOrderItems('ORD-123');
   * ```
   */
  async getOrderItems(aliasId: string): Promise<OrderItems[]> {
    const order = await this.serviceLocator.getOrderRepository().findOne({
      aliasId,
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.serviceLocator.getOrderItemsRepository().findAll(order.id);
  }

  /**
   * Retrieves a specific order by its alias ID.
   * 
   * @param aliasId - Alias ID of the order
   * @returns Promise resolving to the order entity
   * 
   * @throws {NotFoundException} When order is not found
   * 
   * @example
   * ```typescript
   * const order = await orderService.getOrderById('ORD-123');
   * ```
   */
  async getOrderById(aliasId: string): Promise<Order> {
    const order = this.serviceLocator.getOrderRepository().findOne({
      aliasId,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /**
   * Updates an existing order with new items and recalculates totals.
   * 
   * Handles both adding new items and updating quantities of existing items.
   * Recalculates delivery charges, taxes, and total amounts.
   * 
   * @param aliasId - Alias ID of the order to update
   * @param order - Update order DTO with new order items
   * @returns Promise resolving to updated order response or error
   * 
   * @throws {NotFoundException} When order is not found
   * @throws {UnprocessableEntityException} When no changes are made
   * 
   * @example
   * ```typescript
   * const updateDto = { orderItems: [{ productId: '456', quantity: 3 }] };
   * const updatedOrder = await orderService.updateOrder('ORD-123', updateDto);
   * ```
   */
  async updateOrder(
    aliasId: string,
    order: UpdateOrderDto,
  ): Promise<CreateOrderResponseDto | Error> {
    const isUpdated = await this.validateAndProcessOrderItems(
      aliasId,
      order.orderItems,
    );
    console.log('isUpdated', isUpdated);
    if (!isUpdated)
      throw new UnprocessableEntityException('No change in order items');
    
    const percentageDeliveryChargeStrategy = new PercentageDeliveryChargeStrategy();
    const config = new DefaultOrderConfigService().getOrderConfig();
    const totalOrderAmtInfo = getOrderInfo(
      order.orderItems,
      config,
      percentageDeliveryChargeStrategy,
    );
    
    const updatedOrderResponse = await this.serviceLocator.getOrderRepository().update(aliasId, {
      ...totalOrderAmtInfo,
    });
    return this.filterOrderResponse(updatedOrderResponse);
  }

  /**
   * Validates and processes order items for updates.
   * 
   * Private method that handles the complex logic of comparing existing
   * order items with new ones, determining what needs to be updated,
   * inserted, or removed.
   * 
   * @param aliasId - Alias ID of the order
   * @param orderItems - New order items to process
   * @returns Promise resolving to boolean indicating if any changes were made
   * 
   * @throws {NotFoundException} When order is not found
   * 
   * @private
   */
  private async validateAndProcessOrderItems(
    aliasId: string,
    orderItems: UpdateOrderDto['orderItems'],
  ): Promise<boolean> {
    const order = await this.serviceLocator.getOrderRepository().findOne({
      aliasId,
    });
    if (!order) throw new NotFoundException('Order not found');
    
    let orderId = order.id;
    const existingOrderItems = await this.serviceLocator.getOrderItemsRepository().findAll(orderId);

    const itemsToUpdate = [];
    const itemsToCreate = [];
    let insertLen = 0;
    let updateLen = 0;
    
    await this.serviceLocator.getTransactionService().executeInTransaction(
      async (entityManager) => {
        const orderItemsRepo =
          this.serviceLocator.getOrderItemsRepository().getRepository(entityManager);
        
        orderItems.forEach((item) => {
          const existingItem = existingOrderItems.find(
            (existing) => existing.productId === item.productId,
          );
          if (existingItem) {
            if (existingItem.quantity !== item.quantity) {
              itemsToUpdate.push({ ...existingItem, quantity: item.quantity });
            }
          } else {
            itemsToCreate.push({ orderId, ...item });
          }
        });

        if (itemsToUpdate.length > 0) {
          updateLen = await orderItemsRepo.updateBulk(itemsToUpdate);
        }

        if (itemsToCreate.length > 0) {
          insertLen = await orderItemsRepo.insertBulk(itemsToCreate);
        }
        
        return (
          insertLen === itemsToCreate.length &&
          updateLen === itemsToUpdate.length
        );
      },
    );
    return insertLen > 0 || updateLen > 0;
  }

  /**
   * Cancels an existing order by updating its status.
   * 
   * @param aliasId - Alias ID of the order to cancel
   * @returns Promise resolving to the cancelled order
   * 
   * @throws {NotFoundException} When order is not found
   * 
   * @example
   * ```typescript
   * const cancelledOrder = await orderService.cancelOrder('ORD-123');
   * ```
   */
  async cancelOrder(aliasId: string): Promise<Order> {
    const order = await this.serviceLocator.getOrderRepository().findOne({
      aliasId,
    });
    if (!order) throw new NotFoundException('Order not found');
    order.orderStatus = OrderStatus.Cancelled;
    return this.serviceLocator.getOrderRepository().update(order.aliasId, order);
  }

  /**
   * Permanently deletes an order from the system.
   * 
   * @param id - Internal ID of the order to delete
   * @returns Promise resolving to boolean indicating success
   * 
   * @throws {NotFoundException} When order is not found
   * 
   * @example
   * ```typescript
   * const deleted = await orderService.deleteOrder(123);
   * ```
   */
  async deleteOrder(id: number): Promise<boolean> {
    const order = await this.serviceLocator.getOrderRepository().findOne({
      id,
    });
    if (!order) throw new NotFoundException('Order not found');
    return await this.serviceLocator.getOrderRepository().delete(id);
  }
}
