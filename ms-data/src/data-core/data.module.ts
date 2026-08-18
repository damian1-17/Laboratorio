import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataService } from './data.service';
import { DataResolver } from './data.resolver';
import { Customer } from './entities/customer.entity';
import { Seller } from './entities/seller.entity';
import { Order } from './entities/order.entity';
import { Product } from './entities/product.entity';
import { OrderItem } from './entities/order-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Seller, Order, Product, OrderItem]),
  ],
  providers: [DataService, DataResolver],
})
export class DataModule {}
