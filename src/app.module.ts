import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { RedisModule } from './common/redis/redis.module';
import { DocumentModule } from './modules/document/document.module';
import { AuthModule } from './auth/auth.module';
import { InjectionQueueModule } from './common/queues/injection-queue/injection-queue.module';
import { RetrievalModule } from './modules/retrieval/retrieval.module';

import { getDatabaseConfig } from './config/database.config';
import { createBullRedisOptions } from './config/redis.config';

import Redis from 'ioredis';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      useFactory: async () => getDatabaseConfig(),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const options = createBullRedisOptions(configService);

        return {
          createClient: () => new Redis(options),
        };
      },
    }),

    RedisModule,
    DocumentModule,
    AuthModule,
    InjectionQueueModule,
    RetrievalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
