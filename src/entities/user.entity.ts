import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  id: number;

  @Column({ name: 'username', unique: true, type: 'varchar', length: 50 })
  username: string;

  @Column({ name: 'email', unique: true, type: 'varchar', length: 100 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  @Column({
    name: 'created_on',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdOn: Date;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number;

  @Column({
    name: 'updated_on',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedOn: Date;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy: number;
}
