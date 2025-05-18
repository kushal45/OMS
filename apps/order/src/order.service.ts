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

interface InventoryService {
  validate(
    orderItems: OrderQueryInterface.ValidateOrderItemsInput,
  ): Observable<OrderQueryInterface.ValidateOrderItemsResponse>;
}

@Injectable()
export class OrderService {
  private context = OrderService.name;
  constructor(
    private readonly serviceLocator: ServiceLocator,
  ) {}

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
      // const kafkaProducer = this.serviceLocator.getModuleRef().get<KafkaProducer>("KafkaProducerInstance",{strict:false});
      // const configService = this.serviceLocator.getModuleRef().get(ConfigService,{strict:false});
      // await kafkaProducer.send(
      //   configService.get<string>('INVENTORY_UPDATE_TOPIC'),
      //    {
      //     key: 'order',
      //     value: orderItems,
      //   }
      // );
      // let orderResponse: Order;
      // const percentageDeliveryChargeStrategy =
      //   new PercentageDeliveryChargeStrategy();
      // const config = new DefaultOrderConfigService().getOrderConfig();
      // await this.serviceLocator.getTransactionService().executeInTransaction(
      //   async (entityManager) => {
      //     const totalOrderAmtInfo = getOrderInfo(
      //       orderItems,
      //       config,
      //       percentageDeliveryChargeStrategy,
      //     );
      //     const orderRepo =
      //       await this.serviceLocator.getOrderRepository().getRepository(entityManager);
      //     const orderItemsRepo =
      //       await this.serviceLocator.getOrderItemsRepository().getRepository(entityManager);
      //     orderResponse = await orderRepo.create({
      //       ...totalOrderAmtInfo,
      //       addressId,
      //       userId,
      //     });
      //     const orderItemsToSave = await orderItemsRepo.createMany({
      //       orderId: orderResponse.id,
      //       orderItems: orderItems,
      //     });
      //     return orderItemsToSave === orderItems.length;
      //   },
      // );
      //return this.filterOrderResponse(orderResponse);
      return {} as CreateOrderResponseDto;
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
    const order = this.serviceLocator.getOrderRepository().findOne({
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
    const order = await this.serviceLocator.getOrderRepository().findOne({
      aliasId,
    });
    if (!order) throw new NotFoundException('Order not found');
    order.orderStatus = OrderStatus.Cancelled;
    return this.serviceLocator.getOrderRepository().update(order.aliasId, order);
  }

  async deleteOrder(id: number): Promise<boolean> {
    const order = await this.serviceLocator.getOrderRepository().findOne({
      id,
    });
    if (!order) throw new NotFoundException('Order not found');
    return await this.serviceLocator.getOrderRepository().delete(id);
  }
}
