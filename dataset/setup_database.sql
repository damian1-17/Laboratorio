-- =============================================================
-- Brazilian E-Commerce Public Dataset by Olist
-- PostgreSQL Setup Script (unified)
-- =============================================================

-- 1. Crear la base de datos (ejecutar conectado a 'postgres')
-- Este bloque debe ejecutarse desde psql como superusuario
SELECT 'CREATE DATABASE experiment_tesis'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'experiment_tesis')\gexec

\connect experiment_tesis

-- =============================================================
-- 2. CREACIÓN DE TABLAS
-- =============================================================

-- Tabla: customers
DROP TABLE IF EXISTS customers CASCADE;
CREATE TABLE customers (
    customer_id             VARCHAR(50) PRIMARY KEY,
    customer_unique_id      VARCHAR(50) NOT NULL,
    customer_zip_code_prefix VARCHAR(10),
    customer_city           VARCHAR(100),
    customer_state          CHAR(2)
);

-- Tabla: geolocation
DROP TABLE IF EXISTS geolocation CASCADE;
CREATE TABLE geolocation (
    geolocation_zip_code_prefix VARCHAR(10),
    geolocation_lat             DOUBLE PRECISION,
    geolocation_lng             DOUBLE PRECISION,
    geolocation_city            VARCHAR(100),
    geolocation_state           CHAR(2)
);
CREATE INDEX idx_geolocation_zip ON geolocation(geolocation_zip_code_prefix);

-- Tabla: sellers
DROP TABLE IF EXISTS sellers CASCADE;
CREATE TABLE sellers (
    seller_id               VARCHAR(50) PRIMARY KEY,
    seller_zip_code_prefix  VARCHAR(10),
    seller_city             VARCHAR(100),
    seller_state            CHAR(2)
);

-- Tabla: product_category_name_translation
DROP TABLE IF EXISTS product_category_name_translation CASCADE;
CREATE TABLE product_category_name_translation (
    product_category_name         VARCHAR(100) PRIMARY KEY,
    product_category_name_english VARCHAR(100)
);

-- Tabla: products
-- NOTA: Se omite la FK hacia product_category_name_translation porque el dataset
--       contiene categorías que no están presentes en la tabla de traducción (ej: pc_gamer).
DROP TABLE IF EXISTS products CASCADE;
CREATE TABLE products (
    product_id                   VARCHAR(50) PRIMARY KEY,
    product_category_name        VARCHAR(100),
    product_name_lenght          INTEGER,
    product_description_lenght   INTEGER,
    product_photos_qty           INTEGER,
    product_weight_g             NUMERIC(10,2),
    product_length_cm            NUMERIC(10,2),
    product_height_cm            NUMERIC(10,2),
    product_width_cm             NUMERIC(10,2)
);

