import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CartDataService } from './repository/cart-data.repository';
import { CartItemRepository } from './repository/cart-item.repository';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@lib/logger/src';
import { KafkaProducer } from '@lib/kafka/KafkaProducer';
import { TransactionService } from '@app/utils/transaction.service';

@Injectable()
export class ServiceLocator {
  private readonly cache = new Map<string, any>();

  constructor(private readonly moduleRef: ModuleRef) {}

  getCartDataService(): CartDataService {
    return this.getInstance('CartDataService', CartDataService);
  }

  getCartItemRepository(): CartItemRepository {
    return this.getInstance('CartItemRepository', CartItemRepository);
  }

  getConfigService(): ConfigService {
    return this.getInstance('ConfigService', ConfigService);
  }

  getLoggerService(): LoggerService {
    return this.getInstance('LoggerService', LoggerService);
  }

  getKafkaProducer(): KafkaProducer {
    // Use the provider token as registered in the module
    return this.getInstance('KafkaProducerInstance', 'KafkaProducerInstance' as any);
  }

  getTransactionService(): TransactionService {
    return this.getInstance('TransactionService', TransactionService);
  }

  // Generic internal method for caching and resolving
  private getInstance<T>(key: string, type: Type<T>): T {
    if (!this.cache.has(key)) {
      const instance = this.moduleRef.get(type, { strict: false });
      if (!instance) {
        throw new Error(`ServiceLocator: Unable to resolve dependency: ${key}`);
      }
      this.cache.set(key, instance);
    }
    return this.cache.get(key);
  }
}


