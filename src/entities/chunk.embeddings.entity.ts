import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';



@Entity('chunk_embeddings')
@Index(['chunkId'])
@Index(['chunkId', 'modelName'], { unique: true })
export class ChunkEmbeddings {
  @PrimaryGeneratedColumn({ name: 'chunk_embedding_id' })
  id: number;

  @Column({ name: 'chunk_id', type: 'int' })
  chunkId: number;

  @Column({
    name: 'model_name',
    type: 'varchar',
    length: 100,
  })
  modelName: string;

 
  @Column({ name: 'embedding', type: 'vector', length: 3072 })
  embedding: number[];

  

  @CreateDateColumn({
    name: 'created_on',
    type: 'timestamp',
  })
  createdOn: Date;

  @Column({
    name: 'created_by',
    type: 'int',
    nullable: true,
  })
  createdBy?: number;

  @UpdateDateColumn({
    name: 'updated_on',
    type: 'timestamp',
  })
  updatedOn: Date;

  @Column({
    name: 'updated_by',
    type: 'int',
    nullable: true,
  })
  updatedBy?: number;
}
