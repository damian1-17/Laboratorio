import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth-core/auth.controller';
import { User } from './auth-core/entities/user.entity';
import { ApiKey } from './auth-core/entities/api-key.entity';
import { SeedService } from './auth-core/seeds/seed.service';
import { ApiKeyStrategy } from './auth-core/strategies/api-key.strategy';
import { RbacGuard } from './auth-core/guards/rbac.guard';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '123',
      database: process.env.DB_DATABASE || 'olist_ecommerce',
      autoLoadEntities: true,
      synchronize: true,
    }),
    TypeOrmModule.forFeature([ApiKey, User]),

  ],
  controllers: [AuthController],
  providers: [
    { provide: 'IAuthStrategy', useClass: ApiKeyStrategy },
    { provide: 'IAuthGuard', useClass: RbacGuard },
    ApiKeyStrategy,
    RbacGuard,
    SeedService,
  ],
})
export class AppModule {}
