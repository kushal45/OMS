import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Order, OrderStatus } from './entity/order.entity';
import { AddressService } from '@lib/address/src';
import { OrderRequestDto } from './dto/create-order-req';
import { getOrderInfo } from './util/calculateOrderInfo';
import { PercentageDeliveryChargeStrategy } from './strategy/percentage-delivercharge.strategy';
import { DefaultOrderConfigService } from './util/orderConfig.service';
import { CreateOrderResponseDto } from './dto/create-order-res';
import { OrderItems } from './entity/orderItems.entity';
import { UpdateOrderDto } from './dto/update-order-req.dto';
import { ClientGrpc } from '@nestjs/microservices';
import { OrderQueryInterface } from './interfaces/order-query-interface';
import { firstValueFrom, Observable } from 'rxjs';
import { ServiceLocator } from './service-locator';
// import { KafkaProducer } from '@lib/kafka/KafkaProducer'; // No longer directly used here
import { ConfigService } from '@nestjs/config';
import { OutboxEvent, OutboxEventStatus } from '../../cart/src/entity/outbox-event.entity'; // Ensure this path is correct
import { EntityManager } from 'typeorm';
import type { CartResponseDto__Output } from '../../cart/src/proto/cart/CartResponseDto';

interface InventoryService {
  validate(
    orderItems: OrderQueryInterface.ValidateOrderItemsInput,
  ): Observable<OrderQueryInterface.ValidateOrderItemsResponse>;
}

// DTOs for Cart Service gRPC call
interface CartItemDto {
  id: string;
  productId: string;
  quantity: number;
  price: number;
}

interface CartResponseDto {
  id: string;
  userId: string;
  items: CartItemDto[];
  subTotal: number;
  totalItems: number;
  discount?: number;
  tax?: number;
  grandTotal: number;
  updatedAt?: string;
}

interface CartServiceGrpc {
  getActiveCartByUserId(data: { userId: string }): Observable<CartResponseDto__Output>;
  clearCartByUserId(data: { userId: string }): Observable<{ success: boolean; message: string }>;
}

@Injectable()
export class OrderService {
  private context = OrderService.name;
  private cartServiceGrpc: CartServiceGrpc;
  constructor(
    private readonly serviceLocator: ServiceLocator, // Will be gradually phased out if this approach is continued
    private readonly orderConfigService: DefaultOrderConfigService,
    private readonly addressService: AddressService, // Inject AddressService
    @Inject('CART_PACKAGE') private readonly cartClient: ClientGrpc,
    private readonly configService: ConfigService, // Injected ConfigService
  ) {}

  onModuleInit() {
    this.cartServiceGrpc = this.cartClient.getService<CartServiceGrpc>('CartService');
  }

