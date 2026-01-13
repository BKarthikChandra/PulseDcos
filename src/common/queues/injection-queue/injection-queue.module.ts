import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { InjectionProcessor } from './injection.processor';
import { Document } from 'src/entities/document.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentPages } from 'src/entities/document.pages.entity';
import { ProcessProcessor } from './process.processor';
import { DocumentChunk } from 'src/entities/document.chunks.entity';
import { EmbedChunksProcessor } from './embed.chunks.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentPages, DocumentChunk]),
    BullModule.registerQueue({ name: 'injectionQueue' }),
  ],
  providers: [InjectionProcessor, ProcessProcessor, EmbedChunksProcessor],
  exports: [BullModule],
})
export class InjectionQueueModule {}
