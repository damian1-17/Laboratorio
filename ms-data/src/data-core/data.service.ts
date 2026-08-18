import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AuthPayload } from '../shared';
import { Order } from './entities/order.entity';

@Injectable()
export class DataService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async getOrderById(
    orderId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _user: AuthPayload,
  ): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { orderId },
      relations: { customer: true },
    });
  }

  async createOrder(
    customerId: string,
    _productIds: string[],
    _sellerId: string,
    _user: AuthPayload,
  ): Promise<Order> {
    const order = this.orderRepository.create({
      orderId: randomUUID(),
      customerId,
      orderStatus: 'created',
      orderPurchaseTimestamp: new Date(),
    });
    return this.orderRepository.save(order);
  }
}