  async createOrder(
    order: OrderRequestDto,
    userId: number,
    traceId: string, // Assuming traceId is passed for logging purposes
  ): Promise<CreateOrderResponseDto> {
    try {
      const { addressId } = order;
      const isValid = await this.addressService.isValidAddress(
        userId,
        addressId,
      );
      if (!isValid) throw new BadRequestException('Address not valid');

      // Fetch active cart and build orderItems
      const cart: CartResponseDto__Output = await firstValueFrom(
        this.cartServiceGrpc.getActiveCartByUserId({ userId: userId.toString() }),
      );
      console.log(`[${traceId}] Received cart object in OrderService:`, JSON.stringify(cart, null, 2)); // Log the received cart object

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new BadRequestException('Active cart is empty or not found.');
      }

      const orderItems: OrderQueryInterface.OrderItemInput[] = cart.items.map(
        (item) => ({
          productId: parseInt(item.productId, 10),
          quantity: item.quantity,
          price: item.price,
        }),
      );

      await this.validateOrder(orderItems);
      let orderResponse: Order;
      const percentageDeliveryChargeStrategy =
        new PercentageDeliveryChargeStrategy();
      const orderCreationConfig = this.orderConfigService.getOrderConfig(); // Use injected service
      await this.serviceLocator.getTransactionService().executeInTransaction(
        async (entityManager) => {
          const totalOrderAmtInfo = getOrderInfo(
            orderItems,
            orderCreationConfig,
            percentageDeliveryChargeStrategy,
          );
          const orderRepo =
            this.serviceLocator.getOrderRepository().getRepository(entityManager);
          const orderItemsRepo =
            this.serviceLocator.getOrderItemsRepository().getRepository(entityManager);

          orderResponse = await orderRepo.create({
            ...totalOrderAmtInfo,
            addressId,
            userId,
          });

          const savedItemsCount = await orderItemsRepo.createMany({
            orderId: orderResponse.id,
            orderItems: orderItems,
          });

          if (savedItemsCount !== orderItems.length) {
            // This case should ideally lead to transaction rollback
            throw new UnprocessableEntityException('Failed to save all order items.');
          }

         

          // Fire-and-forget: clear cart via gRPC asynchronously (do not await)
          (async () => {
            try {
              const clearCartResult = await firstValueFrom(
                this.cartServiceGrpc.clearCartByUserId({ userId: userId.toString() })
              );
              const logger = this.serviceLocator.getLoggerService();
              logger.info(
                `CartService.clearCartByUserId gRPC result: ${JSON.stringify(clearCartResult)}`,
                traceId,
              );
            } catch (err) {
              const logger = this.serviceLocator.getLoggerService();
              logger.error(
                `Failed to clear cart via gRPC after order creation: ${err?.message || err}`,
                traceId,
              );
            }
          })();

          return true; // Indicate success for transaction
        },
      );

      const logger = this.serviceLocator.getLoggerService();
      logger.info(
        `Order ${orderResponse.aliasId} created successfully. Outbox event for inventory removal queued.`,
        traceId,
      );
      return this.filterOrderResponse(orderResponse);
    } catch (error) {
      throw error;
    }
  }

  async validateOrder(orderItems: OrderQueryInterface.OrderItemInput[]): Promise<void> {
    if (orderItems.length === 0) {
      throw new BadRequestException('Order items cannot be empty');
    }
    /**
     * we perform grpc call to validate order items present in the Inventory service
     * and throw error if any of the item is not present with the items list
     * if all items are present then we return the response
     */
    console.log("orderItems before sending to inventory",orderItems);
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

  async getOrders(userId: number): Promise<Order[]> {
    return this.serviceLocator.getOrderRepository().find(userId);
  }

  async getOrderItems(aliasId: string): Promise<OrderItems[]> {
    const order = await this.serviceLocator.getOrderRepository().findOne({
      aliasId,
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.serviceLocator.getOrderItemsRepository().findAll(order.id);
  }

  async getOrderById(aliasId: string): Promise<Order> {
    const order = await this.serviceLocator.getOrderRepository().findOne({
      aliasId,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

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
    const percentageDeliveryChargeStrategy =
      new PercentageDeliveryChargeStrategy();
    const config = this.orderConfigService.getOrderConfig(); // Use injected service
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

  async cancelOrder(aliasId: string): Promise<Order> {
    const orderRepo = this.serviceLocator.getOrderRepository();
    const orderItemsRepo = this.serviceLocator.getOrderItemsRepository();
    // const outboxRepo = this.serviceLocator.getOutboxEventRepository(); // Assuming you have a way to get this

    let cancelledOrder: Order;

    await this.serviceLocator.getTransactionService().executeInTransaction(
      async (entityManager: EntityManager) => {
        const transactionalOrderRepo = orderRepo.getRepository(entityManager);
        const transactionalOrderItemsRepo = orderItemsRepo.getRepository(entityManager);
        const outboxRepository = entityManager.getRepository(OutboxEvent); // TypeORM's generic repository for OutboxEvent

        // Use the repository's specific findOne method
        const order = await transactionalOrderRepo.findOne({ aliasId });
        if (!order) {
          throw new NotFoundException('Order not found');
        }

        if (order.orderStatus === OrderStatus.Cancelled) {
          throw new BadRequestException('Order is already cancelled.');
        }

        // Use the repository's specific method to get order items
        const orderItems = await transactionalOrderItemsRepo.findAll(order.id);

        if (!orderItems || orderItems.length === 0) {
          this.serviceLocator.getLoggerService().info(
            `Order ${aliasId} has no items to replenish. Still cancelling order.`,
            this.context,
          );
        } else {
          // Prepare the outbox event payload
          const payload = orderItems.map(item => ({
            eventType: 'ORDER_ITEMS_TO_REPLENISH',
            productId: item.productId,
            quantity: item.quantity,
          }));

          // Create and save the outbox event
          const outboxEvent = new OutboxEvent();
          outboxEvent.eventType = this.configService.get('REPLENISH_INVENTORY_TOPIC');
          outboxEvent.payload = {
            orderId: order.id,
            items: payload,
          };
          outboxEvent.status = OutboxEventStatus.PENDING;

          await outboxRepository.save(outboxEvent);

          this.serviceLocator.getLoggerService().info(
            `Outbox event created for replenishing items of order ${aliasId}.`,
            this.context,
          );
        }

        order.orderStatus = OrderStatus.Cancelled;
        // Use the repository's specific update method
        // The update method in the original service returns the updated order.
        // If transactionalOrderRepo.update behaves similarly to orderRepo.update
        cancelledOrder = await transactionalOrderRepo.update(aliasId, { orderStatus: OrderStatus.Cancelled });
        return true; // Indicate success for transaction
      },
    );

    if (!cancelledOrder) {
      // This should ideally not happen if executeInTransaction handles errors properly
      throw new UnprocessableEntityException('Failed to cancel order.');
    }
    return cancelledOrder;
  }

  async deleteOrder(id: number): Promise<boolean> {
    const order = await this.serviceLocator.getOrderRepository().findOne({
      id,
    });
    if (!order) throw new NotFoundException('Order not found');
    return await this.serviceLocator.getOrderRepository().delete(id);
  }

  async fetchActiveCartForUser(userId: string): Promise<any> {
    // Optionally type as CartResponseDto
    return firstValueFrom(this.cartServiceGrpc.getActiveCartByUserId({ userId }));
  }
}
