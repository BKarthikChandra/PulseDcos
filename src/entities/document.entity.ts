import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Document {
  // Define your entity properties and methods here
  @PrimaryGeneratedColumn({ name: 'document_id' })
  id: number;

  @Column({ name: 'document_name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'document_path', type: 'varchar', length: 500 })
  path: string;

  @Column({ name: 'mimeType', type: 'varchar', length: 50 })
  mimeType: string;

  @Column({ name: 'status', type: 'varchar' })
  status: string;

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
