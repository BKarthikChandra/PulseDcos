import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

export enum ChunkStatus {
  PENDING = 'PENDING',
  EMBEDDED = 'EMBEDDED',
  FAILED = 'FAILED',
}

@Entity({ name: 'document_chunks' })
@Index('idx_chunks_document', ['documentId'])
@Index('idx_chunks_doc_chunk', ['documentId', 'chunkIndex'])
export class DocumentChunk {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'document_id', type: 'int' })
  documentId: number;

  @Column({ name: 'page_start', type: 'int' })
  pageStart: number;

  @Column({ name: 'page_end', type: 'int' })
  pageEnd: number;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  @Column({ type: 'jsonb', nullable: true })
  sectionPath: string[]; 
  // ["Authentication", "JWT Tokens"]

  @Column({ name: 'section_title', type: 'text', nullable: true })
  sectionTitle: string;

  @Column({ name: 'chunk_text', type: 'text' })
  chunkText: string;

  // Critical for RAG pipeline control
  @Column({ name: 'token_count', type: 'int' , nullable : true })
  tokenCount: number;

  /**
   * pgvector column
   * Must be created as: embedding vector(1536)
   */
  @Column({ name: 'embedding', type: 'vector', length: 1536, nullable: true })
  embedding: number[];

  @Column({ name: 'status', type: 'varchar', default: ChunkStatus.PENDING })
  status: ChunkStatus;

  @Column({
    name: 'created_on',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdOn: Date;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number;

  @Column({ name: 'updated_on', type: 'timestamp', nullable: true })
  updatedOn: Date;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy: number;
}
