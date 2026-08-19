import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IAuthStrategy, AuthPayload } from '../../shared';

/**
 * JwtStrategy — Tratamiento T3 y T4.
 *
 * Verifica la firma del JWT usando JWT_SECRET y retorna el AuthPayload
 * con todos los claims necesarios para el contexto GraphQL.
 *
 * Errores de autenticación cubiertos por este tratamiento:
 *   - BA-01: Token expirado (exp < now)   → JwtService.verify lanza TokenExpiredError
 *   - BA-02: Firma inválida (secret malo) → JwtService.verify lanza JsonWebTokenError
 *   - BA-03: Token revocado               → No aplica en T3 (sin blacklist); cubierto en T5/T6
 *   - BA-04: Claim manipulation           → El rol del token NO se puede alterar sin invalidar la firma
 */
@Injectable()
export class JwtStrategy implements IAuthStrategy {
  constructor(private readonly jwtService: JwtService) {}

  async validate(credential: string): Promise<AuthPayload> {
    try {
      const decoded = this.jwtService.verify<{
        sub?: string;
        user_id?: string;
        role?: string;
        customer_id?: string;
        seller_id?: string;
        username?: string;
      }>(credential);

      return {
        isValid: true,
        user_id: decoded.sub ?? decoded.user_id,
        role: decoded.role,
        customer_id: decoded.customer_id,
        seller_id: decoded.seller_id,
      };
    } catch (e: unknown) {
      const err = e as Error;
      const name = err?.name ?? '';

      // Mapear el tipo de error JWT a un mensaje descriptivo para el log de experimento
      if (name === 'TokenExpiredError') {
        return { isValid: false, error: 'JWT expired (BA-01)' };
      }
      if (name === 'JsonWebTokenError') {
        return { isValid: false, error: 'JWT invalid signature (BA-02)' };
      }
      return { isValid: false, error: `JWT verification failed: ${err?.message ?? 'unknown'}` };
    }
  }
}
