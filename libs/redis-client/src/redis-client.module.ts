import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisClientService } from './redis-client.service';
import Redis, { RedisOptions } from 'ioredis'; // Using ioredis which supports Sentinel, import RedisOptions
import Redlock from 'redlock';

@Global() // Make this module global so RedisClientService can be injected anywhere
@Module({
  imports: [ConfigModule], // Import ConfigModule to use ConfigService for Redis config
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const sentinelAddresses = configService.get<string>('REDIS_SENTINEL_ADDRESSES');
        const sentinelMasterName = configService.get<string>('REDIS_SENTINEL_MASTER_NAME');
        const redisPassword = configService.get<string>('REDIS_PASSWORD'); // Optional

        if (!sentinelAddresses || !sentinelMasterName) {
          throw new Error('Redis Sentinel addresses or master name not configured.');
        }

        const sentinels = sentinelAddresses.split(',').map(addr => {
          const [host, port] = addr.split(':');
          return { host, port: parseInt(port, 10) };
        });

        const redisOptions: RedisOptions = { // Corrected type usage
          sentinels,
          name: sentinelMasterName,
          // sentinelRetryStrategy: (times) => Math.min(times * 50, 2000), // Optional retry strategy
          // enableOfflineQueue: true, // Optional: queue commands when offline
        };

        if (redisPassword) {
          redisOptions.password = redisPassword;
          // For Sentinel connections, password might also be needed for sentinels themselves
          // if they are password protected, and for the master/replicas.
          // ioredis handles this via the main password option for master/replicas
          // and sentinelPassword option if sentinels have a different password.
          // redisOptions.sentinelPassword = configService.get<string>('REDIS_SENTINEL_PASSWORD');
        }
        
        // Add basic retry strategy for the Redis client itself
        redisOptions.retryStrategy = (times) => {
            const delay = Math.min(times * 50, 2000); // Default ioredis strategy
            console.log(`Redis connection attempt ${times}, retrying in ${delay}ms`);
            return delay;
        };


        const client = new Redis(redisOptions);

        client.on('error', (err) => {
          console.error('Redis Client Error:', err);
        });
        client.on('connect', () => {
          console.log('Connected to Redis via Sentinel');
        });
        client.on('ready', () => {
          console.log('Redis client ready');
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


        return client;
      },
      inject: [ConfigService],
    },
    {
      provide: 'REDLOCK_CLIENT',
      useFactory: (redisClient: Redis) => { // Corrected type usage
        // Redlock uses the ioredis client instance(s).
        // For a single Sentinel-managed setup, one client is usually sufficient.
        // If you had multiple independent Redis instances for Redlock, you'd pass an array.
        const redlock = new Redlock(
          [redisClient],
          {
            // Specify retry behavior for Redlock
            driftFactor: 0.01, // time in ms
            retryCount: 10,
            retryDelay: 200, // time in ms
            retryJitter: 200 // time in ms
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
  exports: [RedisClientService, 'REDIS_CLIENT', 'REDLOCK_CLIENT'], // Export service and clients
})
export class RedisClientModule {}