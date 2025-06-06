import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import Redlock, { Lock } from 'redlock'; // Import Lock type
import { LoggerService } from '@lib/logger/src'; // Assuming a shared logger

@Injectable()
export class RedisClientService implements OnModuleDestroy {
  private readonly loggerContext = RedisClientService.name;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis, // Corrected type
    @Inject('REDLOCK_CLIENT') private readonly redlock: Redlock,
    private readonly logger: LoggerService, // Inject logger
  ) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.redisClient.get(key);
    } catch (error) {
      this.logger.error(`Error getting key ${key} from Redis: ${error.message}`, error.stack, this.loggerContext);
      throw error; // Re-throw or handle as per application needs
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    try {
      if (ttlSeconds) {
        return await this.redisClient.set(key, value, 'EX', ttlSeconds);
      }
      return await this.redisClient.set(key, value);
    } catch (error) {
      this.logger.error(`Error setting key ${key} in Redis: ${error.message}`, error.stack, this.loggerContext);
      throw error;
    }
  }

  async del(key: string | string[]): Promise<number> {
    try {
      return await this.redisClient.del(key as string[]); // Type assertion
    } catch (error) {
      this.logger.error(`Error deleting key(s) ${key} from Redis: ${error.message}`, error.stack, this.loggerContext);
      throw error;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const data = await this.get(key);
    if (data) {
      try {
        return JSON.parse(data) as T;
      } catch (error) {
        this.logger.error(`Error parsing JSON for key ${key}: ${error.message}`, error.stack, this.loggerContext);
        // Optionally delete the malformed key or handle differently
        await this.del(key); 
        return null;
      }
    }
    return null;
  }

  async setJson(key: string, value: any, ttlSeconds?: number): Promise<'OK'> {
    try {
      const jsonValue = JSON.stringify(value);
      return await this.set(key, jsonValue, ttlSeconds);
    } catch (error) {
      // Error during stringify or set
      this.logger.error(`Error setting JSON for key ${key}: ${error.message}`, error.stack, this.loggerContext);
      throw error;
    }
  }

  // Redlock methods
  async acquireLock(resource: string, ttl: number): Promise<Lock | null> {
    this.logger.debug(`Attempting to acquire lock for resource: ${resource} with TTL: ${ttl}ms`, this.loggerContext);
    try {
      // The 'redlock.lock()' method was used in older versions.
      // In redlock v4+, it's 'redlock.acquire()'.
      // Assuming redlock v4+ based on modern usage. If it's an older version, this might need to be 'lock'.
      const lock = await this.redlock.acquire([resource], ttl); // Pass resource as an array
      this.logger.info(`Lock acquired for resource: ${resource}`, this.loggerContext);
      return lock;
    } catch (error) {
      // Redlock throws specific errors, e.g., if the lock cannot be acquired
      this.logger.info(`Failed to acquire lock for resource ${resource}: ${error.message}`, this.loggerContext); // Changed warn to info
      return null; // Return null or re-throw specific error types if needed
    }
  }

  async releaseLock(lock: Lock): Promise<void> {
    if (!lock) {
      this.logger.info('Attempted to release a null or undefined lock.', this.loggerContext); // Changed warn to info
      return;
    }
    this.logger.debug(`Attempting to release lock for resource: ${lock.resources.join(', ')}`, this.loggerContext);
    try {
      await lock.release();
      this.logger.info(`Lock released for resource: ${lock.resources.join(', ')}`, this.loggerContext);
    } catch (error) {
      // Log error but don't necessarily throw, as the lock might have expired
      this.logger.error(`Error releasing lock for resource ${lock.resources.join(', ')}: ${error.message}`, error.stack, this.loggerContext);
    }
  }
  
  // Method to extend a lock
  async extendLock(lock: Lock, ttl: number): Promise<Lock | null> {
    if (!lock) {
        this.logger.info('Attempted to extend a null or undefined lock.', this.loggerContext); // Changed warn to info
        return null;
    }
    this.logger.debug(`Attempting to extend lock for resource: ${lock.resources.join(', ')} by ${ttl}ms`, this.loggerContext);
    try {
        const extendedLock = await lock.extend(ttl);
        this.logger.info(`Lock extended for resource: ${lock.resources.join(', ')}`, this.loggerContext);
        return extendedLock;
    } catch (error) {
        this.logger.info(`Failed to extend lock for resource ${lock.resources.join(', ')}: ${error.message}`, this.loggerContext); // Changed warn to info
        return null;
    }
  }


  getClient(): Redis { // Corrected type
    return this.redisClient;
  }

  async onModuleDestroy() {
    this.logger.info('Disconnecting Redis client...', this.loggerContext);
    await this.redisClient.quit(); // Gracefully disconnect
    // Redlock doesn't have an explicit disconnect for the Redlock instance itself,
    // as it operates on the provided client(s).
  }
}