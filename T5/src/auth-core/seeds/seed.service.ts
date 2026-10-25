import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { OAuthClient } from '../entities/oauth-client.entity';
import { OAuthToken } from '../entities/oauth-token.entity';

/**
 * SeedService — T5 (OAuth 2.0 + RBAC)
 *
 * Inserta clientes OAuth y tokens de prueba al arrancar la aplicación.
 * Se ejecuta una sola vez si oauth_clients está vacía.
 *
 * client_secrets en texto plano (idénticos a las API Keys de T1-T4 para
 * mantener paridad en el script de experimento):
 *   admin       → tesis-admin-key-2026
 *   seller01    → tesis-seller01-key-2026
 *   customer01  → tesis-customer01-key-2026
 *   ...
 *   customer05  → tesis-customer05-key-2026
 *
 * Tokens pre-insertados para escenarios de ataque:
 *   BA-01: tokens con expires_at pasado (2026-06 / 2026-07)
 *   BA-03: tokens con is_revoked = true (expires_at 2027)
 *
 * Almacenamiento:
 *   client_secret_hash = SHA-256(client_secret + OAUTH_SECRET)
 *   token_hash         = SHA-256(token_plaintext)
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(OAuthClient)
    private readonly clientRepo: Repository<OAuthClient>,
    @InjectRepository(OAuthToken)
    private readonly tokenRepo: Repository<OAuthToken>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const count = await this.clientRepo.count();
    if (count > 0) {
      this.logger.log('Seed ya ejecutado. Omitiendo...');
      return;
    }

    this.logger.log('Ejecutando seed de OAuth clients y tokens...');

    const oauthSecret = process.env.OAUTH_SECRET || '';

    // ── Datos de clientes ─────────────────────────────────────────────────────
    const seedClients: Array<{
      client_name: string;
      client_secret: string;
      role: string;
      seller_id?: string;
      customer_id?: string;
    }> = [
      {
        client_name: 'admin',
        client_secret: 'tesis-admin-key-2026',
        role: 'admin',
      },
      {
        client_name: 'seller01',
        client_secret: 'tesis-seller01-key-2026',
        role: 'seller',
        seller_id: '3442f8959a84dea7ee197c632cb2df15',
      },
      {
        client_name: 'customer01',
        client_secret: 'tesis-customer01-key-2026',
        role: 'customer',
        customer_id: '9ef432eb6251297304e76186b10a928d',
      },
      {
        client_name: 'customer02',
        client_secret: 'tesis-customer02-key-2026',
        role: 'customer',
        customer_id: 'ed0271e0b7da060a393796590e7b737a',
      },
      {
        client_name: 'customer03',
        client_secret: 'tesis-customer03-key-2026',
        role: 'customer',
        customer_id: '8886130db0ea6e9e70ba0b03d7c0d286',
      },
      {
        client_name: 'customer04',
        client_secret: 'tesis-customer04-key-2026',
        role: 'customer',
        customer_id: '6d6b50b66d79f80827b6d96751528d30',
      },
      {
        client_name: 'customer05',
        client_secret: 'tesis-customer05-key-2026',
        role: 'customer',
        customer_id: '65a227fbf7d798cdeadee8c0bea74993',
      },
    ];

    // Mapa: customer_id de Olist → client_id UUID generado por la BD
    const customerIdToClientId = new Map<string, string>();

    for (const seed of seedClients) {
      const secretHash = createHash('sha256')
        .update(seed.client_secret + oauthSecret)
        .digest('hex');

      const client = this.clientRepo.create({
        client_name: seed.client_name,
        client_secret_hash: secretHash,
        role: seed.role,
        seller_id: seed.seller_id,
        customer_id: seed.customer_id,
        is_active: true,
      });
      const savedClient = await this.clientRepo.save(client);

      if (seed.customer_id) {
        customerIdToClientId.set(seed.customer_id, savedClient.client_id);
      }

      this.logger.log(`  ✅ Cliente ${seed.client_name} creado`);
    }

    // ── Tokens pre-expirados (BA-01) ─────────────────────────────────────────
    // Tokens con expires_at pasado (2026-06/07). El texto plano es conocido
    // por el script de experimento para usarlos directamente en /auth/validate.
    const expiredTokens: Array<{
      plainToken: string;
      customer_id_olist: string;
      expires_at: Date;
    }> = [
      {
        plainToken: 'tesis-customer01-EXPIRED-token-2026',
        customer_id_olist: '9ef432eb6251297304e76186b10a928d',
        expires_at: new Date('2026-06-01'),
      },
      {
        plainToken: 'tesis-customer02-EXPIRED-token-2026',
        customer_id_olist: 'ed0271e0b7da060a393796590e7b737a',
        expires_at: new Date('2026-06-01'),
      },
      {
        plainToken: 'tesis-customer03-EXPIRED-token-2026',
        customer_id_olist: '8886130db0ea6e9e70ba0b03d7c0d286',
        expires_at: new Date('2026-07-01'),
      },
      {
        plainToken: 'tesis-customer04-EXPIRED-token-2026',
        customer_id_olist: '6d6b50b66d79f80827b6d96751528d30',
        expires_at: new Date('2026-07-01'),
      },
      {
        plainToken: 'tesis-customer05-EXPIRED-token-2026',
        customer_id_olist: '65a227fbf7d798cdeadee8c0bea74993',
        expires_at: new Date('2026-07-01'),
      },
    ];

    for (const t of expiredTokens) {
      const realClientId = customerIdToClientId.get(t.customer_id_olist);
      if (!realClientId) {
        this.logger.warn(`  ⚠️ No se encontró client_id para customer_id: ${t.customer_id_olist}. Token expirado omitido.`);
        continue;
      }
      const tokenHash = createHash('sha256').update(t.plainToken).digest('hex');
      const expiredToken = this.tokenRepo.create({
        token_hash: tokenHash,
        client_id: realClientId,
        is_revoked: false,
        expires_at: t.expires_at,
      });
      await this.tokenRepo.save(expiredToken);
      this.logger.log(`  ⏰ Token expirado (BA-01) insertado para ${t.customer_id_olist}`);
    }

    // ── Tokens pre-revocados (BA-03) ─────────────────────────────────────────
    // Tokens con is_revoked = true. El expires_at es 2027 (aún vigente)
    // para que el rechazo sea por revocación, no por expiración.
    const revokedTokens: Array<{
      plainToken: string;
      customer_id_olist: string;
    }> = [
      {
        plainToken: 'tesis-customer01-REVOKED-token-2026',
        customer_id_olist: '9ef432eb6251297304e76186b10a928d',
      },
      {
        plainToken: 'tesis-customer02-REVOKED-token-2026',
        customer_id_olist: 'ed0271e0b7da060a393796590e7b737a',
      },
      {
        plainToken: 'tesis-customer03-REVOKED-token-2026',
        customer_id_olist: '8886130db0ea6e9e70ba0b03d7c0d286',
      },
      {
        plainToken: 'tesis-customer04-REVOKED-token-2026',
        customer_id_olist: '6d6b50b66d79f80827b6d96751528d30',
      },
      {
        plainToken: 'tesis-customer05-REVOKED-token-2026',
        customer_id_olist: '65a227fbf7d798cdeadee8c0bea74993',
      },
    ];

    for (const t of revokedTokens) {
      const realClientId = customerIdToClientId.get(t.customer_id_olist);
      if (!realClientId) {
        this.logger.warn(`  ⚠️ No se encontró client_id para customer_id: ${t.customer_id_olist}. Token revocado omitido.`);
        continue;
      }
      const tokenHash = createHash('sha256').update(t.plainToken).digest('hex');
      const revokedToken = this.tokenRepo.create({
        token_hash: tokenHash,
        client_id: realClientId,
        is_revoked: true,
        expires_at: new Date('2027-06-01'),
      });
      await this.tokenRepo.save(revokedToken);
      this.logger.log(`  🚫 Token revocado (BA-03) insertado para ${t.customer_id_olist}`);
    }

    this.logger.log('Seed T5 completado.');
  }
}
