import { Processor, Process } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bull';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf';

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

    if (!document || document.status !== 'UPLOADED') return;

    try {
      document.status = 'PROCESSING';
      await this.documentRepository.save(document);

      const absolutePath = path.join(process.cwd(), document.path);

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
      }

      const data = new Uint8Array(fs.readFileSync(absolutePath));

      const loadingTask = pdfjs.getDocument({ data });
      const pdf = await loadingTask.promise;

      const pageEntities: DocumentPages[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();

        const text = content.items
          .map((item: any) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (!text) continue;

        pageEntities.push(
          this.documentPagesRepository.create({
            documentId: document.id,
            pageNumber: pageNum,
            rawText: text,
          }),
        );
      }

      if (!pageEntities.length) {
        throw new Error('No text extracted from PDF');
      }

      await this.documentPagesRepository.save(pageEntities);

      document.status = 'EXTRACTED';
      await this.documentRepository.save(document);

      console.log(
        `[INGESTION] Document ${documentId} extracted (${pageEntities.length} pages)`,
      );
    } catch (error) {
      console.error(`[INGESTION] Document ${documentId} failed`, error);

      document.status = 'FAILED';
      await this.documentRepository.save(document);
      throw error;
    }
  }
}
