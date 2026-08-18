import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { DataService } from './data.service';
import { Order } from './entities/order.entity';
import { AuthPayload } from '../shared';

interface GqlContext {
  user: AuthPayload;
}

@Resolver(() => Order)
export class DataResolver {
  constructor(private readonly dataService: DataService) {}

  @Query(() => Order, { nullable: true, name: 'getOrder' })
  async getOrder(
    @Args('order_id', { type: () => String }) orderId: string,
    @Context() ctx: GqlContext,
  ): Promise<Order | null> {
    return this.dataService.getOrderById(orderId, ctx.user);
  }

  @Mutation(() => Order, { name: 'createOrder' })
  async createOrder(
    @Args('customer_id', { type: () => String }) customerId: string,
    @Args('product_ids', { type: () => [String] }) productIds: string[],
    @Args('seller_id', { type: () => String }) sellerId: string,
    @Context() ctx: GqlContext,
  ): Promise<Order> {
    return this.dataService.createOrder(customerId, productIds, sellerId, ctx.user);
  }
}
