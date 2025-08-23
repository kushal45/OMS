import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisClientService } from './redis-client.service';
import Redis, { RedisOptions } from 'ioredis';
import Redlock from 'redlock';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const redisClientType = configService.get<string>('REDIS_CLIENT_TYPE');
        const redisPassword = configService.get<string>('REDIS_PASSWORD');
        let client: Redis;

        const commonRedisOptions: RedisOptions = {
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            console.log(`Redis connection attempt ${times}, retrying in ${delay}ms`);
            return delay;
          },
          password: redisPassword,
        };

        if (redisClientType === 'SENTINEL') {
          const sentinelAddresses = configService.get<string>('REDIS_SENTINEL_ADDRESSES');
          const sentinelMasterName = configService.get<string>('REDIS_SENTINEL_MASTER_NAME');

          if (!sentinelAddresses || !sentinelMasterName) {
            throw new Error('REDIS_CLIENT_TYPE is SENTINEL, but REDIS_SENTINEL_ADDRESSES or REDIS_SENTINEL_MASTER_NAME not configured.');
          }

          const sentinels = sentinelAddresses.split(',').map(addr => {
            const [host, port] = addr.split(':');
            return { host, port: parseInt(port, 10) };
          });

          client = new Redis({
            ...commonRedisOptions,
            sentinels,
            name: sentinelMasterName,
          });

          client.on('connect', () => {
            console.log('Connected to Redis via Sentinel');
          });
          client.on('+sentinel', (data) => {
              console.log('Redis Sentinel event (+sentinel):', data);
          });
          client.on('-sentinel', (data) => {
              console.log('Redis Sentinel event (-sentinel):', data);
          });
          client.on('+switch-master', (data) => {
              console.log('Redis Sentinel event (+switch-master):', data);
          });

        } else if (redisClientType === 'STANDALONE') {
          const redisHost = configService.get<string>('REDIS_HOST');
          const redisPort = configService.get<number>('REDIS_PORT');

          if (!redisHost || !redisPort) {
            throw new Error('REDIS_CLIENT_TYPE is STANDALONE, but REDIS_HOST or REDIS_PORT not configured.');
          }

          client = new Redis({
            ...commonRedisOptions,
            host: redisHost,
            port: redisPort,
          });

          client.on('connect', () => {
            console.log('Connected to Redis Standalone');
          });

        } else {
          throw new Error('Invalid REDIS_CLIENT_TYPE. Must be SENTINEL or STANDALONE.');
        }

        client.on('error', (err) => {
          console.error('Redis Client Error:', err);
        });
        client.on('ready', () => {
          console.log('Redis client ready');
        });

        return client;
      },
      inject: [ConfigService],
    },
    {
      provide: 'REDLOCK_CLIENT',
      useFactory: (redisClient: Redis) => {
        const redlock = new Redlock(
          [redisClient],
          {
            driftFactor: 0.01,
            retryCount: 10,
            retryDelay: 200,
            retryJitter: 200
          }
        );
        
        redlock.on('clientError', function(err) {
          console.error('A Redlock client error occurred:', err);
        });

        return redlock;
      },
      inject: ['REDIS_CLIENT'],
    },
    RedisClientService,
  ],
  exports: [RedisClientService, 'REDIS_CLIENT', 'REDLOCK_CLIENT'],
})
export class RedisClientModule {}
