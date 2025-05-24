import { Injectable, Inject } from '@nestjs/common';
import { OrderRepository } from './repository/order.repository';
import { OrderItemsRepository } from './repository/orderItems.repository';
import { AddressService } from '@lib/address/src';
import { TransactionService } from '@app/utils/transaction.service';
import { ClientGrpc } from '@nestjs/microservices';
import { LoggerService } from '@lib/logger/src';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class ServiceLocator {
  constructor(
    @Inject('INVENTORY_PACKAGE') private readonly inventoryService: ClientGrpc,
    private readonly orderRepository: OrderRepository,
    private readonly orderItemsRepository: OrderItemsRepository,
    private readonly addressService: AddressService,
    private readonly transactionService: TransactionService,
    private readonly customLoggerService: LoggerService,
    private readonly moduleRef: ModuleRef,
  ) {}

  getOrderRepository(): OrderRepository {
    return this.orderRepository;
  }

  getOrderItemsRepository(): OrderItemsRepository {
    return this.orderItemsRepository;
  }

  getAddressService(): AddressService {
    return this.addressService;
  }

  getTransactionService(): TransactionService {
    return this.transactionService;
  }

  getInventoryService(): ClientGrpc {
    return this.inventoryService;
  }

  getCustomLoggerService(): LoggerService {
    return this.customLoggerService;
  }

  getModuleRef(): ModuleRef {
    return this.moduleRef;
  }
}
