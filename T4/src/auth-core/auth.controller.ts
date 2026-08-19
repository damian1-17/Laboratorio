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

@Controller('auth')
export class AuthController {
  constructor(
    @Inject('IAuthStrategy') private readonly strategy: any,
    @Inject('IAuthGuard') private readonly guard: any,
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ApiKey) private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

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

    const ttlSeconds = 15 * 60;
    const payload = {
      sub: user.user_id,
      jti: randomUUID(),
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

  @Post('validate')
  async validate(@Body() request: ValidateRequestDto): Promise<ValidateResponseDto> {
    const { credential, action, resource } = request;

    // 1. Autenticar usando la estrategia inyectada
    const authStrategy = this.strategy as IAuthStrategy;
    const payload = await authStrategy.validate(credential, action, resource);

    if (!payload.isValid) {
      return {
        isValid: false,
        error: payload.error || 'Authentication failed',
      };
    }

    // 2. Autorizar usando el guard inyectado
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

