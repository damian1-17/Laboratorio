import { Entity, PrimaryColumn, Column } from 'typeorm';
import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType()
@Entity('products')
export class Product {
  @Field()
  @PrimaryColumn({ name: 'product_id', type: 'varchar', length: 50 })
  productId!: string;

  @Field({ nullable: true })
  @Column({ name: 'product_category_name', type: 'varchar', length: 100, nullable: true })
  productCategoryName?: string;

  @Field(() => Int, { nullable: true })
  @Column({ name: 'product_name_lenght', type: 'int', nullable: true })
  productNameLenght?: number;

  @Field(() => Int, { nullable: true })
  @Column({ name: 'product_description_lenght', type: 'int', nullable: true })
  productDescriptionLenght?: number;

  @Field(() => Int, { nullable: true })
  @Column({ name: 'product_photos_qty', type: 'int', nullable: true })
  productPhotosQty?: number;

  @Field(() => Float, { nullable: true })
  @Column({ name: 'product_weight_g', type: 'numeric', precision: 10, scale: 2, nullable: true })
  productWeightG?: number;
}
