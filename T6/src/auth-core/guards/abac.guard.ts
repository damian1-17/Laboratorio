import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { AuthPayload } from '../../shared';

/**
 * AbacGuard — Tratamiento T6 (OAuth 2.0 + ABAC)
 *
 * ABAC: este guard evalúa el rol del usuario Y verifica la propiedad
 * del recurso solicitado (resourceOwnerId). Esta verificación de ownership
 * es la diferencia central entre T6 (ABAC) y T5 (RBAC):
 *
 *   T5 (RbacGuard): evalúa solo rol → resourceOwnerId ignorado → BOLA activo
 *   T6 (AbacGuard): evalúa rol + resourceOwnerId              → BOLA mitigado
 *
 * Esta separación es el eje central del experimento:
 *   - RBAC (T1/T3/T5): verifica rol → vulnerable a BOLA (API1:2023)
 *   - ABAC (T2/T4/T6): verifica rol + atributos del objeto → bloquea BOLA
 *
 * Política de acceso:
 *
 *   admin    → acceso total sin restricción de propiedad
 *
 *   customer → Order (query/mutation): solo si resourceOwnerId === token.customer_id
 *            → Product (query): permitido (catálogo público)
 *            → Seller  (query): permitido (información pública)
 *            → Product (mutation): denegado
 *            → Seller  (mutation): denegado
 *            → Customer (cualquier): denegado
 *
 *   seller   → Product (query/mutation): solo si resourceOwnerId === token.seller_id
 *            → Order (query): permitido (sellers ven pedidos de sus productos)
 *            → Order (mutation): denegado
 *            → otros recursos: denegado
 */
@Injectable()
export class AbacGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      body: {
        payload: AuthPayload;
        action?: string;
        resource?: string;
        resourceOwnerId?: string;
      };
    }>();

    const { payload, action, resource, resourceOwnerId } = request.body;

    if (!payload || !payload.isValid) {
      throw new ForbiddenException('Missing or invalid auth payload');
    }

    const role = payload.role;
    const op = action ?? 'query';
    const res = resource ?? '';

    // ── Admin: acceso total sin restricción de propiedad ─────────────────────
    if (role === 'admin') {
      return true;
    }

    // ── Customer ─────────────────────────────────────────────────────────────
    if (role === 'customer') {
      if (res === 'Customer') {
        throw new ForbiddenException('ABAC: Customers cannot access Customer records');
      }

      if (res === 'Order') {
        // ✅ MITIGACIÓN BOLA: verificar que el recurso pertenece al customer autenticado
        if (resourceOwnerId && resourceOwnerId !== payload.customer_id) {
          throw new ForbiddenException(
            'ABAC: Access denied — resource belongs to another customer',
          );
        }
        return true;
      }

      if (res === 'Product' || res === 'Seller') {
        if (op === 'mutation') {
          throw new ForbiddenException(`ABAC: Customers cannot modify '${res}'`);
        }
        // query sobre Product y Seller es público (catálogo / información de vendedores)
        return true;
      }

      throw new ForbiddenException(`ABAC: Customers cannot access resource '${res}'`);
    }

    // ── Seller ───────────────────────────────────────────────────────────────
    if (role === 'seller') {
      if (res === 'Order') {
        if (op === 'mutation') {
          throw new ForbiddenException(
            'ABAC: Sellers cannot create or modify Orders directly',
          );
        }
        // Sellers pueden consultar pedidos asociados a sus productos (sin restricción de ownership en Orders)
        return true;
      }

      if (res === 'Product') {
        // ✅ MITIGACIÓN BOLA: verificar que el producto pertenece al seller autenticado
        if (resourceOwnerId && resourceOwnerId !== payload.seller_id) {
          throw new ForbiddenException(
            'ABAC: Access denied — product belongs to another seller',
          );
        }
        return true;
      }

      throw new ForbiddenException(`ABAC: Sellers cannot access resource '${res}'`);
    }

    throw new ForbiddenException(`ABAC: Unknown role '${role}'`);
  }
}

