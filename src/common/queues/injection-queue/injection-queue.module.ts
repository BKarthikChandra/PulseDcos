import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { InjectionProcessor } from './injection.processor';
import { Document } from 'src/entities/document.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentPages } from 'src/entities/document.pages.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentPages]),
    BullModule.registerQueue({ name: 'injectionQueue' }),
  ],
  providers: [InjectionProcessor],
  exports: [BullModule],
})
export class InjectionQueueModule {}
