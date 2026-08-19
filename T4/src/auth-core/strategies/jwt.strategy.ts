import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IAuthStrategy, AuthPayload } from '../../shared';

@Injectable()
export class JwtStrategy implements IAuthStrategy {
  constructor(private readonly jwtService: JwtService) {}

  async validate(credential: string): Promise<AuthPayload> {
    try {
      const decoded = this.jwtService.verify(credential);
      return {
        isValid: true,
        role: decoded.role,
        customer_id: decoded.customer_id,
        seller_id: decoded.seller_id,
      };
    } catch (e) {
      return { isValid: false, error: 'Invalid or expired JWT' };
    }
  }
}
