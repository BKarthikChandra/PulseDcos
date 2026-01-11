import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../../entities/document.entity';
import { BullModule } from '@nestjs/bull';
import { InjectionQueueModule } from '../../common/queues/injection-queue/injection-queue.module';

@Module({
  imports: [TypeOrmModule.forFeature([Document]), InjectionQueueModule],
  providers: [DocumentService],
  controllers: [DocumentController],
})
export class DocumentModule {}
