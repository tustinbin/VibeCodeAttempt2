-- PostgreSQL schema mirroring shop.db + ML scoring column.
-- Run in Supabase SQL Editor (or psql) if tables are missing.

CREATE TABLE IF NOT EXISTS customers (
  customer_id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  gender TEXT,
  birthdate TEXT,
  created_at TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  customer_segment TEXT,
  loyalty_tier TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  product_id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  category TEXT,
  price REAL NOT NULL,
  cost REAL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  order_id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers (customer_id),
  order_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  billing_zip TEXT NOT NULL,
  shipping_zip TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  device_type TEXT NOT NULL,
  ip_country TEXT NOT NULL,
  promo_used INTEGER NOT NULL DEFAULT 0,
  promo_code TEXT,
  order_subtotal REAL NOT NULL,
  shipping_fee REAL NOT NULL,
  tax_amount REAL NOT NULL,
  order_total REAL NOT NULL,
  risk_score REAL,
  is_fraud INTEGER DEFAULT 0,
  predicted_is_fraud INTEGER
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_datetime ON orders (order_datetime DESC);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders (order_id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products (product_id),
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS shipments (
  shipment_id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders (order_id) ON DELETE CASCADE,
  ship_datetime TIMESTAMPTZ,
  carrier TEXT,
  shipping_method TEXT,
  distance_band TEXT,
  promised_days INTEGER,
  actual_days INTEGER,
  late_delivery INTEGER
);

CREATE TABLE IF NOT EXISTS product_reviews (
  review_id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products (product_id),
  customer_id INTEGER REFERENCES customers (customer_id),
  rating INTEGER,
  review_text TEXT,
  created_at TEXT
);

-- If orders already exists from an older import, add the ML prediction column:
ALTER TABLE orders ADD COLUMN IF NOT EXISTS predicted_is_fraud INTEGER;
