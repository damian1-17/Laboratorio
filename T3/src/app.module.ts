import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth-core/auth.controller';
import { User } from './auth-core/entities/user.entity';
import { ApiKey } from './auth-core/entities/api-key.entity';
import { SeedService } from './auth-core/seeds/seed.service';
import { JwtStrategy } from './auth-core/strategies/jwt.strategy';
import { RbacGuard } from './auth-core/guards/rbac.guard';

/**
 * AppModule — MS-Auth para Tratamiento T3 (JWT + RBAC)
 *
 * Estrategia activa : JwtStrategy
 * Guard activo      : RbacGuard
 *
 * Endpoints expuestos:
 *   POST /auth/token    — Emite un JWT (cliente usa su api_key para obtenerlo)
 *   POST /auth/validate — Valida JWT + aplica RBAC (llamado por MS-Data)
 */
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
      // T3 usa JWT_SECRET. Si no está definido cae a OAUTH_SECRET por compatibilidad.
      secret: process.env.JWT_SECRET || process.env.OAUTH_SECRET || 'secretKey',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Estrategia de autenticación: JWT
    { provide: 'IAuthStrategy', useClass: JwtStrategy },
    // Guard de autorización: RBAC puro (T3)
    { provide: 'IAuthGuard', useClass: RbacGuard },
    JwtStrategy,
    RbacGuard,
    SeedService,
  ],
})
export class AppModule {}
