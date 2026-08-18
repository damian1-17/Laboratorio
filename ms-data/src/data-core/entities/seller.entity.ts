import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
@Entity('sellers')
export class Seller {
  @Field()
  @PrimaryColumn({ name: 'seller_id', type: 'varchar', length: 50 })
  sellerId!: string;

  @Field({ nullable: true })
  @Column({ name: 'seller_zip_code_prefix', type: 'varchar', length: 10, nullable: true })
  sellerZipCodePrefix?: string;

  @Field({ nullable: true })
  @Column({ name: 'seller_city', type: 'varchar', length: 100, nullable: true })
  sellerCity?: string;

  @Field({ nullable: true })
  @Column({ name: 'seller_state', type: 'char', length: 2, nullable: true })
  sellerState?: string;
}
