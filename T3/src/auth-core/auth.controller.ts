import { Controller, Post, Body, Inject, UnauthorizedException } from '@nestjs/common';
import { ValidateRequestDto, ValidateResponseDto } from '../shared';
import type { IAuthStrategy } from '../shared';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { ApiKey } from './entities/api-key.entity';
import { createHash, randomUUID } from 'crypto';
// randomUUID() garantiza que cada emisión de token produce un jti único,
// evitando tokens duplicados cuando el mismo usuario obtiene dos JWTs dentro
// del mismo segundo Unix (HMAC-SHA256 es determinista: igual payload+secret+iat → igual token).

/**
 * AuthController — Tratamiento T3 (JWT + RBAC)
 *
 * Endpoints:
 *   POST /auth/token    — Emite un JWT dado username + api_key en texto plano.
 *                         El cliente de prueba usa esto para obtener el JWT antes
 *                         de llamar a MS-Data.
 *   POST /auth/validate — Valida un JWT ya emitido y aplica RBAC.
 *                         Llamado internamente por el AuthMiddleware de MS-Data.
 */
@Controller('auth')
export class AuthController {
  constructor(
    @Inject('IAuthStrategy') private readonly strategy: any,
    @Inject('IAuthGuard') private readonly guard: any,
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ApiKey) private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  /**
   * POST /auth/token
   *
   * Body: { username: string, api_key: string }
   *
   * Valida la api_key del usuario (SHA-256 hash lookup) y, si es válida,
   * emite un JWT firmado con los claims del usuario.
   *
   * Cada token incluye un claim `jti` (JWT ID) generado con randomUUID(),
   * lo que garantiza que incluso dos llamadas consecutivas en el mismo segundo
   * producen tokens distintos. Esto es esencial para la trazabilidad del
   * experimento: cada fila del CSV debe usar un JWT diferente.
   *
   * Escenarios de ataque cubiertos:
   *   - BA-01: Emitir token con expiración corta; el cliente puede usar un
   *            token expirado enviándolo después del TTL.
   *   - BA-02: Cliente puede intentar forjar la firma (será rechazado en validate).
   *   - BA-04: Cliente puede intentar alterar el payload (será rechazado por firma).
   */
  @Post('token')
  async issueToken(
    @Body() body: { username: string; api_key: string },
  ): Promise<{ access_token: string; expires_in: number; token_type: string }> {
    const { username, api_key } = body;

    if (!username || !api_key) {
      throw new UnauthorizedException('username and api_key are required');
    }

    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const keyHash = createHash('sha256').update(api_key).digest('hex');
    const apiKeyRecord = await this.apiKeyRepo.findOne({
      where: { user_id: user.user_id, key_hash: keyHash, is_active: true },
    });

    if (!apiKeyRecord) {
      throw new UnauthorizedException('Invalid or inactive API key for this user');
    }

    if (apiKeyRecord.expires_at && apiKeyRecord.expires_at < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Emitir JWT con TTL de 15 minutos.
    // El claim `jti` (JWT ID) es un UUID único por emisión que garantiza
    // que dos tokens emitidos para el mismo usuario en el mismo segundo sean distintos.
    // Sin jti, HMAC-SHA256 produce el mismo string si payload + secret + iat son iguales.
    const ttlSeconds = 15 * 60;
    const payload = {
      sub: user.user_id,
      jti: randomUUID(),           // ← ID único por emisión (RFC 7519 §4.1.7)
      username: user.username,
      role: user.role,
      customer_id: user.customer_id ?? undefined,
      seller_id: user.seller_id ?? undefined,
    };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: ttlSeconds,
    });

    return {
      access_token,
      expires_in: ttlSeconds,
      token_type: 'Bearer',
    };
  }

  /**
   * POST /auth/validate
   *
   * Body: ValidateRequestDto { credential, action, resource, resourceOwnerId }
   *
   * Llamado por el AuthMiddleware de MS-Data en cada request GraphQL.
   * 1. Verifica el JWT (JwtStrategy).
   * 2. Aplica RBAC (RbacGuard).
   */
  @Post('validate')
  async validate(@Body() request: ValidateRequestDto): Promise<ValidateResponseDto> {
    const { credential, action, resource } = request;

    // 1. Autenticar usando JwtStrategy
    const authStrategy = this.strategy as IAuthStrategy;
    const payload = await authStrategy.validate(credential, action, resource);

    if (!payload.isValid) {
      return {
        isValid: false,
        error: payload.error || 'Authentication failed',
      };
    }

    // 2. Autorizar usando RbacGuard
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
