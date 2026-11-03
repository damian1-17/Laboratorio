import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth-core/auth.controller';
import { OAuthClient } from './auth-core/entities/oauth-client.entity';
import { OAuthToken } from './auth-core/entities/oauth-token.entity';
import { SeedService } from './auth-core/seeds/seed.service';
import { OAuthTokenStrategy } from './auth-core/strategies/oauth-token.strategy';
import { AbacGuard } from './auth-core/guards/abac.guard';

/**
 * AppModule — MS-Auth para Tratamiento T6 (OAuth 2.0 Client Credentials + ABAC)
 *
 * Estrategia activa : OAuthTokenStrategy (introspección de token opaco en BD)
 * Guard activo      : AbacGuard (ABAC — verifica rol + resourceOwnerId → BOLA mitigado)
 *
 * Endpoints expuestos:
 *   POST /auth/token    — OAuth 2.0 Client Credentials Grant (emite Access Token opaco)
 *   POST /auth/validate — Token Introspection + ABAC (llamado por MS-Data)
 *
 * Diferencia con T5: se reemplaza RbacGuard por AbacGuard.
 *   T5 (RbacGuard): evalúa solo rol → resourceOwnerId ignorado → BOLA activo
 *   T6 (AbacGuard): evalúa rol + resourceOwnerId → BOLA mitigado
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
    // Estrategia de autenticación: introspección de token opaco OAuth 2.0 (idéntica a T5)
    { provide: 'IAuthStrategy', useClass: OAuthTokenStrategy },
    // Guard de autorización: ABAC (T6) — verifica rol + resourceOwnerId → mitiga BOLA
    { provide: 'IAuthGuard', useClass: AbacGuard },
    OAuthTokenStrategy,
    AbacGuard,
    SeedService,
  ],
})
export class AppModule {}

