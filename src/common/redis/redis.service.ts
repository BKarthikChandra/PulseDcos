import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createAppRedisOptions } from 'src/config/redis.config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const options = createAppRedisOptions(this.configService);

    this.client = new Redis(options);

    this.client.on('connect', () => console.log('Redis connected'));
    this.client.on('ready', () => console.log('Redis ready'));
    this.client.on('error', (err) => console.error('Redis error:', err));
    this.client.on('close', () => console.warn('Redis connection closed'));

    this.setupShutdownHooks();
  }

  getClient(): Redis {
    if (this.client.status !== 'ready') {
      throw new Error(`Redis not ready. Current state: ${this.client.status}`);
    }
    return this.client;
  }

  private setupShutdownHooks() {
    const shutdown = async () => {
      try {
        if (this.client) {
          await this.client.quit();
          console.log('Redis connection closed gracefully');
        }
      } catch (err) {
        console.error('Error closing Redis connection', err);
      } finally {
        process.exit(0);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      console.log('Redis connection closed on module destroy');
    }
  }
}