-- Tabla: orders
DROP TABLE IF EXISTS orders CASCADE;
CREATE TABLE orders (
    order_id                      VARCHAR(50) PRIMARY KEY,
    customer_id                   VARCHAR(50),
    order_status                  VARCHAR(30),
    order_purchase_timestamp      TIMESTAMP,
    order_approved_at             TIMESTAMP,
    order_delivered_carrier_date  TIMESTAMP,
    order_delivered_customer_date TIMESTAMP,
    order_estimated_delivery_date TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status   ON orders(order_status);
CREATE INDEX idx_orders_purchase ON orders(order_purchase_timestamp);

-- Tabla: order_items
DROP TABLE IF EXISTS order_items CASCADE;
CREATE TABLE order_items (
    order_id            VARCHAR(50),
    order_item_id       INTEGER,
    product_id          VARCHAR(50),
    seller_id           VARCHAR(50),
    shipping_limit_date TIMESTAMP,
    price               NUMERIC(10,2),
    freight_value       NUMERIC(10,2),
    PRIMARY KEY (order_id, order_item_id),
    FOREIGN KEY (order_id)    REFERENCES orders(order_id),
    FOREIGN KEY (product_id)  REFERENCES products(product_id),
    FOREIGN KEY (seller_id)   REFERENCES sellers(seller_id)
);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_seller  ON order_items(seller_id);

-- Tabla: order_payments
DROP TABLE IF EXISTS order_payments CASCADE;
CREATE TABLE order_payments (
    order_id             VARCHAR(50),
    payment_sequential   INTEGER,
    payment_type         VARCHAR(30),
    payment_installments INTEGER,
    payment_value        NUMERIC(10,2),
    PRIMARY KEY (order_id, payment_sequential),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);
CREATE INDEX idx_payments_type ON order_payments(payment_type);

-- Tabla: order_reviews
DROP TABLE IF EXISTS order_reviews CASCADE;
CREATE TABLE order_reviews (
    review_id               VARCHAR(50),
    order_id                VARCHAR(50),
    review_score            SMALLINT CHECK (review_score BETWEEN 1 AND 5),
    review_comment_title    TEXT,
    review_comment_message  TEXT,
    review_creation_date    TIMESTAMP,
    review_answer_timestamp TIMESTAMP,
    PRIMARY KEY (review_id, order_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);
CREATE INDEX idx_reviews_score ON order_reviews(review_score);

-- =============================================================
-- 3. CARGA DE DATOS (COPY)
-- Los paths usan forward slashes para compatibilidad con psql
-- =============================================================

\echo '>>> Cargando customers...'
\copy customers FROM 'c:/Users/diego/OneDrive/Documentos/Brazilian E-Commerce Public Dataset by Olist/Brazilian E-Commerce Public Dataset by Olist/olist_customers_dataset.csv' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', NULL '');

\echo '>>> Cargando geolocation...'
\copy geolocation FROM 'c:/Users/diego/OneDrive/Documentos/Brazilian E-Commerce Public Dataset by Olist/Brazilian E-Commerce Public Dataset by Olist/olist_geolocation_dataset.csv' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', NULL '');

\echo '>>> Cargando sellers...'
\copy sellers FROM 'c:/Users/diego/OneDrive/Documentos/Brazilian E-Commerce Public Dataset by Olist/Brazilian E-Commerce Public Dataset by Olist/olist_sellers_dataset.csv' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', NULL '');

\echo '>>> Cargando product_category_name_translation...'
\copy product_category_name_translation FROM 'c:/Users/diego/OneDrive/Documentos/Brazilian E-Commerce Public Dataset by Olist/Brazilian E-Commerce Public Dataset by Olist/product_category_name_translation.csv' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', NULL '');

\echo '>>> Cargando products...'
\copy products FROM 'c:/Users/diego/OneDrive/Documentos/Brazilian E-Commerce Public Dataset by Olist/Brazilian E-Commerce Public Dataset by Olist/olist_products_dataset.csv' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', NULL '');

\echo '>>> Cargando orders...'
\copy orders FROM 'c:/Users/diego/OneDrive/Documentos/Brazilian E-Commerce Public Dataset by Olist/Brazilian E-Commerce Public Dataset by Olist/olist_orders_dataset.csv' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', NULL '');

\echo '>>> Cargando order_items...'
\copy order_items FROM 'c:/Users/diego/OneDrive/Documentos/Brazilian E-Commerce Public Dataset by Olist/Brazilian E-Commerce Public Dataset by Olist/olist_order_items_dataset.csv' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', NULL '');

\echo '>>> Cargando order_payments...'
\copy order_payments FROM 'c:/Users/diego/OneDrive/Documentos/Brazilian E-Commerce Public Dataset by Olist/Brazilian E-Commerce Public Dataset by Olist/olist_order_payments_dataset.csv' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', NULL '');

\echo '>>> Cargando order_reviews...'
\copy order_reviews FROM 'c:/Users/diego/OneDrive/Documentos/Brazilian E-Commerce Public Dataset by Olist/Brazilian E-Commerce Public Dataset by Olist/olist_order_reviews_dataset.csv' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', NULL '');

-- =============================================================
-- 4. VERIFICACIÓN: conteo de registros por tabla
-- =============================================================
\echo ''
\echo '=== VERIFICACIÓN FINAL: Filas por tabla ==='
SELECT tabla, filas FROM (
    SELECT 'customers'                      AS tabla, COUNT(*) AS filas FROM customers
    UNION ALL SELECT 'geolocation',                              COUNT(*) FROM geolocation
    UNION ALL SELECT 'sellers',                                  COUNT(*) FROM sellers
    UNION ALL SELECT 'product_category_name_translation',        COUNT(*) FROM product_category_name_translation
    UNION ALL SELECT 'products',                                 COUNT(*) FROM products
    UNION ALL SELECT 'orders',                                   COUNT(*) FROM orders
    UNION ALL SELECT 'order_items',                              COUNT(*) FROM order_items
    UNION ALL SELECT 'order_payments',                           COUNT(*) FROM order_payments
    UNION ALL SELECT 'order_reviews',                            COUNT(*) FROM order_reviews
) t ORDER BY tabla;

\echo ''
\echo '=== Instalación completada exitosamente ==='
