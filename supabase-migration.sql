-- ============================================================
-- KASIR UMKM — Supabase Migration Script
-- Jalankan di: Supabase Dashboard > SQL Editor
-- Urutan eksekusi: dari atas ke bawah
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. TABEL STORES (Toko)
-- ============================================================
CREATE TABLE stores (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. TABEL PROFILES (User)
-- Extends auth.users dari Supabase Auth
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'cashier')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile saat user baru dibuat
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Profile dibuat manual oleh owner, bukan otomatis
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. TABEL PRODUCTS (Barang)
-- ============================================================
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sku           TEXT,
  category      TEXT,
  selling_price BIGINT NOT NULL DEFAULT 0,   -- dalam Rupiah (integer, hindari float)
  cost_price    BIGINT NOT NULL DEFAULT 0,   -- harga beli, untuk laba kotor
  stock_qty     INTEGER NOT NULL DEFAULT 0,
  min_stock     INTEGER NOT NULL DEFAULT 0,  -- alert kalau di bawah ini
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (store_id, sku)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. TABEL TRANSACTIONS (Header Transaksi)
-- ============================================================
CREATE TABLE transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  transaction_code  TEXT NOT NULL,              -- INV-20250602-001
  cashier_id        UUID NOT NULL REFERENCES profiles(id),
  cashier_name      TEXT NOT NULL,              -- snapshot nama kasir
  total_amount      BIGINT NOT NULL DEFAULT 0,
  discount          BIGINT NOT NULL DEFAULT 0,
  payment_method    TEXT NOT NULL CHECK (payment_method IN ('cash', 'qris')),
  payment_amount    BIGINT NOT NULL DEFAULT 0,
  change_amount     BIGINT NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('completed', 'void')),
  void_reason       TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (store_id, transaction_code)
);

-- ============================================================
-- 6. TABEL TRANSACTION_ITEMS (Detail / Line Items)
-- ============================================================
CREATE TABLE transaction_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  product_name    TEXT NOT NULL,    -- SNAPSHOT: nama saat transaksi
  qty             INTEGER NOT NULL CHECK (qty > 0),
  selling_price   BIGINT NOT NULL,  -- SNAPSHOT: harga jual saat transaksi
  cost_price      BIGINT NOT NULL,  -- SNAPSHOT: harga beli saat transaksi
  subtotal        BIGINT NOT NULL   -- selling_price * qty
);

-- ============================================================
-- 7. TABEL STOCK_MOVEMENTS (Mutasi Stok / Audit Trail)
-- ============================================================
CREATE TABLE stock_movements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id),
  type          TEXT NOT NULL CHECK (type IN ('sale', 'restock', 'adjustment')),
  qty_change    INTEGER NOT NULL,   -- negatif untuk keluar, positif untuk masuk
  qty_after     INTEGER NOT NULL,   -- stok setelah perubahan
  reference_id  UUID,               -- transaction_id kalau type = 'sale'
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. TABEL SETTINGS (Konfigurasi Toko)
-- ============================================================
CREATE TABLE settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES profiles(id),

  UNIQUE (store_id, key)
);

-- Default settings saat toko pertama kali dibuat
-- Contoh key yang digunakan aplikasi:
-- 'store_name', 'store_address', 'store_phone'
-- 'qris_image_url'     <- URL gambar QRIS statis
-- 'nota_header'        <- teks header nota
-- 'nota_footer'        <- teks footer nota (misal: "Terima kasih!")
-- 'invoice_prefix'     <- prefix kode transaksi, default 'INV'

-- ============================================================
-- 9. INDEXES (Optimasi Query)
-- ============================================================
CREATE INDEX idx_products_store      ON products(store_id, is_active);
CREATE INDEX idx_transactions_store  ON transactions(store_id, created_at DESC);
CREATE INDEX idx_transactions_status ON transactions(store_id, status, created_at DESC);
CREATE INDEX idx_tx_items_tx         ON transaction_items(transaction_id);
CREATE INDEX idx_tx_items_product    ON transaction_items(product_id);
CREATE INDEX idx_stock_mov_product   ON stock_movements(product_id, created_at DESC);
CREATE INDEX idx_settings_store      ON settings(store_id, key);

-- ============================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- Setiap user hanya bisa akses data toko sendiri
-- ============================================================
ALTER TABLE stores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings        ENABLE ROW LEVEL SECURITY;

-- Helper function: ambil store_id dari user yang sedang login
CREATE OR REPLACE FUNCTION auth_store_id()
RETURNS UUID AS $$
  SELECT store_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: ambil role user yang sedang login
CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- STORES: hanya owner yang bisa update
CREATE POLICY "stores_select" ON stores FOR SELECT USING (id = auth_store_id());
CREATE POLICY "stores_update" ON stores FOR UPDATE USING (id = auth_store_id() AND auth_role() = 'owner');

-- PROFILES: bisa lihat semua di toko sendiri, owner bisa manage
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (store_id = auth_store_id());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (store_id = auth_store_id() AND auth_role() = 'owner');
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (store_id = auth_store_id() AND auth_role() = 'owner');

