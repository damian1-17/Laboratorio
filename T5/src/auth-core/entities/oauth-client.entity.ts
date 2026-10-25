import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { OAuthToken } from './oauth-token.entity';

/**
 * OAuthClient — tabla `oauth_clients`
 *
 * Equivalente a la tabla `users` + `api_keys` de T1-T4, unificada bajo
 * la semántica OAuth 2.0 de "client". Cada cliente se autentica con
 * client_id (= client_name legible) + client_secret para obtener un
 * Access Token mediante el Client Credentials Grant.
 *
 * El client_secret nunca se almacena en texto plano:
 *   client_secret_hash = SHA-256(client_secret + OAUTH_SECRET)
 */
@Entity('oauth_clients')
export class OAuthClient {
  @PrimaryGeneratedColumn('uuid')
  client_id!: string;

  @Column({ unique: true })
  client_name!: string; // Identificador legible (= username en T1-T4)

  @Column()
  client_secret_hash!: string; // SHA-256(client_secret + OAUTH_SECRET)

  @Column()
  role!: string; // 'admin' | 'seller' | 'customer'

  @Column({ nullable: true })
  seller_id!: string; // FK lógica a sellers(seller_id) del dataset Olist

  @Column({ nullable: true })
  customer_id!: string; // FK lógica a customers(customer_id) del dataset Olist

  @Column({ default: true })
  is_active!: boolean; // false = cliente deshabilitado

  @CreateDateColumn()
  created_at!: Date;

  @OneToMany(() => OAuthToken, (token) => token.client)
  tokens!: OAuthToken[];
}
