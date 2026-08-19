import { ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

/**
 * AbacGuard - Tratamientos T2, T4, T6.
 *
 * ABAC: verifica rol + atributos del objeto (resourceOwnerId).
 * Incluye las mismas reglas base de acceso por rol (RBAC) mas
 * la validacion estricta de propiedad del recurso (owner vs requestor).
 */
@Injectable()
export class AbacGuard {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { payload, resourceOwnerId, action, resource } = request.body;

    if (!payload || !payload.isValid) {
      throw new ForbiddenException('Missing or invalid auth payload');
    }

    const role = payload.role;
    const op = action ?? 'query';
    const res = resource ?? '';

    // ── Admin: acceso total ───────────────────────────────────────────────────
    if (role === 'admin') {
      return true;
    }

    // ── Seller: reglas base de acceso ────────────────────────────────────────
    if (role === 'seller') {
      if (res === 'Product') {
        return true;
      }
      if (res === 'Order') {
        if (op === 'mutation') {
          throw new ForbiddenException('ABAC: Sellers cannot create or modify Orders directly');
        }
        // ABAC: verificar que el seller_id sea el propietario
        if (resourceOwnerId && payload.seller_id !== resourceOwnerId) {
          throw new ForbiddenException('ABAC: You can only access your own resources');
        }
        return true;
      }
      throw new ForbiddenException(`ABAC: Sellers cannot access resource '${res}'`);
    }

    // ── Customer: reglas base de acceso ──────────────────────────────────────
    if (role === 'customer') {
      if (res === 'Customer') {
        throw new ForbiddenException('ABAC: Customers cannot access Customer records');
      }

      if (res === 'Order') {
        // ABAC: si se conoce el owner, verificar que coincida con el customer del payload.
        // Si no se pudo extraer el resourceOwnerId (p.ej. createOrder via GraphQL variables),
        // se permite pasar -- el resolver valida que customer_id == payload.customer_id.
        if (resourceOwnerId && payload.customer_id !== resourceOwnerId) {
          throw new ForbiddenException('ABAC: You can only access your own resources');
        }
        return true;
      }

      if (res === 'Product' || res === 'Seller') {
        if (op === 'mutation') {
          throw new ForbiddenException(`ABAC: Customers cannot modify '${res}'`);
        }
        return true;
      }

      throw new ForbiddenException(`ABAC: Customers cannot access resource '${res}'`);
    }

    throw new ForbiddenException(`ABAC: Unknown role '${role}'`);
  }
}


