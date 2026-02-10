import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job, Queue } from 'bull';
import { Repository } from 'typeorm';

import { Document } from 'src/entities/document.entity';
import { DocumentPages } from 'src/entities/document.pages.entity';
import {
  DocumentChunk,
  ChunkStatus,
} from 'src/entities/document.chunks.entity';
import { createHash } from 'crypto';

/* ---------------------------------- */
/* TEXT CLEANING ENGINE               */
/* ---------------------------------- */

class TextCleaner {
  clean(raw: string): string {
    let text = raw;

    text = text.normalize('NFKC'); // Normalize Unicode to ensure visually identical characters are treated the same
    text = text.replace(/\r\n/g, '\n'); // Convert Windows line endings to Unix-style
    text = text.replace(/[^\S\r\n]+/g, ' '); // Collapse horizontal whitespace while preserving newlines
    text = this.mergeWrappedLines(text); // Join lines broken by extraction wrapping (lossy, heuristic-based)
    text = text.replace(/\n{3,}/g, '\n\n').trim(); // Limit excessive blank lines and trim edges

    return text;
  }

  private mergeWrappedLines(text: string): string {
    const lines = text.split('\n');
    const buffer: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const current = lines[i].trim();
      const next = lines[i + 1]?.trim();

      if (current && next && !/[.:;]$/.test(current) && /^[a-z]/.test(next)) {
        buffer.push(current + ' ');
      } else {
        buffer.push(current + '\n');
      }
    }

    return buffer.join('').replace(/ \n/g, '\n');
  }
}

/* ---------------------------------- */
/* TOKEN ESTIMATOR (cheap + fast)     */
/* ---------------------------------- */

class TokenEstimator {
  estimate(text: string): number {
    // rough but reliable heuristic: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}

/* ---------------------------------- */
/* DOCUMENT CHUNKER                   */
/* ---------------------------------- */

class DocumentChunker {
  private readonly MAX_TOKENS = 500;

  private readonly estimator = new TokenEstimator();

  private buildChunkIdentity(input: {
    chunkText: string;
    pageStart: number;
    pageEnd: number;
    chunkIndex: number;
  }) {
    return [
      input.pageStart,
      input.pageEnd,
      input.chunkIndex,
      input.chunkText,
    ].join('|');
  }

  private hashChunk(identity: string): string {
    return createHash('sha256').update(identity, 'utf8').digest('hex');
  }

  build(pages: DocumentPages[]) {
    const chunks: Array<{
      chunkText: string;
      pageStart: number;
      pageEnd: number;
      chunkIndex: number;
      tokenCount: number;
      chunkHash: string;
      status: ChunkStatus;
    }> = [];

    let index = 0;
    let buffer = '';
    let bufferTokens = 0;
    let startPage = pages[0].pageNumber;

    for (const page of pages) {
      const paragraphs = page.cleanedText
        .split('\n\n')
        .map((p) => p.trim())
        .filter(Boolean);

      for (const paragraph of paragraphs) {
        const tokens = this.estimator.estimate(paragraph);

        if (bufferTokens + tokens > this.MAX_TOKENS && buffer) {
          const identity = this.buildChunkIdentity({
            chunkText: buffer.trim(),
            pageStart: startPage,
            pageEnd: page.pageNumber,
            chunkIndex: index,
          });
          chunks.push({
            chunkText: buffer.trim(),
            pageStart: startPage,
            pageEnd: page.pageNumber,
            chunkIndex: index++,
            tokenCount: bufferTokens,
            status: ChunkStatus.PENDING,
            chunkHash: this.hashChunk(identity),
          });

          buffer = '';
          bufferTokens = 0;
          startPage = page.pageNumber;
        }

        buffer += paragraph + '\n\n';
        bufferTokens += tokens;
      }
    }

    if (buffer) {
      const identity = this.buildChunkIdentity({
        chunkText: buffer.trim(),
        pageStart: startPage,
        pageEnd: pages[pages.length - 1].pageNumber,
        chunkIndex: index,
      });
      chunks.push({
        chunkText: buffer.trim(),
        pageStart: startPage,
        pageEnd: pages[pages.length - 1].pageNumber,
        chunkIndex: index++,
        tokenCount: bufferTokens,
        status: ChunkStatus.PENDING,
        chunkHash: this.hashChunk(identity),
      });
    }

    return chunks;
  }
}

/* ---------------------------------- */
/* QUEUE PROCESSOR                    */
/* ---------------------------------- */

@Processor('injectionQueue')
export class ProcessProcessor {
  constructor(
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,

    @InjectRepository(DocumentPages)
    private readonly pages: Repository<DocumentPages>,

    @InjectRepository(DocumentChunk)
    private readonly chunks: Repository<DocumentChunk>,

    @InjectQueue('injectionQueue') private readonly injectionQueue: Queue,
  ) {}

  private hashText(rawText: string): string {
    return createHash('sha256').update(rawText, 'utf8').digest('hex');
  }

  @Process('processJob')
  async handle(job: Job<{ documentId: number }>) {
    const { documentId } = job.data;

    const document = await this.documents.findOne({
      where: { id: documentId, status: 'EXTRACTED' },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not ready for processing`);
    }

    const pages = await this.pages.find({
      where: { documentId },
      order: { pageNumber: 'ASC' },
    });

    if (!pages.length) {
      throw new Error(`No pages found for document ${documentId}`);
    }

    // Clean
    const cleaner = new TextCleaner();
    const BATCH_SIZE = 100;

    for (let i = 0; i < pages.length; i += BATCH_SIZE) {
      const batch = pages.slice(i, i + BATCH_SIZE);

      for (const page of batch) {
        page.cleanedText = cleaner.clean(page.rawText);
        page.cleanHash = this.hashText(page.cleanedText);
      }

      await this.pages.save(batch);
    }

    await this.documents.update(documentId, { status: 'CLEANED' });

    // Chunk
    const chunker = new DocumentChunker();
    const chunkData = chunker.build(pages);

    const entities = chunkData.map((data) =>
      this.chunks.create({ documentId, ...data }),
    );

    await this.chunks.upsert(entities, {
      conflictPaths: ['documentId', 'chunkHash'],
    });

    await this.documents.update(documentId, { status: 'CHUNKED' });

    await this.injectionQueue.add(
      'embedJob',
      { documentId: document.id },
      {
        attempts: 1,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      },
    );

    console.log(
      `[PROCESS] Document ${documentId} chunked into ${chunkData.length} chunks`,
    );
  }
}
