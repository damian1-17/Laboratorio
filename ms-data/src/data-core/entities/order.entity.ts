import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ObjectType, Field } from '@nestjs/graphql';
import { Customer } from './customer.entity';

@ObjectType()
@Entity('orders')
export class Order {
  @Field()
  @PrimaryColumn({ name: 'order_id', type: 'varchar', length: 50 })
  orderId!: string;

  @Field({ nullable: true })
  @Column({ name: 'customer_id', type: 'varchar', length: 50, nullable: true })
  customerId?: string;

  @Field({ nullable: true })
  @Column({ name: 'order_status', type: 'varchar', length: 30, nullable: true })
  orderStatus?: string;

  @Field({ nullable: true })
  @Column({ name: 'order_purchase_timestamp', type: 'timestamp', nullable: true })
  orderPurchaseTimestamp?: Date;

  @Field({ nullable: true })
  @Column({ name: 'order_approved_at', type: 'timestamp', nullable: true })
  orderApprovedAt?: Date;

  @Field({ nullable: true })
  @Column({ name: 'order_delivered_carrier_date', type: 'timestamp', nullable: true })
  orderDeliveredCarrierDate?: Date;

  @Field({ nullable: true })
  @Column({ name: 'order_delivered_customer_date', type: 'timestamp', nullable: true })
  orderDeliveredCustomerDate?: Date;

  @Field({ nullable: true })
  @Column({ name: 'order_estimated_delivery_date', type: 'timestamp', nullable: true })
  orderEstimatedDeliveryDate?: Date;

  @Field(() => Customer, { nullable: true })
  @ManyToOne('Customer', 'orders')
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;
}
