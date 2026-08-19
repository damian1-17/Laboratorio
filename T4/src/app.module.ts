import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth-core/auth.controller';
import { User } from './auth-core/entities/user.entity';
import { ApiKey } from './auth-core/entities/api-key.entity';
import { SeedService } from './auth-core/seeds/seed.service';
import { JwtStrategy } from './auth-core/strategies/jwt.strategy';
import { AbacGuard } from './auth-core/guards/abac.guard';
import { JwtModule } from '@nestjs/jwt';

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
      synchronize: false,
    }),
    TypeOrmModule.forFeature([ApiKey, User]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || process.env.OAUTH_SECRET || 'secretKey',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: 'IAuthStrategy', useClass: JwtStrategy },
    { provide: 'IAuthGuard', useClass: AbacGuard },
    JwtStrategy,
    AbacGuard,
    SeedService,
  ],
})
export class AppModule {}
