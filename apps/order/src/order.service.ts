import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
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

@Injectable()
export class OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private orderItemsRepository: OrderItemsRepository,
    private readonly addressService: AddressService,
    private readonly transactionService: TransactionService,
  ) {}

  async createOrder(
    order: OrderRequestDto,
    userId: number,
  ): Promise<CreateOrderResponseDto> {
    try {
      const { addressId, orderItems } = order;
      const isValid = await this.addressService.isValidAddress(
        userId,
        addressId,
      );
      if (!isValid) throw new UnprocessableEntityException('Address not valid');
      let orderResponse: Order;
      const percentageDeliveryChargeStrategy =
        new PercentageDeliveryChargeStrategy();
      const config = new DefaultOrderConfigService().getOrderConfig();
      await this.transactionService.executeInTransaction(
        async (entityManager) => {
          const totalOrderAmtInfo = getOrderInfo(
            orderItems,
            config,
            percentageDeliveryChargeStrategy,
          );
          const orderRepo =
            await this.orderRepository.getRepository(entityManager);
          const orderItemsRepo =
            await this.orderItemsRepository.getRepository(entityManager);
          orderResponse = await orderRepo.create({
            ...totalOrderAmtInfo,
            addressId,
            userId,
          });
          const orderItemsToSave = await orderItemsRepo.createMany({
            orderId: orderResponse.id,
            orderItems: orderItems,
          });
          return orderItemsToSave === orderItems.length;
        },
      );
      return this.filterOrderResponse(orderResponse);
    } catch (error) {
      throw new UnprocessableEntityException(error.message);
    }
  }

  filterOrderResponse(order: Order): CreateOrderResponseDto {
    const filteredOrder = {} as CreateOrderResponseDto;
    const properties = ['aliasId', 'orderStatus'];
    properties.forEach((property) => {
      if (order.hasOwnProperty(property)) {
        filteredOrder[property] = order[property];
      }
    });
    return filteredOrder;
  }

  async getOrders(userId: number): Promise<Order[]> {
    return this.orderRepository.find(userId);
  }

  async getOrderItems(aliasId: string): Promise<OrderItems[]> {
    const order = await this.orderRepository.findOne({
      aliasId,
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.orderItemsRepository.findAll(order.id);
  }

  async getOrderById(aliasId: string): Promise<Order> {
    const order = this.orderRepository.findOne({
      aliasId,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateOrder(aliasId: string ,order: UpdateOrderDto): Promise<CreateOrderResponseDto| Error>{
    const isUpdated = await this.validateAndProcessOrderItems(aliasId, order.orderItems);
    console.log('isUpdated', isUpdated);
    if(!isUpdated)
      throw new UnprocessableEntityException('No change in order items');
    const percentageDeliveryChargeStrategy =
        new PercentageDeliveryChargeStrategy();
      const config = new DefaultOrderConfigService().getOrderConfig();
    const totalOrderAmtInfo = getOrderInfo(
      order.orderItems,
      config,
      percentageDeliveryChargeStrategy,
    );
    const updatedOrderResponse=await this.orderRepository.update(aliasId, {
      ...totalOrderAmtInfo
    });
    return this.filterOrderResponse(updatedOrderResponse);
  }

  private async validateAndProcessOrderItems(
    aliasId: string,
    orderItems: UpdateOrderDto['orderItems'],
  ): Promise<boolean> {
    const order = await this.orderRepository.findOne({
      aliasId,
    });
    if(!order) throw new NotFoundException('Order not found');
    let orderId=order.id;
    const existingOrderItems = await this.orderItemsRepository.findAll(orderId);

    const itemsToUpdate = [];
    const itemsToCreate = [];
    let insertLen=0;
    let updateLen=0;
    await this.transactionService.executeInTransaction(
      async (entityManager) => {
        
        const orderItemsRepo =this.orderItemsRepository.getRepository(entityManager);
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
          updateLen=await orderItemsRepo.updateBulk(itemsToUpdate);
        }

        if (itemsToCreate.length > 0) {
          insertLen=await orderItemsRepo.insertBulk(itemsToCreate);
        }
        return insertLen === itemsToCreate.length && updateLen === itemsToUpdate.length;
      });
      return insertLen > 0 || updateLen > 0;
  }

  async cancelOrder(aliasId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      aliasId,
    });
    if (!order) throw new NotFoundException('Order not found');
    order.orderStatus = OrderStatus.Cancelled;
    return this.orderRepository.update(order.aliasId, order);
  }

  async deleteOrder(id: number): Promise<void> {
    await this.orderRepository.delete(id);
  }
}
