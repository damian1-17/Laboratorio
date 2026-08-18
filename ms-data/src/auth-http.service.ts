import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ValidateRequestDto, AuthPayload } from './shared';

@Injectable()
export class AuthHttpService {
  private readonly logger = new Logger(AuthHttpService.name);
  private readonly msAuthUrl = process.env.MS_AUTH_URL || 'http://localhost:3101';

  constructor(private readonly httpService: HttpService) {}

  async validate(dto: ValidateRequestDto): Promise<AuthPayload> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<AuthPayload>(`${this.msAuthUrl}/auth/validate`, dto),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error calling MS-Auth /auth/validate', error);
      return { isValid: false, error: 'Auth service unavailable' };
    }
  }
}
