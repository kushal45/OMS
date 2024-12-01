import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { OrderRepository } from './repository/order.repository';
import { Order } from './entity/order.entity';
import { AddressService } from '@lib/address/src';
import { OrderRequestDto } from './dto/order-request.dto';
import { getOrderInfo } from './util/calculateOrderInfo';
import { PercentageDeliveryChargeStrategy } from './strategy/percentage-delivercharge.strategy';
import { DefaultOrderConfigService } from './util/orderConfig.service';
import { OrderItemsRepository } from './repository/orderItems.repository';
import { TransactionService } from '@app/utils/transaction.service';
import { OrderResponseDto } from './dto/order-response.dto';

@Injectable()
export class OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private orderItemsRepository: OrderItemsRepository,
    private readonly addressService: AddressService,
    private readonly transactionService: TransactionService,
  ) {}

  async createOrder(order: OrderRequestDto, userId: number): Promise<OrderResponseDto> {
    try {
      const { addressId, orderItems } = order;
      const isValid = await this.addressService.isValidAddress(userId, addressId);
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

  filterOrderResponse(order: Order): OrderResponseDto {
    const filteredOrder = {} as OrderResponseDto;
    const properties = [
      "aliasId",
      'orderStatus',
    ];
    properties.forEach((property) => {
      if (order.hasOwnProperty(property)) {
        filteredOrder[property] = order[property];
      }
    });
    return filteredOrder;
  }

  async getOrders(userId): Promise<Order[]> {
    return this.orderRepository.find(userId);
  }

  async getOrderById(id: number): Promise<Order> {
    return this.orderRepository.findOne(id);
  }

  async updateOrder(id: number, order: Partial<Order>): Promise<Order> {
    await this.orderRepository.update(id, order);
    return this.orderRepository.findOne(id);
  }

  async deleteOrder(id: number): Promise<void> {
    await this.orderRepository.delete(id);
  }
}
