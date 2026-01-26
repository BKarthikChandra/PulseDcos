import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('document_pages')
@Unique(['documentId', 'pageNumber'])
export class DocumentPages {
  @PrimaryGeneratedColumn({ name: 'document_page_id' })
  documentPageId: number;

  @Column({ name: 'document_id', type: 'int' })
  documentId: number;

  @Column({ name: 'page_number', type: 'int' })
  pageNumber: number;

  @Column({ name: 'raw_text', type: 'text' })
  rawText: string;

  @Column({ name: 'raw_hash', type: 'text', nullable: true })
  rawHash: string;

  @Column({ type: 'text', nullable: true })
  cleanedText: string;

  @Column({ name: 'clean_hash', type: 'text', nullable: true })
  cleanHash: string;

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
