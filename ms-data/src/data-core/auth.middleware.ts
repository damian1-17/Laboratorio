import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @Inject('AUTH_HTTP_SERVICE') private readonly authHttpService: any,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    const authHeader = req.headers['authorization'] as string | undefined;

    let credential = '';
    if (apiKey) {
      credential = apiKey;
    } else if (authHeader?.startsWith('Bearer ')) {
      credential = authHeader.slice(7);
    }

    if (!credential) {
      throw new UnauthorizedException('Missing authentication credential');
    }

    const { action, resource, extractedId, customerId } = this.parseGraphQLBody(
      req.body as Record<string, unknown>,
    );

    let resourceOwnerId: string | undefined;

    if (action === 'mutation' && resource === 'Order' && customerId) {
      resourceOwnerId = customerId;
      this.logger.debug(`BOLA check: createOrder -> owner ${resourceOwnerId}`);
    } else if (resource === 'Order' && extractedId) {
      const order = await this.orderRepository.findOne({
        where: { orderId: extractedId },
        select: { orderId: true, customerId: true },
      });
      if (order?.customerId) {
        resourceOwnerId = order.customerId;
        this.logger.debug(`BOLA check: order ${extractedId} -> owner ${resourceOwnerId}`);
      }
    }

    const payload = await this.authHttpService.validate({
      credential,
      action,
      resource,
      resourceOwnerId,
    });

    if (!payload.isValid) {
      const isForbidden =
        payload.error?.toLowerCase().includes('forbidden') ||
        payload.error?.toLowerCase().includes('rbac') ||
        payload.error?.toLowerCase().includes('abac') ||
        payload.error?.toLowerCase().includes('only');

      if (isForbidden) {
        throw new ForbiddenException(payload.error || 'Forbidden');
      }
      throw new UnauthorizedException(payload.error || 'Unauthorized');
    }

    (req as any).user = payload;
    next();
  }

  private parseGraphQLBody(body: Record<string, unknown>): {
    action: string;
    resource: string;
    extractedId?: string;
    customerId?: string;
  } {
    const queryString = (body?.query as string) || '';

    const isMutation = queryString.trim().startsWith('mutation');
    const action = isMutation ? 'mutation' : 'query';

    let resource = 'Order';
    if (/getOrder|createOrder|order/i.test(queryString)) resource = 'Order';
    else if (/product/i.test(queryString)) resource = 'Product';
    else if (/customer/i.test(queryString)) resource = 'Customer';
    else if (/seller/i.test(queryString)) resource = 'Seller';

    let extractedId: string | undefined;
    if (body.variables && ((body.variables as any).order_id || (body.variables as any).orderId)) {
      extractedId = (body.variables as any).order_id || (body.variables as any).orderId;
    } else {
      const idMatch = queryString.match(/order_ids*:s*["']([^"']+)["']/i) || queryString.match(/orderIds*:s*["']([^"']+)["']/i);
      if (idMatch?.[1]) {
        extractedId = idMatch[1];
      }
    }

    let customerId: string | undefined;
    if (body.variables && ((body.variables as any).customer_id || (body.variables as any).customerId)) {
      customerId = (body.variables as any).customer_id || (body.variables as any).customerId;
    } else {
      const customerMatch = queryString.match(/customer_ids*:s*["']([^"']+)["']/i) || queryString.match(/customerIds*:s*["']([^"']+)["']/i);
      if (customerMatch?.[1]) {
        customerId = customerMatch[1];
      }
    }

    return { action, resource, extractedId, customerId };
  }
}
