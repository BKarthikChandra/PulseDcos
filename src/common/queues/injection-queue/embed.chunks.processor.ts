import { Processor, Process } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bull';
import { Repository } from 'typeorm';
import { GoogleGenAI } from '@google/genai';

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
   
    // 1. Lock the document so only one worker can embed it
    const document = await this.documents.findOne({
      where: { id: documentId, status: 'CHUNKED' },
    });
 
    if (!document) return;

    // 2. Load all pending chunks
    const chunks = await this.chunks.find({
      where: { documentId, status: ChunkStatus.PENDING },
      order: { chunkIndex: 'ASC' },
    });

    if (!chunks.length) return;

    const BATCH_SIZE = 50;

    // 3. Process in safe batches
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      const contents = batch.map((c) => ({
        role: 'user',
        parts: [{ text: c.chunkText }],
      }));
      console.log(`[EMBED] Processing batch of ${batch.length} chunks`);
      const response = await this.ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents,
      });
    
      // 4. Validate response before touching the DB
      const embeddings = response.embeddings;
      
      if (!embeddings || embeddings.length !== batch.length) {
        throw new Error(
          `Invalid embedding response: expected ${batch.length}, got ${embeddings?.length ?? 0}`,
        );
      }
      console.log(`[EMBED] Received ${embeddings.length} embeddings`);
      // 5. Atomic write for this batch
      try {
        await this.chunks.manager.transaction(async (manager) => {
          for (let j = 0; j < batch.length; j++) {
            await manager.update(
              DocumentChunk,
              { id: batch[j].id },
              {
                embedding: embeddings[j].values,
                status: ChunkStatus.EMBEDDED,
                embeddingModel: 'gemini-embedding-001',
              },
            );
          }
        });
      } catch (err) {
        console.error('EMBED TRANSACTION FAILED:', err);
        throw err;
      }
    }

    console.log(`[EMBED] Completed embedding for document ${documentId}`);
    // 6. Mark document as embedded if nothing remains
    const remaining = await this.chunks.count({
      where: { documentId, status: ChunkStatus.PENDING },
    });

    if (remaining === 0) {
      await this.documents.update(documentId, { status: 'EMBEDDED' });
    }

    console.log(`[EMBED] Document ${documentId} fully embedded`);
  }
}
