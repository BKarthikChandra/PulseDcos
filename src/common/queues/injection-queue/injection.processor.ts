import { Processor, Process } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bull';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
// import * as pdfParse from 'pdf-parse';
// import pdfParse = require('pdf-parse');
import pdf from "pdf-parse-debugging-disabled";

import { Document } from 'src/entities/document.entity';
import { DocumentPages } from 'src/entities/document.pages.entity';

@Processor('injectionQueue')
export class InjectionProcessor {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,

    @InjectRepository(DocumentPages)
    private readonly documentPagesRepository: Repository<DocumentPages>,
  ) {}

  @Process('injectionJob')
  async handle(job: Job<{ documentId: number }>) {
    const { documentId } = job.data;

    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      console.error(`[INGESTION] Document ${documentId} not found`);
      return;
    }

    if (document.status !== 'UPLOADED') {
      console.warn(
        `[INGESTION] Document ${documentId} skipped (status=${document.status})`,
      );
      return;
    }

    try {
      document.status = 'PROCESSING';
      await this.documentRepository.save(document);

      const absolutePath = path.join(process.cwd(), document.path);

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found at ${absolutePath}`);
      }

      // const pdfBuffer = fs.readFileSync(absolutePath);

      // const parsed = await (pdfParse as any)(pdfBuffer);
      const parsed = await pdf(absolutePath);
      console.log(parsed);
      const pages = parsed.text
        .split('\f')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (!pages.length) {
        throw new Error('No text extracted from PDF');
      }

      // 🚀 Batch insert (not your original slow loop)
      const pageEntities = pages.map((text, i) =>
        this.documentPagesRepository.create({
          documentId: document.id,
          pageNumber: i + 1,
          rawText: text,
        }),
      );

      await this.documentPagesRepository.save(pageEntities);

      document.status = 'EXTRACTED';
      await this.documentRepository.save(document);

      console.log(
        `[INGESTION] Document ${documentId} extracted (${pages.length} pages)`,
      );
    } catch (error) {
      console.error(
        `[INGESTION] Document ${documentId} failed:`,
        error.message,
      );

      document.status = 'FAILED';
      await this.documentRepository.save(document);

      throw error;
    }
  }
}
