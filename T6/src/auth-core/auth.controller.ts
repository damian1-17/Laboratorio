import { Controller, Post, Body, Inject, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ValidateRequestDto, ValidateResponseDto } from 'src/shared';
import type { IAuthStrategy } from 'src/shared';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthClient } from './entities/oauth-client.entity';
import { OAuthToken } from './entities/oauth-token.entity';
import { createHash, randomBytes } from 'crypto';

/**
 * AuthController — Tratamiento T6 (OAuth 2.0 Client Credentials + ABAC)
 *
 * Endpoints:
 *   POST /auth/token    — OAuth 2.0 Token Endpoint (Client Credentials Grant, RFC 6749 §4.4).
 *                         El cliente presenta client_id + client_secret y recibe un
 *                         Access Token opaco (token de referencia, almacenado hasheado en BD).
 *   POST /auth/validate — Token Introspection (RFC 7662 simplificado).
 *                         Llamado internamente por el AuthMiddleware de MS-Data.
 *                         Valida el token opaco y aplica ABAC (verifica resourceOwnerId).
 *
 * Idéntico a T5 en su estructura — la diferencia es el guard inyectado:
 *   T5: RbacGuard (ignora resourceOwnerId → BOLA activo)
 *   T6: AbacGuard (evalúa resourceOwnerId → BOLA mitigado)
 */
@Controller('auth')
export class AuthController {
  constructor(
    @Inject('IAuthStrategy') private readonly strategy: any,
    @Inject('IAuthGuard') private readonly guard: any,
    @InjectRepository(OAuthClient) private readonly clientRepo: Repository<OAuthClient>,
    @InjectRepository(OAuthToken) private readonly tokenRepo: Repository<OAuthToken>,
  ) {}

  /**
   * POST /auth/token
   *
   * Body: { grant_type: "client_credentials", client_id: string, client_secret: string }
   *
   * Implementa Client Credentials Grant (RFC 6749 §4.4):
   *   1. Valida grant_type.
   *   2. Busca el cliente por client_name (= client_id en el request).
   *   3. Verifica client_secret: SHA-256(secret + OAUTH_SECRET) == client_secret_hash.
   *   4. Genera un Access Token opaco (32 bytes aleatorios en hex).
   *   5. Persiste SHA-256(token) en oauth_tokens con TTL.
   *   6. Devuelve el token en texto plano.
   *
   * Response exitosa (RFC 6749 §5.1):
   *   { access_token, token_type: "Bearer", expires_in: 900 }
   */
  @Post('token')
  async issueToken(
    @Body() body: { grant_type: string; client_id: string; client_secret: string; scope?: string },
  ): Promise<{ access_token: string; token_type: string; expires_in: number }> {
    const { grant_type, client_id, client_secret } = body;

    // Validar grant_type
    if (!grant_type || grant_type !== 'client_credentials') {
      throw new BadRequestException({
        error: 'unsupported_grant_type',
        error_description: 'Only "client_credentials" grant type is supported',
      });
    }

    if (!client_id || !client_secret) {
      throw new UnauthorizedException({
        error: 'invalid_request',
        error_description: 'client_id and client_secret are required',
      });
    }

    // Buscar cliente por client_name
    const client = await this.clientRepo.findOne({
      where: { client_name: client_id },
    });

    if (!client) {
      throw new UnauthorizedException({
        error: 'invalid_client',
        error_description: 'Invalid client credentials',
      });
    }

    if (!client.is_active) {
      throw new UnauthorizedException({
        error: 'invalid_client',
        error_description: 'Client is disabled',
      });
    }

    // Verificar client_secret: SHA-256(client_secret + OAUTH_SECRET)
    const oauthSecret = process.env.OAUTH_SECRET || '';
    const expectedHash = createHash('sha256')
      .update(client_secret + oauthSecret)
      .digest('hex');

    if (client.client_secret_hash !== expectedHash) {
      throw new UnauthorizedException({
        error: 'invalid_client',
        error_description: 'Invalid client credentials',
      });
    }

    // Generar Access Token opaco: 32 bytes aleatorios → 64 chars hex
    const tokenPlain = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(tokenPlain).digest('hex');

    const ttlSeconds = parseInt(process.env.TOKEN_TTL_SECONDS || '900', 10);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // Persistir el token hasheado en oauth_tokens
    const oauthToken = this.tokenRepo.create({
      token_hash: tokenHash,
      client_id: client.client_id,
      is_revoked: false,
      expires_at: expiresAt,
    });
    await this.tokenRepo.save(oauthToken);

    return {
      access_token: tokenPlain,
      token_type: 'Bearer',
      expires_in: ttlSeconds,
    };
  }

  /**
   * POST /auth/validate
   *
   * Body: ValidateRequestDto { credential, action, resource, resourceOwnerId }
   *
   * Llamado por el AuthMiddleware de MS-Data en cada request GraphQL.
   * 1. Introspecciona el Access Token opaco (OAuthTokenStrategy).
   * 2. Aplica ABAC (AbacGuard) — a diferencia de T5 (RbacGuard), el AbacGuard
   *    SÍ evalúa resourceOwnerId para mitigar BOLA (API1:2023).
   */
  @Post('validate')
  async validate(@Body() request: ValidateRequestDto): Promise<ValidateResponseDto> {
    const { credential, action, resource } = request;

    // 1. Introspección del token mediante OAuthTokenStrategy
    const authStrategy = this.strategy as IAuthStrategy;
    const payload = await authStrategy.validate(credential, action, resource);

    if (!payload.isValid) {
      return {
        isValid: false,
        error: payload.error || 'Authentication failed',
      };
    }

    // 2. Autorización mediante AbacGuard (evalúa rol + resourceOwnerId)
    const mockRequest = {
      body: {
        payload,
        action,
        resource,
        resourceOwnerId: (request as unknown as Record<string, unknown>).resourceOwnerId,
      },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const authGuard = this.guard as CanActivate;

    try {
      const isAuthorized = authGuard.canActivate(mockContext);
      if (!isAuthorized) {
        return { isValid: false, error: 'Forbidden by Guard' };
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Forbidden';
      return { isValid: false, error: message };
    }

    return {
      isValid: true,
      payload,
    };
  }
}

