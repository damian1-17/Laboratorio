-- Script DDL para Tratamiento T5 (OAuth 2.0 + RBAC)
-- Ejecutar en la base de datos: olist_ecommerce
-- Tablas: oauth_clients, oauth_tokens
-- (synchronize: false en TypeORM — las tablas deben existir antes de arrancar el servicio)

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Tabla oauth_clients
--    Equivalente a users + api_keys de T1-T4, unificada bajo semántica OAuth 2.0.
--    Cada cliente tiene un client_secret_hash = SHA-256(client_secret + OAUTH_SECRET).
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_clients (
    client_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name         VARCHAR     NOT NULL UNIQUE,
    client_secret_hash  VARCHAR     NOT NULL,
    role                VARCHAR     NOT NULL,        -- 'admin' | 'seller' | 'customer'
    seller_id           VARCHAR,                     -- FK lógica a sellers.seller_id (Olist)
    customer_id         VARCHAR,                     -- FK lógica a customers.customer_id (Olist)
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Tabla oauth_tokens
--    Almacena los Access Tokens emitidos (hasheados con SHA-256).
--    El token en texto plano NUNCA se persiste.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_tokens (
    token_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash  VARCHAR     NOT NULL UNIQUE,   -- SHA-256 del Access Token real
    client_id   UUID        NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    is_revoked  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMP   NOT NULL
);

-- Índice para búsqueda rápida por hash (usado en cada /auth/validate)
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_token_hash ON oauth_tokens(token_hash);

-- Índice para listar tokens por cliente (útil para revocación)
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_client_id ON oauth_tokens(client_id);
