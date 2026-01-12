import { Processor, Process } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bull';
import { Repository } from 'typeorm';

import { Document } from 'src/entities/document.entity';
import { DocumentPages } from 'src/entities/document.pages.entity';
import { DocumentChunk } from 'src/entities/document.chunks.entity';
import { In } from 'typeorm/browser';

@Processor('injectionQueue')
export class EmbedChunksProcessor {
  constructor(

    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,

    @InjectRepository(DocumentPages)
    private readonly documentPagesRepository: Repository<DocumentPages>,

    @InjectRepository(DocumentChunk)
    private readonly documentChunkRepository: Repository<DocumentChunk>,
  ) {}

@Process('embedJob')
    async handle(job: Job<{ documentId: number }>) {
        const { documentId } = job.data;
        const document = await this.documentRepository.findOne({
            where: { id: documentId , status: 'CHUNKED' },
        });
        const chunks = await this.documentChunkRepository.find({
            where: { documentId },
        });
    }
}