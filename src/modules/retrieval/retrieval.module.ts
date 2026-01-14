import { Module } from '@nestjs/common';
import { RetrievalService } from './retrieval.service';
import { RetrievalController } from './retrieval.controller';
import { InjectionQueueModule } from '../../common/queues/injection-queue/injection-queue.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from 'src/entities/document.entity';
import { DocumentChunk } from 'src/entities/document.chunks.entity';
import { DocumentPages } from 'src/entities/document.pages.entity';

@Module({
  imports: [
    InjectionQueueModule,
    TypeOrmModule.forFeature([Document, DocumentChunk, DocumentPages]),
  ],
  providers: [RetrievalService],
  controllers: [RetrievalController],
})
export class RetrievalModule {}
