# Tesis — Brazilian E-Commerce (Olist) · Experimentos

Repositorio de experimentos y análisis sobre el dataset público de e-commerce brasileño de Olist.

---

## Requisitos previos

- **PostgreSQL** ≥ 13 instalado y corriendo
- Cliente `psql` disponible en el PATH
- Dataset descargado en:
  ```
  c:/Users/<tu_usuario>/OneDrive/Documentos/Brazilian E-Commerce Public Dataset by Olist/
  ```

---

## Instalación de la base de datos

Ejecuta el siguiente comando **desde la raíz del proyecto** con un superusuario de PostgreSQL.  
Este script crea la base de datos, las tablas y carga todos los datos del dataset:

```powershell
psql -U postgres -f "experiment/dataset/setup_database.sql"
```

> **Nota:** Si `psql` no está en el PATH, usa la ruta completa, por ejemplo:
> `"C:\Program Files\PostgreSQL\16\bin\psql.exe"`

El script realiza los siguientes pasos automáticamente:

1. Crea la base de datos `olist_ecommerce` (si no existe)
2. Crea las 9 tablas con sus índices y relaciones
3. Carga los CSV de cada tabla en el orden correcto
4. Muestra una verificación final con el conteo de filas por tabla

---

## Estructura del proyecto

```
Tesis/
├── experiment/
│   ├── dataset/
│   │   └── setup_database.sql   # Script unificado de instalación
│   ├── T1/ … T6/                # Experimentos por tarea
│   └── ms-data/                 # Datos adicionales
└── README.md
```

---

## Tablas cargadas

| Tabla | Archivo CSV |
|---|---|
| `customers` | `olist_customers_dataset.csv` |
| `geolocation` | `olist_geolocation_dataset.csv` |
| `sellers` | `olist_sellers_dataset.csv` |
| `product_category_name_translation` | `product_category_name_translation.csv` |
| `products` | `olist_products_dataset.csv` |
| `orders` | `olist_orders_dataset.csv` |
| `order_items` | `olist_order_items_dataset.csv` |
| `order_payments` | `olist_order_payments_dataset.csv` |
| `order_reviews` | `olist_order_reviews_dataset.csv` |
