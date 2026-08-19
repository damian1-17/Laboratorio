import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { User } from '../entities/user.entity';
import { ApiKey } from '../entities/api-key.entity';

/**
 * SeedService ” Inserta usuarios y API Keys de prueba al arrancar la aplicacin.
 * Se ejecuta una sola vez si los registros no existen todavÃ­a.
 *
 * API Keys en texto plano para pruebas (se hashean con SHA-256 al insertar):
 *   admin       ’ tesis-admin-key-2026
 *   seller01    ’ tesis-seller01-key-2026
 *   customer01  ’ tesis-customer01-key-2026
 *   customer02  ’ tesis-customer02-key-2026
 *
 * Keys expiradas (is_active=true, expires_at pasada):
 *   customer01  ’ tesis-customer01-EXPIRED-key-2026
 *   customer02  ’ tesis-customer02-EXPIRED-key-2026
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) { }

  async onApplicationBootstrap(): Promise<void> {
    const count = await this.userRepo.count();
    if (count > 0) {
      this.logger.log('Seed ya ejecutado. Omitiendo...');
      return;
    }

    this.logger.log('Ejecutando seed de usuarios y API Keys...');

    // Keys expiradas ” user_id contiene el customer_id de Olist
    // Se resuelve al real UUID despuÃ©s de crear los usuarios
    const seedApiKeys: Array<{
      api_key: string;
      key_hash: string;
      customer_id_olist: string; // customer_id de Olist para resolver el user_id real
      is_active: boolean;
      expires_at: Date;
    }> = [
        //EXPIRED KEYS
        {
          api_key: 'tesis-customer01-EXPIRED-key-2026',
          key_hash: createHash('sha256').update('tesis-customer01-EXPIRED-key-2026').digest('hex'),
          customer_id_olist: '9ef432eb6251297304e76186b10a928d',
          is_active: true,
          expires_at: new Date('2026-06-01'),
        },
        {
          api_key: 'tesis-customer02-EXPIRED-key-2026',
          key_hash: createHash('sha256').update('tesis-customer02-EXPIRED-key-2026').digest('hex'),
          customer_id_olist: 'ed0271e0b7da060a393796590e7b737a',
          is_active: true,
          expires_at: new Date('2026-06-01'),
        },
        {
          api_key: 'tesis-customer03-EXPIRED-key-2026',
          key_hash: createHash('sha256').update('tesis-customer03-EXPIRED-key-2026').digest('hex'),
          customer_id_olist: '8886130db0ea6e9e70ba0b03d7c0d286',
          is_active: true,
          expires_at: new Date('2026-07-01'),
        },
        {
          api_key: 'tesis-customer04-EXPIRED-key-2026',
          key_hash: createHash('sha256').update('tesis-customer04-EXPIRED-key-2026').digest('hex'),
          customer_id_olist: '6d6b50b66d79f80827b6d96751528d30',
          is_active: true,
          expires_at: new Date('2026-07-01'),
        },
        {
          api_key: 'tesis-customer05-EXPIRED-key-2026',
          key_hash: createHash('sha256').update('tesis-customer05-EXPIRED-key-2026').digest('hex'),
          customer_id_olist: '65a227fbf7d798cdeadee8c0bea74993',
          is_active: true,
          expires_at: new Date('2026-07-01'),
        },

        //REVOKED KEYS
        {
          api_key: 'tesis-customer01-REVOKED-key-2026',
          key_hash: createHash('sha256').update('tesis-customer01-REVOKED-key-2026').digest('hex'),
          customer_id_olist: '9ef432eb6251297304e76186b10a928d',
          is_active: false,
          expires_at: new Date('2027-06-01'),
        },

        {
          api_key: 'tesis-customer02-REVOKED-key-2026',
          key_hash: createHash('sha256').update('tesis-customer02-REVOKED-key-2026').digest('hex'),
          customer_id_olist: 'ed0271e0b7da060a393796590e7b737a',
          is_active: false,
          expires_at: new Date('2027-06-01'),
        },
        {
          api_key: 'tesis-customer03-REVOKED-key-2026',
          key_hash: createHash('sha256').update('tesis-customer03-REVOKED-key-2026').digest('hex'),
          customer_id_olist: '8886130db0ea6e9e70ba0b03d7c0d286',
          is_active: false,
          expires_at: new Date('2027-06-01'),
        },
        {
          api_key: 'tesis-customer04-REVOKED-key-2026',
          key_hash: createHash('sha256').update('tesis-customer04-REVOKED-key-2026').digest('hex'),
          customer_id_olist: '6d6b50b66d79f80827b6d96751528d30',
          is_active: false,
          expires_at: new Date('2027-06-01'),
        },
        {
          api_key: 'tesis-customer05-REVOKED-key-2026',
          key_hash: createHash('sha256').update('tesis-customer05-REVOKED-key-2026').digest('hex'),
          customer_id_olist: '65a227fbf7d798cdeadee8c0bea74993',
          is_active: false,
          expires_at: new Date('2027-06-01'),
        },
      ];

    const seedData: Array<{
      username: string;
      role: string;
      seller_id?: string;
      customer_id?: string;
      plainKey: string;
    }> = [
        {
          username: 'admin',
          role: 'admin',
          plainKey: 'tesis-admin-key-2026',
        },
        {
          username: 'seller01',
          role: 'seller',
          seller_id: '3442f8959a84dea7ee197c632cb2df15',
          plainKey: 'tesis-seller01-key-2026',
        },
        {
          username: 'customer01',
          role: 'customer',
          customer_id: '9ef432eb6251297304e76186b10a928d',
          plainKey: 'tesis-customer01-key-2026',
        },
        {
          username: 'customer02',
          role: 'customer',
          customer_id: 'ed0271e0b7da060a393796590e7b737a',
          plainKey: 'tesis-customer02-key-2026',
        },
        {
          username: 'customer03',
          role: 'customer',
          customer_id: '8886130db0ea6e9e70ba0b03d7c0d286',
          plainKey: 'tesis-customer03-key-2026',
        },
        {
          username: 'customer04',
          role: 'customer',
          customer_id: '6d6b50b66d79f80827b6d96751528d30',
          plainKey: 'tesis-customer04-key-2026',
        },
        {
          username: 'customer05',
          role: 'customer',
          customer_id: '65a227fbf7d798cdeadee8c0bea74993',
          plainKey: 'tesis-customer05-key-2026',
        },
      ];

    // Mapa: customer_id de Olist ’ user_id UUID generado por la BD
    const customerIdToUserId = new Map<string, string>();

    for (const seed of seedData) {
      const user = this.userRepo.create({
        username: seed.username,
        role: seed.role,
        seller_id: seed.seller_id,
        customer_id: seed.customer_id,
      });
      const savedUser = await this.userRepo.save(user);

      // Guardar la relacin customer_id ’ user_id real para usarla despuÃ©s
      if (seed.customer_id) {
        customerIdToUserId.set(seed.customer_id, savedUser.user_id);
      }

      const keyHash = createHash('sha256').update(seed.plainKey).digest('hex');
      const apiKey = this.apiKeyRepo.create({
        key_hash: keyHash,
        user_id: savedUser.user_id,
        is_active: true,
      });
      await this.apiKeyRepo.save(apiKey);

      this.logger.log(`  âœ… ${seed.username} creado`);
    }

    // Insertar keys expiradas con sus user_ids correctos (fuera del loop de usuarios)
    for (const apikey of seedApiKeys) {
      const realUserId = customerIdToUserId.get(apikey.customer_id_olist);
      if (!realUserId) {
        this.logger.warn(`  âš ï¸ No se encontr user_id para customer_id: ${apikey.customer_id_olist}. Key expirada omitida.`);
        continue;
      }
      const expiredKey = this.apiKeyRepo.create({
        key_hash: apikey.key_hash,
        user_id: realUserId,
        is_active: apikey.is_active,
        expires_at: apikey.expires_at,
      });
      await this.apiKeyRepo.save(expiredKey);
      this.logger.log(`  â° Key expirada insertada para ${apikey.customer_id_olist}`);
    }

    this.logger.log('Seed completado.');
  }
}
