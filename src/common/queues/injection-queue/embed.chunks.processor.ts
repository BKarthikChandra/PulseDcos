import { Processor, Process } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bull';
import { Repository } from 'typeorm';
import OpenAI from 'openai';

import { Document } from 'src/entities/document.entity';
import { DocumentChunk, ChunkStatus } from 'src/entities/document.chunks.entity';

@Processor('injectionQueue')
export class EmbedChunksProcessor {
  private readonly openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  constructor(
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,

    @InjectRepository(DocumentChunk)
    private readonly chunks: Repository<DocumentChunk>,
  ) {}

  @Process('embedJob')
  async handle(job: Job<{ documentId: number }>) {
    const { documentId } = job.data;

    const document = await this.documents.findOne({
      where: { id: documentId, status: 'CHUNKED' },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not ready for embedding`);
    }

    const chunks = await this.chunks.find({
      where: { documentId, status: ChunkStatus.PENDING },
      order: { chunkIndex: 'ASC' },
    });

    if (!chunks.length) {
      console.log(`[EMBED] No pending chunks for document ${documentId}`);
      return;
    }

    const inputs = chunks.map(c => c.chunkText);

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: inputs,
      });

      for (let i = 0; i < chunks.length; i++) {
        chunks[i].embedding = response.data[i].embedding;
        chunks[i].status = ChunkStatus.EMBEDDED;
      }

      await this.chunks.save(chunks);

      // Verify all chunks are embedded
      const remaining = await this.chunks.count({
        where: { documentId, status: ChunkStatus.PENDING },
      });

      if (remaining === 0) {
        await this.documents.update(documentId, { status: 'EMBEDDED' });
      }

      console.log(`[EMBED] Embedded ${chunks.length} chunks for document ${documentId}`);
    } catch (error) {
      console.error(`[EMBED] Failed for document ${documentId}`, error);

      for (const chunk of chunks) {
        chunk.status = ChunkStatus.FAILED;
      }

      await this.chunks.save(chunks);
      throw error;
    }
  }
}
