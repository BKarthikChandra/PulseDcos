import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Document } from 'src/entities/document.entity';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { InjectQueue } from '@nestjs/bull';
import type  { Queue } from 'bull';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,

    @InjectQueue('injectionQueue') private readonly injectionQueue: Queue,
  ) {}

  async uploadDocument(file: {
    buffer: Buffer;
    size: number;
    mimeType: string;
    originalName: string;
  }) {
    if (!file || !file.buffer) {
      throw new InternalServerErrorException('Invalid file');
    }

   
    const uploadDir = path.join(process.cwd(), 'uploads');

  
    await fs.promises.mkdir(uploadDir, { recursive: true });

   
    const safeName = `${randomUUID()}-${file.originalName}`;
    const filePath = path.join(uploadDir, safeName);

   
    await fs.promises.writeFile(filePath, file.buffer);

   
    const document = new Document();
    document.name = file.originalName;
    document.path = `/uploads/${safeName}`;
    document.mimeType = file.mimeType;
    document.status = 'UPLOADED';
    document.createdBy = 1;

    const savedDocument = await this.documentRepository.save(document);

    await this.injectionQueue.add('injectionJob', { documentId: savedDocument.id } ,  {
      attempts: 5,
      backoff: {type: 'exponential', delay: 5000},
      removeOnComplete: true,
    });

    return { message : 'File uploaded successfully', documentId: savedDocument.id};
  }
  

}
