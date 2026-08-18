import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { ObjectType, Field } from '@nestjs/graphql';
import { Order } from './order.entity';

@ObjectType()
@Entity('customers')
export class Customer {
  @Field()
  @PrimaryColumn({ name: 'customer_id', type: 'varchar', length: 50 })
  customerId!: string;

  @Field()
  @Column({ name: 'customer_unique_id', type: 'varchar', length: 50 })
  customerUniqueId!: string;

  @Field({ nullable: true })
  @Column({ name: 'customer_zip_code_prefix', type: 'varchar', length: 10, nullable: true })
  customerZipCodePrefix?: string;

  @Field({ nullable: true })
  @Column({ name: 'customer_city', type: 'varchar', length: 100, nullable: true })
  customerCity?: string;

  @Field({ nullable: true })
  @Column({ name: 'customer_state', type: 'char', length: 2, nullable: true })
  customerState?: string;

  @Field(() => [Order], { nullable: true })
  @OneToMany('Order', 'customer')
  orders?: Order[];
}
