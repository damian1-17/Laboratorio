-- ==============================================================================
-- Script DDL para Tratamientos T5 y T6 (OAuth 2.0: oauth_clients, oauth_tokens)
-- Base de datos objetivo: olist_ecommerce
-- ==============================================================================

-- 1. Tabla oauth_clients
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

-- 2. Tabla oauth_tokens
CREATE TABLE IF NOT EXISTS oauth_tokens (
    token_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash  VARCHAR     NOT NULL UNIQUE,   -- SHA-256 del Access Token real
    client_id   UUID        NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    is_revoked  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMP   NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_token_hash ON oauth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_client_id ON oauth_tokens(client_id);
