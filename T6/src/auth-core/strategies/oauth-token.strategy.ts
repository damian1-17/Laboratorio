import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { IAuthStrategy, AuthPayload } from '../../shared';
import { OAuthToken } from '../entities/oauth-token.entity';

/**
 * OAuthTokenStrategy — Tratamiento T6 (OAuth 2.0 + ABAC)
 *
 * Implementa la introspección de token opaco (RFC 7662 simplificado).
 * En lugar de verificar una firma (JWT), busca el hash SHA-256 del
 * Access Token presentado en la tabla oauth_tokens.
 *
 * Idéntica a T5 — la diferencia entre T5 y T6 está exclusivamente
 * en el guard (RbacGuard vs AbacGuard), no en la estrategia.
 *
 * Errores de autenticación cubiertos:
 *   - BA-01: Token expirado (expires_at < now)   → "Access Token expired"
 *   - BA-02: Token no registrado / falsificado   → "Invalid Access Token"
 *   - BA-03: Token revocado (is_revoked = true)  → "Access Token revoked"
 *   - BA-04: Manipulación del token — cualquier
 *            alteración produce un hash distinto  → "Invalid Access Token"
 */
@Injectable()
export class OAuthTokenStrategy implements IAuthStrategy {
  constructor(
    @InjectRepository(OAuthToken)
    private readonly tokenRepo: Repository<OAuthToken>,
  ) {}

  async validate(credential: string): Promise<AuthPayload> {
    // 1. Calcular SHA-256 del token presentado por el cliente
    const tokenHash = createHash('sha256').update(credential).digest('hex');

    // 2. Buscar en oauth_tokens; cargar la relación client para obtener rol y IDs
    const token = await this.tokenRepo.findOne({
      where: { token_hash: tokenHash },
      relations: ['client'],
    });

    if (!token) {
      return { isValid: false, error: 'Invalid Access Token' };
    }

    // BA-03: Token revocado
    if (token.is_revoked) {
      return { isValid: false, error: 'Access Token revoked' };
    }

    // BA-01: Token expirado
    if (token.expires_at < new Date()) {
      return { isValid: false, error: 'Access Token expired' };
    }

    return {
      isValid: true,
      user_id: token.client.client_id,
      role: token.client.role,
      customer_id: token.client.customer_id ?? undefined,
      seller_id: token.client.seller_id ?? undefined,
      api_key_id: token.token_id, // reutilizamos api_key_id del tipo AuthPayload para token_id
    };
  }
}

