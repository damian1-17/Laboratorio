import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OAuthClient } from './oauth-client.entity';

/**
 * OAuthToken — tabla `oauth_tokens`
 *
 * Almacena los Access Tokens emitidos por el endpoint /auth/token.
 * El token en texto plano NUNCA se persiste — solo se guarda su hash SHA-256.
 *
 * Ciclo de vida:
 *   1. /auth/token genera token = randomBytes(32).hex()
 *   2. Calcula token_hash = SHA-256(token) y persiste en esta tabla
 *   3. Devuelve el token en texto plano al cliente (única vez)
 *   4. /auth/validate calcula SHA-256(credential) y busca en esta tabla
 *
 * Idéntica a T5 — sin cambios.
 */
@Entity('oauth_tokens')
export class OAuthToken {
  @PrimaryGeneratedColumn('uuid')
  token_id!: string;

  @Column({ unique: true })
  token_hash!: string; // SHA-256 del Access Token real

  @Column()
  client_id!: string; // FK -> oauth_clients.client_id

  @Column({ default: false })
  is_revoked!: boolean; // true = token revocado explícitamente

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'timestamp' })
  expires_at!: Date; // created_at + TOKEN_TTL_SECONDS

  @ManyToOne(() => OAuthClient, (client) => client.tokens, { eager: false })
  @JoinColumn({ name: 'client_id' })
  client!: OAuthClient;
}

