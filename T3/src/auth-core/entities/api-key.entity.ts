import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  api_key_id!: string;

  @Column({ unique: true })
  key_hash!: string; // SHA-256 del valor real de la API Key

  @Column()
  user_id!: string;

  @Column({ default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ nullable: true, type: 'timestamp' })
  expires_at!: Date;

  @ManyToOne(() => User, (user) => user.api_keys, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
