import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { Order } from './order.entity';
import { Product } from './product.entity';
import { Seller } from './seller.entity';

@ObjectType()
@Entity('order_items')
export class OrderItem {
  @Field()
  @PrimaryColumn({ name: 'order_id', type: 'varchar', length: 50 })
  orderId!: string;

  @Field(() => Int)
  @PrimaryColumn({ name: 'order_item_id', type: 'int' })
  orderItemId!: number;

  @Field({ nullable: true })
  @Column({ name: 'product_id', type: 'varchar', length: 50, nullable: true })
  productId?: string;

  @Field({ nullable: true })
  @Column({ name: 'seller_id', type: 'varchar', length: 50, nullable: true })
  sellerId?: string;

  @Field(() => Float, { nullable: true })
  @Column({ name: 'price', type: 'numeric', precision: 10, scale: 2, nullable: true })
  price?: number;

  @Field(() => Order, { nullable: true })
  @ManyToOne('Order')
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  @Field(() => Product, { nullable: true })
  @ManyToOne('Product')
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Field(() => Seller, { nullable: true })
  @ManyToOne('Seller')
  @JoinColumn({ name: 'seller_id' })
  seller?: Seller;
}
