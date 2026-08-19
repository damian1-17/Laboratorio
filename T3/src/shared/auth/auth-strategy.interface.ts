import { AuthPayload } from './auth-payload.type';

export interface IAuthStrategy {
  validate(credential: string, action?: string, resource?: string): Promise<AuthPayload>;
}
