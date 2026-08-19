import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { AuthPayload } from '../../shared';

/**
 * RbacGuard ” Tratamientos T1, T3, T5.
 *
 * RBAC PURO: este guard evalÃºa SOLO el rol del usuario. No verifica la
 * propiedad del objeto solicitado (resourceOwnerId). Esa responsabilidad
 * es EXCLUSIVA del AbacGuard (T2/T4/T6).
 *
 * Esta separacin es el eje central del experimento:
 *   - RBAC (T1/T3/T5): verifica rol ’ vulnerable a BOLA (API1:2023)
 *   - ABAC (T2/T4/T6): verifica rol + atributos del objeto ’ bloquea BOLA
 */
@Injectable()
export class RbacGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      body: {
        payload: AuthPayload;
        action?: string;
        resource?: string;
        resourceOwnerId?: string;
      };
    }>();

    const { payload, action, resource } = request.body;

    if (!payload || !payload.isValid) {
      throw new ForbiddenException('Missing or invalid auth payload');
    }

    const role = payload.role;
    const op = action ?? 'query';
    const res = resource ?? '';

    // â”€â”€ Admin: acceso total â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (role === 'admin') {
      return true;
    }

    // â”€â”€ Seller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (role === 'seller') {
      if (res === 'Product') {
        return true;
      }

      if (res === 'Order') {
        if (op === 'mutation') {
          throw new ForbiddenException(
            'RBAC: Sellers cannot create or modify Orders directly',
          );
        }
        return true;
      }

      throw new ForbiddenException(
        `RBAC: Sellers cannot access resource '${res}'`,
      );
    }

    // â”€â”€ Customer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (role === 'customer') {
      if (res === 'Customer') {
        throw new ForbiddenException(
          'RBAC: Customers cannot access Customer records',
        );
      }

      if (res === 'Order') {
        // âš ï¸ VECTOR BOLA (API1:2023): RBAC no verifica propiedad del objeto.
        return true;
      }

      if (res === 'Product' || res === 'Seller') {
        if (op === 'mutation') {
          throw new ForbiddenException(
            `RBAC: Customers cannot modify '${res}'`,
          );
        }
        return true;
      }

      throw new ForbiddenException(
        `RBAC: Customers cannot access resource '${res}'`,
      );
    }

    throw new ForbiddenException(`RBAC: Unknown role '${role}'`);
  }
}
