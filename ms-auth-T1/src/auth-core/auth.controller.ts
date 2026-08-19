import { Controller, Post, Body, Inject } from '@nestjs/common';
import { ValidateRequestDto, ValidateResponseDto } from '../shared';
import type { IAuthStrategy } from '../shared';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject('IAuthStrategy') private readonly strategy: any,
    @Inject('IAuthGuard') private readonly guard: any,
  ) {}

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