-- PRODUCTS: kasir hanya bisa lihat, owner bisa semua
CREATE POLICY "products_select" ON products FOR SELECT USING (store_id = auth_store_id());
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (store_id = auth_store_id() AND auth_role() = 'owner');
CREATE POLICY "products_update" ON products FOR UPDATE USING (store_id = auth_store_id() AND auth_role() = 'owner');
CREATE POLICY "products_delete" ON products FOR DELETE USING (store_id = auth_store_id() AND auth_role() = 'owner');

-- TRANSACTIONS: kasir bisa insert & select, owner bisa semua (termasuk void)
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (store_id = auth_store_id());
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (store_id = auth_store_id());
CREATE POLICY "transactions_update" ON transactions FOR UPDATE USING (
  store_id = auth_store_id() AND auth_role() = 'owner'
);

-- TRANSACTION_ITEMS: ikut akses transaksi
CREATE POLICY "tx_items_select" ON transaction_items FOR SELECT
  USING (transaction_id IN (SELECT id FROM transactions WHERE store_id = auth_store_id()));
CREATE POLICY "tx_items_insert" ON transaction_items FOR INSERT
  WITH CHECK (transaction_id IN (SELECT id FROM transactions WHERE store_id = auth_store_id()));

-- STOCK_MOVEMENTS: semua bisa insert (otomatis dari transaksi), owner bisa lihat
CREATE POLICY "stock_mov_select" ON stock_movements FOR SELECT USING (store_id = auth_store_id());
CREATE POLICY "stock_mov_insert" ON stock_movements FOR INSERT WITH CHECK (store_id = auth_store_id());

-- SETTINGS: kasir hanya bisa lihat, owner bisa semua
CREATE POLICY "settings_select" ON settings FOR SELECT USING (store_id = auth_store_id());
CREATE POLICY "settings_insert" ON settings FOR INSERT WITH CHECK (store_id = auth_store_id() AND auth_role() = 'owner');
CREATE POLICY "settings_update" ON settings FOR UPDATE USING (store_id = auth_store_id() AND auth_role() = 'owner');

-- ============================================================
-- 11. VIEWS (Laporan Siap Pakai)
-- ============================================================

-- View: Omzet Harian
CREATE OR REPLACE VIEW v_daily_revenue AS
SELECT
  store_id,
  DATE(created_at AT TIME ZONE 'Asia/Jakarta') AS date,
  COUNT(*)                                      AS total_transactions,
  SUM(total_amount)                             AS revenue,
  SUM(discount)                                 AS total_discount
FROM transactions
WHERE status = 'completed'
GROUP BY store_id, DATE(created_at AT TIME ZONE 'Asia/Jakarta');

-- View: Laba Kotor per Hari
CREATE OR REPLACE VIEW v_daily_profit AS
SELECT
  t.store_id,
  DATE(t.created_at AT TIME ZONE 'Asia/Jakarta') AS date,
  SUM(ti.subtotal)                                AS revenue,
  SUM(ti.cost_price * ti.qty)                     AS cogs,
  SUM(ti.subtotal - (ti.cost_price * ti.qty))     AS gross_profit
FROM transaction_items ti
JOIN transactions t ON t.id = ti.transaction_id
WHERE t.status = 'completed'
GROUP BY t.store_id, DATE(t.created_at AT TIME ZONE 'Asia/Jakarta');

-- View: Stok Produk + Alert
CREATE OR REPLACE VIEW v_stock_status AS
SELECT
  id,
  store_id,
  name,
  sku,
  category,
  stock_qty,
  min_stock,
  selling_price,
  cost_price,
  CASE
    WHEN stock_qty = 0      THEN 'habis'
    WHEN stock_qty <= min_stock THEN 'menipis'
    ELSE 'aman'
  END AS stock_status
FROM products
WHERE is_active = TRUE;

-- ============================================================
-- 12. SAMPLE DATA (Untuk Testing — Hapus di Production)
-- ============================================================

-- Buat toko pertama
INSERT INTO stores (id, name, address, phone)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Toko Contoh',
  'Jl. Contoh No. 1, Bandung',
  '08123456789'
);

-- Default settings
INSERT INTO settings (store_id, key, value) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'store_name',     'Toko Contoh'),
  ('a0000000-0000-0000-0000-000000000001', 'store_address',  'Jl. Contoh No. 1, Bandung'),
  ('a0000000-0000-0000-0000-000000000001', 'store_phone',    '08123456789'),
  ('a0000000-0000-0000-0000-000000000001', 'qris_image_url', ''),
  ('a0000000-0000-0000-0000-000000000001', 'nota_header',    'Toko Contoh'),
  ('a0000000-0000-0000-0000-000000000001', 'nota_footer',    'Terima kasih sudah berbelanja!'),
  ('a0000000-0000-0000-0000-000000000001', 'invoice_prefix', 'INV');

-- CATATAN: Buat user owner lewat Supabase Dashboard > Auth > Users
-- Kemudian insert ke profiles dengan role 'owner'
-- Contoh (ganti {USER_ID} dengan UUID user yang dibuat):
--
-- INSERT INTO profiles (id, store_id, full_name, role)
-- VALUES ('{USER_ID}', 'a0000000-0000-0000-0000-000000000001', 'Nama Pemilik', 'owner');
