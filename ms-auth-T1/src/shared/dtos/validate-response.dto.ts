import { AuthPayload } from '../auth/auth-payload.type';

export class ValidateResponseDto {
  isValid!: boolean;
  payload?: AuthPayload;
  error?: string;
}
