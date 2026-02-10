import { Processor, Process } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bull';
import { Repository } from 'typeorm';
import { GoogleGenAI } from '@google/genai';
import { ChunkEmbeddings } from 'src/entities/chunk.embeddings.entity';

import { Document } from 'src/entities/document.entity';
import {
  DocumentChunk,
  ChunkStatus,
} from 'src/entities/document.chunks.entity';

@Processor('injectionQueue')
export class EmbedChunksProcessor {
  private readonly ai = new GoogleGenAI({});

  constructor(
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,

    @InjectRepository(DocumentChunk)
    private readonly chunks: Repository<DocumentChunk>,
  ) {}

  @Process('embedJob')
  async handle(job: Job<{ documentId: number }>) {
    const { documentId } = job.data;

    // 1. Fetch document (status gate only, not a lock)
    const document = await this.documents.findOne({
      where: { id: documentId, status: 'CHUNKED' },
    });
    if (!document) return;

    // 2. Load ONLY chunks that do NOT already have embeddings

    const chunks = await this.chunks
      .createQueryBuilder('chunk')
      .leftJoin(
        ChunkEmbeddings,
        'embedding',
        'embedding.chunkId = chunk.id AND embedding.modelName = :model',
        { model: 'gemini-embedding-001' },
      )
      .where('chunk.documentId = :documentId', { documentId })
      .andWhere('chunk.status = :status', { status: ChunkStatus.PENDING })
      .andWhere('embedding.id IS NULL')
      .orderBy('chunk.chunkIndex', 'ASC')
      .getMany()
      .catch((error) => {
        console.error('Error fetching chunks:', error);
        throw error;
      });

    if (!chunks.length) return;

    const BATCH_SIZE = 50;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      const contents = batch.map((c) => ({
        role: 'user',
        parts: [{ text: c.chunkText }],
      }));

      const response = await this.ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents,
      });

      const embeddings = response.embeddings;
      if (!embeddings || embeddings.length !== batch.length) {
        throw new Error(
          `Invalid embedding response: expected ${batch.length}, got ${embeddings?.length ?? 0}`,
        );
      }

      // 3. Atomic write: embedding insert + chunk status update
      await this.chunks.manager.transaction(async (manager) => {
        for (let j = 0; j < batch.length; j++) {
          await manager
            .createQueryBuilder()
            .insert()
            .into(ChunkEmbeddings)
            .values({
              chunkId: batch[j].id,
              modelName: 'gemini-embedding-001',
              embedding: embeddings[j].values,
              createdBy: 1,
            })
            .orIgnore() // handles retries safely
            .execute();

          await manager.update(
            DocumentChunk,
            { id: batch[j].id },
            { status: ChunkStatus.EMBEDDED },
          );
        }
      });
    }

    // 4. Final document status update
    const remaining = await this.chunks.count({
      where: { documentId, status: ChunkStatus.PENDING },
    });

    if (remaining === 0) {
      await this.documents.update(documentId, { status: 'EMBEDDED' });
    }

    console.log(`[PROCESS] Document ${documentId} embedded`);
  }
}
