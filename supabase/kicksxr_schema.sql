-- ============================================================================
-- Kicks XR — Esquema completo y actualizado de base de datos para Supabase
-- Proyecto: kicksxr@appdesign.appdesignproyectos.com's Project
-- Project ID: ayzsvsbxhmbjegrzxlds
-- ============================================================================
-- Instrucciones:
-- 1. Abre Supabase -> SQL Editor -> New query
-- 2. Pega todo este script y presiona "Run"
-- 3. Es 100% idempotente: puedes ejecutarlo de nuevo aunque ya existan tablas.
-- ============================================================================

-- 1. Administradores (contraseñas cifradas con scrypt salt:hash)
CREATE TABLE IF NOT EXISTS public.kicksxr_admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  whatsapp TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibilidad si la tabla ya había sido creada previamente
ALTER TABLE public.kicksxr_admins
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- 2. Clientes registrados
CREATE TABLE IF NOT EXISTS public.kicksxr_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT,
  whatsapp TEXT NOT NULL,
  whatsapp_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  address TEXT NOT NULL,
  maps_url TEXT,
  age INTEGER,
  id_document_number TEXT,
  user_type TEXT NOT NULL DEFAULT 'general',
  ine_photo_data_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibilidad si la tabla ya había sido creada previamente
ALTER TABLE public.kicksxr_clients
  ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.kicksxr_clients
  ADD COLUMN IF NOT EXISTS ine_photo_data_url TEXT;
ALTER TABLE public.kicksxr_clients
  ADD COLUMN IF NOT EXISTS id_document_number TEXT;
ALTER TABLE public.kicksxr_clients
  ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.kicksxr_clients
  ADD COLUMN IF NOT EXISTS maps_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kicksxr_clients_username
  ON public.kicksxr_clients (LOWER(username))
  WHERE username IS NOT NULL;

-- 3. Sedes y Puntos KicksXR
CREATE TABLE IF NOT EXISTS public.kicksxr_campuses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'point',
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 4. Catálogo de Servicios
CREATE TABLE IF NOT EXISTS public.kicksxr_services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  turnaround_hours INTEGER NOT NULL DEFAULT 24,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 5. Lockers autoservicio
CREATE TABLE IF NOT EXISTS public.kicksxr_lockers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  campus_id TEXT NOT NULL REFERENCES public.kicksxr_campuses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'disponible',
  current_bag_code TEXT
);

-- 6. Pedidos
CREATE TABLE IF NOT EXISTS public.kicksxr_orders (
  id TEXT PRIMARY KEY,
  folio TEXT NOT NULL UNIQUE,
  bag_code TEXT NOT NULL UNIQUE,
  order_qr_payload TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_whatsapp TEXT NOT NULL,
  client_age INTEGER,
  client_id_document TEXT,
  client_address TEXT,
  client_maps_url TEXT,
  user_type TEXT NOT NULL DEFAULT 'general',
  campus_id TEXT NOT NULL,
  campus_name TEXT NOT NULL,
  pairs INTEGER NOT NULL DEFAULT 1,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  shipping_fee INTEGER NOT NULL DEFAULT 0,
  discount_code TEXT,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL,
  photo_data_url TEXT,
  after_photo_data_url TEXT,
  shoe_notes TEXT,
  admin_notes TEXT,
  rating INTEGER,
  rating_comment TEXT,
  rated_at TIMESTAMPTZ,
  delivery_method TEXT NOT NULL,
  delivery_address TEXT,
  dropoff_method TEXT,
  assigned_locker_code TEXT,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'Pago pendiente',
  card_last4 TEXT,
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'Pendiente de depósito',
  collection_status TEXT NOT NULL DEFAULT 'Pendiente',
  bag_verified BOOLEAN NOT NULL DEFAULT FALSE,
  collection_date TEXT NOT NULL,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibilidad si kicksxr_orders ya existía previamente
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS after_photo_data_url TEXT;
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS shoe_notes TEXT;
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS rating_comment TEXT;
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ;
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS client_age INTEGER;
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS client_id_document TEXT;
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS client_address TEXT;
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS client_maps_url TEXT;
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS mp_preference_id TEXT;
ALTER TABLE public.kicksxr_orders ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;

-- 7. Incidencias operativas
CREATE TABLE IF NOT EXISTS public.kicksxr_incidents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  bag_code TEXT NOT NULL,
  folio TEXT,
  campus_id TEXT NOT NULL,
  campus_name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Abierta',
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Notificaciones (Admin y Cliente)
CREATE TABLE IF NOT EXISTS public.kicksxr_notifications (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  folio TEXT,
  recipient_whatsapp TEXT,
  recipient_name TEXT,
  channel TEXT NOT NULL DEFAULT 'WhatsApp',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  whatsapp_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Configuración general, secuencias y Mercado Pago
CREATE TABLE IF NOT EXISTS public.kicksxr_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  shipping_fee INTEGER NOT NULL DEFAULT 75,
  next_order_seq INTEGER NOT NULL DEFAULT 1044,
  next_bag_seq INTEGER NOT NULL DEFAULT 30,
  mp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mp_sandbox BOOLEAN NOT NULL DEFAULT TRUE,
  mp_public_key TEXT,
  mp_access_token TEXT
);

ALTER TABLE public.kicksxr_settings ADD COLUMN IF NOT EXISTS mp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.kicksxr_settings ADD COLUMN IF NOT EXISTS mp_sandbox BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.kicksxr_settings ADD COLUMN IF NOT EXISTS mp_public_key TEXT;
ALTER TABLE public.kicksxr_settings ADD COLUMN IF NOT EXISTS mp_access_token TEXT;

INSERT INTO public.kicksxr_settings (id, shipping_fee, next_order_seq, next_bag_seq)
VALUES (1, 75, 1044, 30)
ON CONFLICT (id) DO NOTHING;

-- 10. Cupones y promociones
CREATE TABLE IF NOT EXISTS public.kicksxr_coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  discount_type TEXT NOT NULL DEFAULT 'percent',
  value INTEGER NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Permisos para PostgREST (permite guardar y consultar registros desde la app
-- usando VITE_SUPABASE_ANON_KEY / publishable key sin bloqueos de permisos)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE
  public.kicksxr_admins,
  public.kicksxr_clients,
  public.kicksxr_campuses,
  public.kicksxr_services,
  public.kicksxr_lockers,
  public.kicksxr_orders,
  public.kicksxr_incidents,
  public.kicksxr_notifications,
  public.kicksxr_settings,
  public.kicksxr_coupons
TO anon, authenticated, service_role;

ALTER TABLE public.kicksxr_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kicksxr_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kicksxr_campuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kicksxr_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kicksxr_lockers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kicksxr_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kicksxr_incidents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kicksxr_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kicksxr_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kicksxr_coupons DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Credenciales iniciales de Administrador (hash scrypt seguro)
-- Usuarios creados:
--   1) Nombre: Harold Anguiano | Usuario: haroldo90 | Rol: admin
--   2) Nombre: Administrador 1 | Usuario: admin_1   | Rol: admin
-- ============================================================================
INSERT INTO public.kicksxr_admins (id, name, username, email, role, password_hash, active)
VALUES
  (
    'adm-haroldo90',
    'Harold Anguiano',
    'haroldo90',
    'haroldo90@kicksxr.com',
    'admin',
    '0e6cf9ddd5648fa3c0dab0bc6e0318ca:4be5db02406dc8acfaecf05572a32ae7b70bf76c55a0b93d8e1a7c53b6282586d3605ca9e2578d1d625ac830baec338b99fc7ce747d52b1c5cfc41cccd0dc656',
    TRUE
  ),
  (
    'adm-admin1',
    'Administrador 1',
    'admin_1',
    'admin_1@kicksxr.com',
    'admin',
    '5f9024aa6e59695b4157757f5c24711c:a57ef8566d32d1808f69522395e491ff9e2dfe4ac841a5d2719f5d96ca3a229a0dc053bebd9776dfc8627e2e12bf493d6e231fed1f1ff69b583ed6b2ce1583ff',
    TRUE
  )
