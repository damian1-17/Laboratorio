import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth-core/auth.controller';
import { OAuthClient } from './auth-core/entities/oauth-client.entity';
import { OAuthToken } from './auth-core/entities/oauth-token.entity';
import { SeedService } from './auth-core/seeds/seed.service';
import { OAuthTokenStrategy } from './auth-core/strategies/oauth-token.strategy';
import { RbacGuard } from './auth-core/guards/rbac.guard';

/**
 * AppModule — MS-Auth para Tratamiento T5 (OAuth 2.0 Client Credentials + RBAC)
 *
 * Estrategia activa : OAuthTokenStrategy (introspección de token opaco en BD)
 * Guard activo      : RbacGuard (RBAC puro — sin verificación de resourceOwnerId)
 *
 * Endpoints expuestos:
 *   POST /auth/token    — OAuth 2.0 Client Credentials Grant (emite Access Token opaco)
 *   POST /auth/validate — Token Introspection + RBAC (llamado por MS-Data)
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
    TypeOrmModule.forFeature([OAuthClient, OAuthToken]),
  ],
  controllers: [AuthController],
  providers: [
    // Estrategia de autenticación: introspección de token opaco OAuth 2.0
    { provide: 'IAuthStrategy', useClass: OAuthTokenStrategy },
    // Guard de autorización: RBAC puro (T5) — idéntico a T1/T3, sin ownership check
    { provide: 'IAuthGuard', useClass: RbacGuard },
    OAuthTokenStrategy,
    RbacGuard,
    SeedService,
  ],
})
export class AppModule {}
