import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { AuthPayload } from '../../shared';

/**
 * RbacGuard — Tratamiento T5 (OAuth 2.0 + RBAC puro)
 *
 * RBAC PURO: este guard evalúa SOLO el rol del usuario. No verifica la
 * propiedad del objeto solicitado (resourceOwnerId). Esa responsabilidad
 * es EXCLUSIVA del AbacGuard (T2/T4/T6).
 *
 * Esta separación es el eje central del experimento:
 *   - RBAC (T1/T3/T5): verifica rol → vulnerable a BOLA (API1:2023)
 *   - ABAC (T2/T4/T6): verifica rol + atributos del objeto → bloquea BOLA
 *
 * La lógica es idéntica a T1 y T3. El guard recibe resourceOwnerId pero
 * lo ignora completamente — esa es la vulnerabilidad BOLA que este
 * tratamiento expone intencionalmente.
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

    // ── Admin: acceso total ──────────────────────────────────────────────────
    if (role === 'admin') {
      return true;
    }

    // ── Seller ───────────────────────────────────────────────────────────────
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
        // ⚠️ VECTOR BOLA: RBAC no verifica propiedad del objeto (seller_id)
        return true;
      }

      throw new ForbiddenException(
        `RBAC: Sellers cannot access resource '${res}'`,
      );
    }

    // ── Customer ─────────────────────────────────────────────────────────────
    if (role === 'customer') {
      if (res === 'Customer') {
        throw new ForbiddenException(
          'RBAC: Customers cannot access Customer records',
        );
      }

      if (res === 'Order') {
        // ⚠️ VECTOR BOLA (API1:2023): RBAC no verifica propiedad del objeto.
        // Un customer puede acceder a pedidos de cualquier otro customer.
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
