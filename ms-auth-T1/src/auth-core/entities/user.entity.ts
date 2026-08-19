import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiKey } from './api-key.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id!: string;

  @Column({ unique: true })
  username!: string;

  @Column()
  role!: string; // 'admin' | 'seller' | 'customer'

  @Column({ nullable: true })
  seller_id!: string; // FK lógica a sellers(seller_id) del dataset Olist

  @Column({ nullable: true })
  customer_id!: string; // FK lógica a customers(customer_id) del dataset Olist

  @CreateDateColumn()
  created_at!: Date;

  @OneToMany(() => ApiKey, (apiKey) => apiKey.user)
  api_keys!: ApiKey[];
}
