import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { IAuthStrategy, AuthPayload } from '../../shared';
import { ApiKey } from '../entities/api-key.entity';

/**
 * ApiKeyStrategy ” Tratamientos T1 y T2 (API Key + RBAC/ABAC).
 *
 * El valor recibido en `credential` es la API Key en texto plano.
 * Se hashea con SHA-256 y se consulta la tabla `api_keys` en PostgreSQL.
 * Si la key existe, estÃ¡ activa y no ha expirado, retorna el payload del usuario.
 */
@Injectable()
export class ApiKeyStrategy implements IAuthStrategy {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) { }

  async validate(credential: string): Promise<AuthPayload> {
    const keyHash = createHash('sha256').update(credential).digest('hex');

    // Paso 1: buscar la key por hash sin filtrar is_active
    // Esto permite distinguir ESC-05 (no existe) de ESC-06 (revocada)
    const apiKey = await this.apiKeyRepository.findOne({
      where: { key_hash: keyHash },
      relations: { user: true },
    });

    if (!apiKey) {
      // ESC-05: hash no encontrado ’ key adulterada o inventada
      return { isValid: false, error: 'Invalid API Key' };
    }

    if (!apiKey.is_active) {
      // ESC-06: key existe pero fue revocada explÃ­citamente
      return { isValid: false, error: 'API Key revoked' };
    }

    if (apiKey.expires_at && apiKey.expires_at < new Date()) {
      // ESC-04: key existe y estÃ¡ activa pero su tiempo de vida venci
      return { isValid: false, error: 'API Key expired' };
    }

    return {
      isValid: true,
      user_id: apiKey.user.user_id,
      role: apiKey.user.role,
      customer_id: apiKey.user.customer_id ?? undefined,
      seller_id: apiKey.user.seller_id ?? undefined,
      api_key_id: apiKey.api_key_id,
    };
  }
}