ON CONFLICT (username) DO UPDATE
SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  active = TRUE;

-- ============================================================================
-- Datos iniciales de Sedes, Servicios, Lockers y Cupones
-- ============================================================================
INSERT INTO public.kicksxr_campuses (id, name, code, address, type, active)
VALUES
  ('campus-central', 'Campus Central', 'KXR-CAMPUS-CENTRAL', 'Av. Universidad 3000, Módulo A, PB', 'point', TRUE),
  ('campus-norte', 'Campus Norte', 'KXR-CAMPUS-NORTE', 'Blvd. Tecnológico 450, Edificio C', 'point', TRUE),
  ('punto-roma', 'Punto KicksXR Roma', 'KXR-PUNTO-ROMA', 'Calle Orizaba 112, Col. Roma Norte', 'point', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kicksxr_services (id, name, description, price, turnaround_hours, active)
VALUES
  ('svc-basic', 'Limpieza básica', 'Lavado exterior de suela, media suela y agujetas.', 180, 24, TRUE),
  ('svc-premium', 'Limpieza premium', 'Limpieza profunda interior y exterior, desodorización UV y acondicionamiento.', 290, 36, TRUE),
  ('svc-deep', 'Restauración profunda', 'Tratamiento de gamuza/piel, blanqueamiento de suela y revitalización de color.', 420, 48, TRUE),
  ('svc-protect', 'Limpieza + Impermeabilización', 'Limpieza premium con capa hidrofóbica repelente a agua y manchas.', 350, 36, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kicksxr_lockers (id, code, campus_id, status)
VALUES
  ('lk-1', 'L-01', 'campus-central', 'disponible'),
  ('lk-2', 'L-02', 'campus-central', 'disponible'),
  ('lk-3', 'L-03', 'campus-central', 'disponible'),
  ('lk-4', 'L-04', 'campus-central', 'disponible'),
  ('lk-5', 'L-05', 'campus-norte', 'disponible'),
  ('lk-6', 'L-06', 'campus-norte', 'disponible'),
  ('lk-7', 'L-07', 'punto-roma', 'disponible'),
  ('lk-8', 'L-08', 'punto-roma', 'disponible')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kicksxr_coupons (id, code, description, discount_type, value, active, usage_count)
VALUES
  ('cpn-bienvenido', 'BIENVENIDO10', '10% de descuento en tu servicio de limpieza', 'percent', 10, TRUE, 0),
  ('cpn-kicks50', 'KICKS50', '$50 MXN de descuento directo en tu pedido', 'fixed', 50, TRUE, 0)
ON CONFLICT (id) DO NOTHING;

-- Índices recomendados para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_kicksxr_orders_client ON public.kicksxr_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_kicksxr_orders_status ON public.kicksxr_orders(status);
CREATE INDEX IF NOT EXISTS idx_kicksxr_notifications_order ON public.kicksxr_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_kicksxr_incidents_status ON public.kicksxr_incidents(status);
CREATE INDEX IF NOT EXISTS idx_kicksxr_clients_whatsapp ON public.kicksxr_clients(whatsapp_normalized);
CREATE INDEX IF NOT EXISTS idx_kicksxr_coupons_code ON public.kicksxr_coupons(UPPER(code));

-- Refrescar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
