import crypto from 'crypto';
import dotenv from 'dotenv';
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {isSupabaseConfigured, supabaseStore} from './supabase.ts';
import type {
  AuthUser,
  Campus,
  Coupon,
  DeliveryMethod,
  DropoffMethod,
  Incident,
  IncidentStatus,
  IncidentType,
  Locker,
  NotificationLog,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ServiceItem,
  UserRole,
} from '../types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL
  ? path.resolve('/tmp', 'kicksxr-data')
  : path.resolve(__dirname, '../../data');
const DB_PATH = path.resolve(DATA_DIR, 'kicksxr-db.json');

if (!DB_PATH.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid database path');
}

function resolveSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  // Across serverless instances on Vercel, derive a stable key from deployment/service env vars
  // so tokens signed by one instance remain valid on sibling instances.
  const serverlessSeed =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VERCEL_PROJECT_ID ||
    process.env.VERCEL_GIT_REPO_ID ||
    '';
  if (IS_VERCEL && serverlessSeed.length >= 8) {
    return crypto
      .createHmac('sha256', serverlessSeed)
      .update('kicksxr-session-v1')
      .digest('hex');
  }
  return crypto.randomBytes(32).toString('hex');
}

const SESSION_SECRET = resolveSessionSecret();

const IMAGE_DATA_URL_REGEX =
  /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

interface StoredAdmin {
  id: string;
  username: string;
  email?: string;
  whatsapp?: string;
  name: string;
  passwordHash: string;
  active?: boolean;
  createdAt: string;
}

const PRE_REGISTERED_ADMINS: StoredAdmin[] = [
  {
    id: 'adm-haroldo90',
    username: 'haroldo90',
    email: 'haroldo90@kicksxr.com',
    name: 'Harold Anguiano',
    passwordHash:
      '0e6cf9ddd5648fa3c0dab0bc6e0318ca:4be5db02406dc8acfaecf05572a32ae7b70bf76c55a0b93d8e1a7c53b6282586d3605ca9e2578d1d625ac830baec338b99fc7ce747d52b1c5cfc41cccd0dc656',
    active: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'adm-admin1',
    username: 'admin_1',
    email: 'admin_1@kicksxr.com',
    name: 'Administrador 1',
    passwordHash:
      '5f9024aa6e59695b4157757f5c24711c:a57ef8566d32d1808f69522395e491ff9e2dfe4ac841a5d2719f5d96ca3a229a0dc053bebd9776dfc8627e2e12bf493d6e231fed1f1ff69b583ed6b2ce1583ff',
    active: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

interface StoredClient {
  id: string;
  name: string;
  username?: string;
  whatsapp: string;
  whatsappNormalized: string;
  passwordHash?: string;
  address: string;
  userType: 'general' | 'university';
  campusId?: string;
  createdAt: string;
}

interface DatabaseState {
  admin?: StoredAdmin | null;
  admins: StoredAdmin[];
  clients: StoredClient[];
  campuses: Campus[];
  services: ServiceItem[];
  lockers: Locker[];
  coupons: Coupon[];
  shippingFee: number;
  nextOrderSeq: number;
  nextBagSeq: number;
  orders: Order[];
  incidents: Incident[];
  notifications: NotificationLog[];
}

const DEFAULT_COUPONS: Coupon[] = [
  {
    id: 'cpn-bienvenido',
    code: 'BIENVENIDO10',
    description: '10% de descuento en tu servicio de limpieza',
    discountType: 'percent',
    value: 10,
    active: true,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'cpn-kicks50',
    code: 'KICKS50',
    description: '$50 MXN de descuento directo en tu pedido',
    discountType: 'fixed',
    value: 50,
    active: true,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

function normalizePhone(raw: string): string {
  return String(raw || '').replace(/\D/g, '').slice(0, 15);
}

function sanitizeText(raw: unknown, maxLen = 200): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLen);
}

function sanitizeUsername(raw: unknown): string {
  return sanitizeText(raw, 50)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

function constantTimeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

interface TokenPayload {
  sub: string;
  role: UserRole;
  name: string;
  username?: string;
  exp: number;
}

function signToken(payload: Omit<TokenPayload, 'exp'>): string {
  const full: TokenPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const encoded = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const bufA = Buffer.from(sig);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as TokenPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function createInitialDb(): DatabaseState {
  const now = new Date().toISOString();
  const today = todayDateStr();

  const campuses: Campus[] = [
    {
      id: 'campus-central',
      name: 'Campus Central',
      code: 'KXR-CAMPUS-CENTRAL',
      address: 'Av. Universidad 3000, Módulo A, PB',
      type: 'point',
      active: true,
    },
    {
      id: 'campus-norte',
      name: 'Campus Norte',
      code: 'KXR-CAMPUS-NORTE',
      address: 'Blvd. Tecnológico 450, Edificio C',
      type: 'point',
      active: true,
    },
    {
      id: 'punto-roma',
      name: 'Punto KicksXR Roma',
      code: 'KXR-PUNTO-ROMA',
      address: 'Calle Orizaba 112, Col. Roma Norte',
      type: 'point',
      active: true,
    },
  ];

  const services: ServiceItem[] = [
    {
      id: 'svc-basic',
      name: 'Limpieza básica',
      description: 'Lavado exterior de suela, media suela y agujetas.',
      price: 180,
      turnaroundHours: 24,
      active: true,
    },
    {
      id: 'svc-premium',
      name: 'Limpieza premium',
      description:
        'Limpieza profunda interior y exterior, desodorización UV y acondicionamiento.',
      price: 290,
      turnaroundHours: 36,
      active: true,
    },
    {
      id: 'svc-deep',
      name: 'Restauración profunda',
      description:
        'Tratamiento de gamuza/piel, blanqueamiento de suela y revitalización de color.',
      price: 420,
      turnaroundHours: 48,
      active: true,
    },
    {
      id: 'svc-protect',
      name: 'Limpieza + Impermeabilización',
      description:
        'Limpieza premium con capa hidrofóbica repelente a agua y manchas.',
      price: 350,
      turnaroundHours: 36,
      active: true,
    },
  ];

  const lockers: Locker[] = [
    {id: 'lk-1', code: 'L-01', campusId: 'campus-central', status: 'ocupado', currentBagCode: 'B-028'},
    {id: 'lk-2', code: 'L-02', campusId: 'campus-central', status: 'ocupado', currentBagCode: 'B-029'},
    {id: 'lk-3', code: 'L-03', campusId: 'campus-central', status: 'disponible'},
    {id: 'lk-4', code: 'L-04', campusId: 'campus-central', status: 'disponible'},
    {id: 'lk-5', code: 'L-05', campusId: 'campus-norte', status: 'disponible'},
    {id: 'lk-6', code: 'L-06', campusId: 'campus-norte', status: 'disponible'},
    {id: 'lk-7', code: 'L-07', campusId: 'punto-roma', status: 'disponible'},
    {id: 'lk-8', code: 'L-08', campusId: 'punto-roma', status: 'disponible'},
  ];

  const orders: Order[] = [
    {
      id: 'ord-1042',
      folio: 'KXR-1042',
      bagCode: 'B-028',
      orderQrPayload: 'KICKSXR|KXR-1042|B-028|campus-central',
      clientId: 'cli-seed-1',
      clientName: 'Sofía Martínez',
      clientWhatsapp: '5512345678',
      userType: 'general',
      campusId: 'campus-central',
      campusName: 'Campus Central',
      pairs: 1,
      serviceId: 'svc-premium',
      serviceName: 'Limpieza premium',
      unitPrice: 290,
      shippingFee: 0,
      totalAmount: 290,
      deliveryMethod: 'pickup',
      dropoffMethod: 'locker',
      assignedLockerCode: 'L-01',
      paymentMethod: 'cash',
      paymentStatus: 'Pago pendiente',
      status: 'Depósito reportado',
      collectionStatus: 'Pendiente',
      bagVerified: false,
      createdAt: now,
      collectionDate: today,
      updatedAt: now,
      history: [
        {
          status: 'Depósito reportado',
          timestamp: now,
          note: 'Bolsa depositada en locker L-01 (Campus Central)',
        },
      ],
    },
    {
      id: 'ord-1043',
      folio: 'KXR-1043',
      bagCode: 'B-029',
      orderQrPayload: 'KICKSXR|KXR-1043|B-029|campus-central',
      clientId: 'cli-seed-2',
      clientName: 'Diego Hernández',
      clientWhatsapp: '5587654321',
      userType: 'general',
      campusId: 'campus-central',
      campusName: 'Campus Central',
      pairs: 2,
      serviceId: 'svc-basic',
      serviceName: 'Limpieza básica',
      unitPrice: 180,
      shippingFee: 75,
      totalAmount: 435,
      deliveryMethod: 'delivery',
      deliveryAddress: 'Av. Álvaro Obregón 210, Depto 4B, Roma Norte',
      dropoffMethod: 'locker',
      assignedLockerCode: 'L-02',
      paymentMethod: 'card',
      paymentStatus: 'Pagado',
      cardLast4: '4242',
      status: 'Depósito reportado',
      collectionStatus: 'Pendiente',
      bagVerified: false,
      createdAt: now,
      collectionDate: today,
      updatedAt: now,
      history: [
        {
          status: 'Depósito reportado',
          timestamp: now,
          note: 'Bolsa depositada en locker L-02 (Campus Central)',
        },
      ],
    },
    {
      id: 'ord-1041',
      folio: 'KXR-1041',
      bagCode: 'B-027',
      orderQrPayload: 'KICKSXR|KXR-1041|B-027|campus-norte',
      clientId: 'cli-seed-3',
      clientName: 'Valeria Cruz',
      clientWhatsapp: '5544332211',
      userType: 'general',
      campusId: 'campus-norte',
      campusName: 'Campus Norte',
      pairs: 1,
      serviceId: 'svc-deep',
      serviceName: 'Restauración profunda',
      unitPrice: 420,
      shippingFee: 0,
      totalAmount: 420,
      deliveryMethod: 'pickup',
      dropoffMethod: 'staff',
      paymentMethod: 'card',
      paymentStatus: 'Pagado',
      cardLast4: '8819',
      status: 'Listo para entrega',
      collectionStatus: 'Recolectado',
      bagVerified: true,
      createdAt: now,
      collectionDate: today,
      updatedAt: now,
      history: [
        {
          status: 'Depósito reportado',
          timestamp: now,
          note: 'Entregado con personal en Campus Norte',
        },
        {
          status: 'Recibido por KicksXR',
          timestamp: now,
          note: 'Bolsa B-027 verificada en taller',
        },
        {
          status: 'En limpieza',
          timestamp: now,
          note: 'Proceso de restauración profunda en curso',
        },
        {
          status: 'Listo para entrega',
          timestamp: now,
          note: 'Calzado listo para recoger en Campus Norte',
        },
      ],
    },
  ];

  const incidents: Incident[] = [
    {
      id: 'inc-seed-1',
      type: 'Bolsa sin pedido',
      bagCode: 'B-026',
      campusId: 'punto-roma',
      campusName: 'Punto KicksXR Roma',
      description: 'Bolsa recibida en mostrador sin folio vinculado en sistema.',
      status: 'En revisión',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const notifications: NotificationLog[] = [
    {
      id: 'ntf-seed-1',
      orderId: 'ord-1042',
      folio: 'KXR-1042',
      recipientWhatsapp: '5512345678',
      recipientName: 'Sofía Martínez',
      channel: 'WhatsApp',
      title: 'Depósito reportado · KXR-1042',
      message:
        'Bolsa B-028 depositada en locker L-01 (Campus Central) lista para recolección.',
      whatsappUrl:
        'https://wa.me/525512345678?text=Hola%20Sof%C3%ADa%2C%20registramos%20tu%20bolsa%20B-028%20(KXR-1042).',
      read: false,
      createdAt: now,
    },
    {
      id: 'ntf-seed-2',
      orderId: 'ord-1041',
      folio: 'KXR-1041',
      recipientWhatsapp: '5544332211',
      recipientName: 'Valeria Cruz',
      channel: 'WhatsApp',
      title: 'Listo para entrega · KXR-1041',
      message:
        'Tus tenis del folio KXR-1041 (Bolsa B-027) están listos para recoger en Campus Norte.',
      whatsappUrl:
        'https://wa.me/525544332211?text=Hola%20Valeria%2C%20tu%20pedido%20KXR-1041%20est%C3%A1%20listo%20para%20entrega.',
      read: false,
      createdAt: now,
    },
  ];

  return {
    admins: PRE_REGISTERED_ADMINS.map((a) => ({...a})),
    clients: [],
    campuses,
    services,
    lockers,
    coupons: DEFAULT_COUPONS.map((c) => ({...c})),
    shippingFee: 75,
    nextOrderSeq: 1044,
    nextBagSeq: 30,
    orders,
    incidents,
    notifications,
  };
}

function ensurePreRegisteredAdmins(state: DatabaseState): boolean {
  let changed = false;
  if (!Array.isArray(state.admins)) {
    state.admins = [];
    changed = true;
  }
  for (const preset of PRE_REGISTERED_ADMINS) {
    const exists = state.admins.some(
      (a) => a.username.toLowerCase() === preset.username.toLowerCase(),
    );
    if (!exists) {
      state.admins.push({...preset});
      changed = true;
    }
  }
  return changed;
}

function saveDb(state: DatabaseState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {recursive: true});
    }
    const tmpPath = path.resolve(
      DATA_DIR,
      `kicksxr-db.${process.pid}.${Date.now()}.tmp`,
    );
    if (!tmpPath.startsWith(DATA_DIR + path.sep)) {
      throw new Error('Invalid temp database path');
    }
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmpPath, DB_PATH);
  } catch (err) {
    if (!IS_VERCEL) {
      console.error('Warning saving local DB cache:', err);
    }
  }
}

function loadDb(): DatabaseState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {recursive: true});
    }
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw) as DatabaseState;
      if (parsed && Array.isArray(parsed.campuses) && Array.isArray(parsed.orders)) {
        if (!Array.isArray(parsed.admins)) {
          parsed.admins = [];
        }
        if (!Array.isArray(parsed.coupons)) {
          parsed.coupons = DEFAULT_COUPONS.map((c) => ({...c}));
        }
        if (parsed.admin && parsed.admins.length === 0) {
          parsed.admins.push({
            id: 'adm-migrated',
            username: parsed.admin.email?.split('@')[0] || 'admin',
            email: parsed.admin.email,
            name: parsed.admin.name,
            passwordHash: parsed.admin.passwordHash,
            active: true,
            createdAt: parsed.admin.createdAt,
          });
        }
        if (ensurePreRegisteredAdmins(parsed)) {
          saveDb(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading DB, initializing fresh state:', err);
  }
  const initial = createInitialDb();
  saveDb(initial);
  return initial;
}

const db: DatabaseState = loadDb();

function buildCredentialsPayload(params: {
  req: Request;
  role: UserRole;
  name: string;
  identifier: string;
  password: string;
  whatsapp?: string;
}) {
  const forwardedProto =
    typeof params.req.headers['x-forwarded-proto'] === 'string'
      ? params.req.headers['x-forwarded-proto'].split(',')[0].trim()
      : params.req.protocol;
  const hostHeader =
    (typeof params.req.headers['x-forwarded-host'] === 'string' &&
      params.req.headers['x-forwarded-host'].split(',')[0].trim()) ||
    params.req.get('host') ||
    'localhost:3000';
  const originHeader =
    (typeof params.req.headers.origin === 'string' && params.req.headers.origin) ||
    (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
      ? process.env.APP_URL
      : `${forwardedProto}://${hostHeader}`);
  const loginUrl = originHeader.replace(/\/+$/, '');
  const roleLabel = params.role === 'admin' ? 'Administrador' : 'Cliente';
  const idLabel = 'Usuario';

  const shareMessage = [
    `¡Hola ${params.name}! Tus credenciales de acceso a Kicks XR (${roleLabel}) están listas:`,
    ``,
    `• Rol: ${roleLabel}`,
    `• ${idLabel}: ${params.identifier}`,
    `• Contraseña: ${params.password}`,
    `• Acceso a la app: ${loginUrl}`,
    ``,
    `Ingresa seleccionando el perfil "${roleLabel}" en Kicks XR.`,
  ].join('\n');

  const cleanPhone = params.whatsapp ? normalizePhone(params.whatsapp) : '';
  const waPhone = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone;
  const whatsappUrl = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(shareMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  return {
    role: params.role,
    name: params.name,
    identifier: params.identifier,
    password: params.password,
    whatsapp: params.whatsapp,
    loginUrl,
    shareMessage,
    whatsappUrl,
  };
}

let lastHydratedAt = 0;
let hydratingPromise: Promise<void> | null = null;
const HYDRATE_TTL_MS = IS_VERCEL ? 2500 : 15000;

async function hydrateFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const [
      sbAdmins,
      sbClients,
      sbCampuses,
      sbServices,
      sbLockers,
      sbOrders,
      sbIncidents,
      sbNotifications,
      sbSettings,
      sbCoupons,
    ] = await Promise.all([
      supabaseStore.listAdmins(),
      supabaseStore.listClients(),
      supabaseStore.listCampuses(),
      supabaseStore.listServices(),
      supabaseStore.listLockers(),
      supabaseStore.listOrders(),
      supabaseStore.listIncidents(),
      supabaseStore.listNotifications(),
      supabaseStore.getSettings(),
      supabaseStore.listCoupons(),
    ]);

    let changed = false;

    if (sbAdmins && sbAdmins.length > 0) {
      for (const row of sbAdmins) {
        const rowUsername = String(row.username || '').trim();
        if (!row.id || !rowUsername) continue;
        const idx = db.admins.findIndex(
          (a) =>
            a.id === row.id ||
            a.username.toLowerCase() === rowUsername.toLowerCase(),
        );
        const mapped: StoredAdmin = {
          id: row.id,
          username: rowUsername,
          email: row.email || undefined,
          whatsapp: row.whatsapp || undefined,
          name: String(row.name || rowUsername),
          passwordHash: String(row.password_hash || ''),
          active: row.active !== false,
          createdAt: row.created_at || new Date().toISOString(),
        };
        if (idx >= 0) db.admins[idx] = mapped;
        else db.admins.push(mapped);
        changed = true;
      }
    }

    if (sbClients && sbClients.length > 0) {
      for (const row of sbClients) {
        if (!row.id) continue;
        const waNorm = String(row.whatsapp_normalized || normalizePhone(row.whatsapp || ''));
        const rowUsername = row.username ? sanitizeUsername(row.username) : undefined;
        const idx = db.clients.findIndex(
          (c) =>
            c.id === row.id ||
            (rowUsername && c.username?.toLowerCase() === rowUsername) ||
            (waNorm && c.whatsappNormalized === waNorm),
        );
        const mapped: StoredClient = {
          id: row.id,
          name: String(row.name || 'Cliente'),
          username: rowUsername || (idx >= 0 ? db.clients[idx].username : undefined),
          whatsapp: String(row.whatsapp || waNorm),
          whatsappNormalized: waNorm,
          passwordHash: row.password_hash || undefined,
          address: String(row.address || ''),
          userType: row.user_type || 'general',
          createdAt: row.created_at || new Date().toISOString(),
        };
        if (idx >= 0) db.clients[idx] = mapped;
        else db.clients.push(mapped);
        changed = true;
      }
    }

    if (sbCampuses && sbCampuses.length > 0) {
      db.campuses = sbCampuses;
      changed = true;
    }
    if (sbServices && sbServices.length > 0) {
      db.services = sbServices;
      changed = true;
    }
    if (sbLockers && sbLockers.length > 0) {
      db.lockers = sbLockers;
      changed = true;
    }
    if (sbOrders && sbOrders.length > 0) {
      const merged = new Map<string, Order>();
      for (const o of db.orders) merged.set(o.id, o);
      for (const o of sbOrders) merged.set(o.id, o);
      db.orders = Array.from(merged.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      changed = true;
    }
    if (sbIncidents && sbIncidents.length > 0) {
      const merged = new Map<string, Incident>();
      for (const i of db.incidents) merged.set(i.id, i);
      for (const i of sbIncidents) merged.set(i.id, i);
      db.incidents = Array.from(merged.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      changed = true;
    }
    if (sbNotifications && sbNotifications.length > 0) {
      const merged = new Map<string, NotificationLog>();
      for (const n of db.notifications) merged.set(n.id, n);
      for (const n of sbNotifications) merged.set(n.id, n);
      db.notifications = Array.from(merged.values())
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 200);
      changed = true;
    }
    if (sbSettings) {
      db.shippingFee = sbSettings.shipping_fee;
      db.nextOrderSeq = Math.max(db.nextOrderSeq, sbSettings.next_order_seq);
      db.nextBagSeq = Math.max(db.nextBagSeq, sbSettings.next_bag_seq);
      changed = true;
    }
    if (sbCoupons && sbCoupons.length > 0) {
      db.coupons = sbCoupons;
      changed = true;
    }

    lastHydratedAt = Date.now();
    if (changed) {
      saveDb(db);
    }
  } catch (err) {
    console.error('Supabase hydration warning:', err);
  }
}

async function ensureFreshState(force = false): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const stale = Date.now() - lastHydratedAt > HYDRATE_TTL_MS;
  if (!force && lastHydratedAt > 0 && !stale) return;
  if (!hydratingPromise) {
    hydratingPromise = hydrateFromSupabase().finally(() => {
      hydratingPromise = null;
    });
  }
  await hydratingPromise;
}

// SSE clients
const sseClients = new Set<Response>();

function broadcastEvent(payload: {
  type: 'orders' | 'incidents' | 'config' | 'notifications';
  folio?: string;
  orderId?: string;
  status?: string;
  title?: string;
  message?: string;
}) {
  if (sseClients.size === 0) return;
  const data = `event: update\ndata: ${JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
}

async function createNotification(params: {
  orderId?: string;
  folio?: string;
  recipientWhatsapp?: string;
  recipientName?: string;
  title: string;
  message: string;
}): Promise<NotificationLog> {
  const cleanPhone = params.recipientWhatsapp
    ? normalizePhone(params.recipientWhatsapp)
    : '';
  const waPhone = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone;
  const whatsappUrl = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(params.message)}`
    : undefined;

  const entry: NotificationLog = {
    id: `ntf-${crypto.randomUUID().slice(0, 8)}`,
    orderId: params.orderId,
    folio: params.folio,
    recipientWhatsapp: params.recipientWhatsapp,
    recipientName: params.recipientName,
    channel: 'WhatsApp',
    title: params.title,
    message: params.message,
    whatsappUrl,
    read: false,
    createdAt: new Date().toISOString(),
  };

  db.notifications.unshift(entry);
  if (db.notifications.length > 200) {
    db.notifications = db.notifications.slice(0, 200);
  }
  saveDb(db);
  if (isSupabaseConfigured()) {
    await supabaseStore.upsertNotification(entry);
  }
  broadcastEvent({
    type: 'notifications',
    folio: params.folio,
    orderId: params.orderId,
    title: params.title,
    message: params.folio
      ? `Actualización en el folio ${params.folio}: ${params.title}`
      : params.title,
  });
  return entry;
}

function getNextBagCode(): string {
  const existing = new Set(db.orders.map((o) => o.bagCode));
  while (existing.has(`B-${String(db.nextBagSeq).padStart(3, '0')}`)) {
    db.nextBagSeq += 1;
  }
  const code = `B-${String(db.nextBagSeq).padStart(3, '0')}`;
  db.nextBagSeq += 1;
  return code;
}

function getNextFolio(): string {
  const folio = `KXR-${db.nextOrderSeq}`;
  db.nextOrderSeq += 1;
  return folio;
}

interface AuthedRequest extends Request {
  auth?: TokenPayload;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({error: 'Se requiere autenticación.'});
    return;
  }
  const token = header.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({error: 'Sesión inválida o expirada.'});
    return;
  }
  req.auth = payload;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.auth?.role !== 'admin') {
      res.status(403).json({error: 'Acceso restringido a administradores.'});
      return;
    }
    next();
  });
}

function buildPublicConfig() {
  const availableLockersByCampus: Record<string, number> = {};
  for (const campus of db.campuses) {
    availableLockersByCampus[campus.id] = db.lockers.filter(
      (l) => l.campusId === campus.id && l.status === 'disponible',
    ).length;
  }
  return {
    campuses: db.campuses.filter((c) => c.active),
    services: db.services.filter((s) => s.active),
    shippingFee: db.shippingFee,
    availableLockersByCampus,
    supabaseConnected: isSupabaseConfigured(),
  };
}

function buildAuthUserFromClient(client: StoredClient): AuthUser {
  const campus = db.campuses.find((c) => c.id === client.campusId);
  return {
    id: client.id,
    role: 'client',
    name: client.name,
    username: client.username,
    whatsapp: client.whatsapp,
    address: client.address,
    userType: client.userType,
    campusId: client.campusId,
    campusName: campus?.name,
  };
}

const VALID_STATUSES: OrderStatus[] = [
  'Pendiente de depósito',
  'Depósito reportado',
  'Recibido por KicksXR',
  'En limpieza',
  'Listo para entrega',
  'Entregado',
  'Cancelado',
];

function buildOrderWhatsappUrl(order: Order, customMessage?: string): string {
  const digits = normalizePhone(order.clientWhatsapp);
  const waPhone = digits.length === 10 ? `52${digits}` : digits;
  const text =
    customMessage ||
    `¡Hola ${order.clientName}! Kicks XR te informa sobre tu pedido ${order.folio} (Bolsa ${order.bagCode} · ${order.serviceName}): su estatus actual es "${order.status}". Total: $${order.totalAmount} MXN (${order.paymentStatus}).`;
  return waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function calculateCouponDiscount(
  couponCode: string | undefined,
  subtotal: number,
): {coupon: Coupon | null; discountAmount: number; error?: string} {
  const clean = sanitizeText(couponCode, 30).toUpperCase();
  if (!clean) return {coupon: null, discountAmount: 0};
  const coupon = db.coupons.find((c) => c.code.toUpperCase() === clean);
  if (!coupon) {
    return {coupon: null, discountAmount: 0, error: 'El cupón ingresado no existe.'};
  }
  if (!coupon.active) {
    return {coupon: null, discountAmount: 0, error: 'Este cupón ya no está activo.'};
  }
  const rawDiscount =
    coupon.discountType === 'percent'
      ? Math.round((subtotal * coupon.value) / 100)
      : Math.round(coupon.value);
  const discountAmount = Math.max(0, Math.min(subtotal, rawDiscount));
  return {coupon, discountAmount};
}

function releaseOrderLocker(order: Order, writes: Promise<unknown>[]) {
  const locker = db.lockers.find(
    (l) =>
      l.currentBagCode === order.bagCode ||
      (order.assignedLockerCode &&
        l.code === order.assignedLockerCode &&
        l.campusId === order.campusId &&
        l.status === 'ocupado'),
  );
  if (locker) {
    locker.status = 'disponible';
    locker.currentBagCode = undefined;
    if (isSupabaseConfigured()) {
      writes.push(supabaseStore.upsertLocker(locker));
    }
  }
}

const VALID_INCIDENT_TYPES: IncidentType[] = [
  'Bolsa faltante',
  'Bolsa sin pedido',
  'Código duplicado',
];

const VALID_INCIDENT_STATUSES: IncidentStatus[] = [
  'Abierta',
  'En revisión',
  'Resuelta',
];

export function createApiApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({limit: '6mb'}));

  // Real-time SSE endpoint (non-PII notifications & state invalidations)
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    if (IS_VERCEL) {
      // Serverless functions cannot hold open infinite streams; reply cleanly so clients use periodic sync
      res.write(`retry: 20000\nevent: connected\ndata: {"ok":true,"mode":"serverless"}\n\n`);
      res.end();
      return;
    }

    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`event: connected\ndata: {"ok":true}\n\n`);
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // Public catalog config
  app.get('/api/public/config', async (_req, res) => {
    await ensureFreshState();
    res.json(buildPublicConfig());
  });

  // Sanitized order tracking by folio or bag code
  app.get('/api/orders/track/:folio', async (req, res) => {
    await ensureFreshState();
    const folio = sanitizeText(req.params.folio, 32).toUpperCase();
    const order = db.orders.find(
      (o) => o.folio.toUpperCase() === folio || o.bagCode.toUpperCase() === folio,
    );
    if (!order) {
      res.status(404).json({
        error: 'No encontramos un pedido con ese folio o código de bolsa.',
      });
      return;
    }
    res.json({
      folio: order.folio,
      bagCode: order.bagCode,
      campusName: order.campusName,
      pairs: order.pairs,
      serviceName: order.serviceName,
      deliveryMethod: order.deliveryMethod,
      dropoffMethod: order.dropoffMethod,
      assignedLockerCode: order.assignedLockerCode,
      paymentStatus: order.paymentStatus,
      status: order.status,
      photoDataUrl: order.photoDataUrl,
      afterPhotoDataUrl: order.afterPhotoDataUrl,
      shoeNotes: order.shoeNotes,
      rating: order.rating,
      ratingComment: order.ratingComment,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      history: order.history,
    });
  });

  // Validate discount coupon
  app.post('/api/coupons/validate', requireAuth, async (req, res) => {
    await ensureFreshState();
    const code = sanitizeText(req.body?.code, 30).toUpperCase();
    const subtotal = Number(req.body?.subtotal || 0);
    if (!code) {
      res.status(400).json({error: 'Ingresa un código de cupón.'});
      return;
    }
    const {coupon, discountAmount, error} = calculateCouponDiscount(
      code,
      Math.max(0, Number.isFinite(subtotal) ? subtotal : 0),
    );
    if (!coupon || error) {
      res.status(404).json({error: error || 'Cupón no válido.'});
      return;
    }
    res.json({
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        value: coupon.value,
      },
      discountAmount,
    });
  });

  // --- CLIENT AUTH ---
  app.post('/api/auth/client/register', async (req, res) => {
    const name = sanitizeText(req.body?.name, 80);
    const username = sanitizeUsername(req.body?.username);
    const whatsapp = sanitizeText(req.body?.whatsapp, 25);
    const whatsappNormalized = normalizePhone(whatsapp);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const address = sanitizeText(req.body?.address, 220);

    if (name.length < 2) {
      res.status(400).json({error: 'Ingresa tu nombre completo.'});
      return;
    }
    if (username.length < 3) {
      res.status(400).json({
        error: 'Ingresa un nombre de usuario válido (mínimo 3 caracteres, sin espacios).',
      });
      return;
    }
    if (whatsappNormalized.length < 10) {
      res.status(400).json({
        error: 'Ingresa un número de WhatsApp válido de al menos 10 dígitos.',
      });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({error: 'La contraseña debe tener al menos 6 caracteres.'});
      return;
    }
    if (address.length < 5) {
      res.status(400).json({error: 'Ingresa tu dirección de entrega.'});
      return;
    }

    const existingUsernameLocal = db.clients.find(
      (c) => c.username && c.username.toLowerCase() === username,
    );
    const existingUsernameSb = isSupabaseConfigured()
      ? await supabaseStore.findClientByUsername(username)
      : null;

    if (existingUsernameLocal || existingUsernameSb) {
      res.status(409).json({
        error: `El usuario "${username}" ya está registrado. Elige otro nombre de usuario o inicia sesión.`,
      });
      return;
    }

    const existingLocal = db.clients.find(
      (c) => c.whatsappNormalized === whatsappNormalized && c.passwordHash,
    );
    const existingSb = isSupabaseConfigured()
      ? await supabaseStore.findClientByWhatsapp(whatsappNormalized)
      : null;

    if (existingLocal || existingSb) {
      res.status(409).json({
        error: 'Ya existe una cuenta registrada con ese WhatsApp. Inicia sesión.',
      });
      return;
    }

    const passwordHash = hashPassword(password);
    const client: StoredClient = {
      id: `cli-${crypto.randomUUID().slice(0, 10)}`,
      name,
      username,
      whatsapp,
      whatsappNormalized,
      passwordHash,
      address,
      userType: 'general',
      createdAt: new Date().toISOString(),
    };
    db.clients.push(client);
    saveDb(db);

    if (isSupabaseConfigured()) {
      await supabaseStore.upsertClient({
        id: client.id,
        name: client.name,
        username: client.username,
        whatsapp: client.whatsapp,
        whatsapp_normalized: client.whatsappNormalized,
        password_hash: passwordHash,
        address: client.address,
        user_type: 'general',
        created_at: client.createdAt,
      });
    }

    const token = signToken({
      sub: client.id,
      role: 'client',
      name: client.name,
      username: client.username,
    });
    res.status(201).json({token, user: buildAuthUserFromClient(client)});
  });

  app.post('/api/auth/client/login', async (req, res) => {
    const rawIdentifier = sanitizeText(req.body?.username || req.body?.whatsapp, 80);
    const username = sanitizeUsername(rawIdentifier);
    const phoneFallback = normalizePhone(rawIdentifier);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if ((!username || username.length < 3) && phoneFallback.length < 10) {
      res.status(400).json({error: 'Ingresa tu nombre de usuario y contraseña.'});
      return;
    }
    if (!password) {
      res.status(400).json({error: 'Ingresa tu contraseña.'});
      return;
    }

    let client: StoredClient | undefined;

    // 1) Prefer fresh Supabase lookup by username (with fallback to phone for legacy accounts)
    if (isSupabaseConfigured()) {
      let sbClient =
        username.length >= 3
          ? await supabaseStore.findClientByUsername(username)
          : null;
      if (!sbClient && phoneFallback.length >= 10) {
        sbClient = await supabaseStore.findClientByWhatsapp(phoneFallback);
      }
      if (sbClient) {
        client = {
          id: sbClient.id,
          name: sbClient.name,
          username: sbClient.username ? sanitizeUsername(sbClient.username) : undefined,
          whatsapp: sbClient.whatsapp,
          whatsappNormalized: sbClient.whatsapp_normalized,
          passwordHash: sbClient.password_hash,
          address: sbClient.address,
          userType: sbClient.user_type || 'general',
          createdAt: sbClient.created_at,
        };
        const existingIdx = db.clients.findIndex(
          (c) =>
            c.id === client!.id ||
            (client!.username && c.username?.toLowerCase() === client!.username) ||
            c.whatsappNormalized === client!.whatsappNormalized,
        );
        if (existingIdx >= 0) db.clients[existingIdx] = client;
        else db.clients.push(client);
        saveDb(db);
      }
    }

    // 2) Fallback to local server-side store
    if (!client && username.length >= 3) {
      client = db.clients.find(
        (c) => c.username?.toLowerCase() === username && c.passwordHash,
      );
    }
    if (!client && phoneFallback.length >= 10) {
      client = db.clients.find(
        (c) => c.whatsappNormalized === phoneFallback && c.passwordHash,
      );
    }

    if (!client) {
      res.status(404).json({
        code: 'NOT_REGISTERED',
        error:
          'Este usuario aún no está registrado. Crea tu cuenta para ingresar.',
      });
      return;
    }

    if (!client.passwordHash || !verifyPassword(password, client.passwordHash)) {
      res.status(401).json({error: 'Contraseña incorrecta. Verifica e intenta de nuevo.'});
      return;
    }

    const token = signToken({
      sub: client.id,
      role: 'client',
      name: client.name,
      username: client.username,
    });
    res.json({token, user: buildAuthUserFromClient(client)});
  });

  // Update authenticated client profile
  app.patch('/api/client/profile', requireAuth, async (req: AuthedRequest, res) => {
    await ensureFreshState();
    const name = sanitizeText(req.body?.name, 80);
    const whatsapp = sanitizeText(req.body?.whatsapp, 25);
    const address = sanitizeText(req.body?.address, 220);

    if (req.auth?.role === 'admin') {
      res.json({
        user: {
          id: req.auth.sub,
          role: 'admin',
          name: name || req.auth.name,
          username: req.auth.username,
          whatsapp,
          address,
        } satisfies AuthUser,
      });
      return;
    }

    const client = db.clients.find((c) => c.id === req.auth?.sub);
    if (!client) {
      res.status(404).json({error: 'Perfil no encontrado.'});
      return;
    }

    if (name.length >= 2) client.name = name;
    if (whatsapp) {
      client.whatsapp = whatsapp;
      client.whatsappNormalized = normalizePhone(whatsapp);
    }
    if (address) client.address = address;

    saveDb(db);
    if (isSupabaseConfigured() && client.passwordHash) {
      await supabaseStore.upsertClient({
        id: client.id,
        name: client.name,
        username: client.username || null,
        whatsapp: client.whatsapp,
        whatsapp_normalized: client.whatsappNormalized,
        password_hash: client.passwordHash,
        address: client.address,
        user_type: client.userType,
        created_at: client.createdAt,
      });
    }

    res.json({user: buildAuthUserFromClient(client)});
  });

  // Client self-service password change
  app.post(
    '/api/client/change-password',
    requireAuth,
    async (req: AuthedRequest, res) => {
      await ensureFreshState();
      const currentPassword = String(req.body?.currentPassword || '');
      const newPassword = String(req.body?.newPassword || '');

      if (newPassword.length < 6 || newPassword.length > 80) {
        res.status(400).json({
          error: 'La nueva contraseña debe tener entre 6 y 80 caracteres.',
        });
        return;
      }

      if (req.auth?.role === 'admin') {
        const admin = db.admins.find((a) => a.id === req.auth?.sub);
        if (!admin || !verifyPassword(currentPassword, admin.passwordHash)) {
          res.status(401).json({error: 'La contraseña actual es incorrecta.'});
          return;
        }
        admin.passwordHash = hashPassword(newPassword);
        saveDb(db);
        if (isSupabaseConfigured()) {
          await supabaseStore.upsertAdmin({
            id: admin.id,
            name: admin.name,
            username: admin.username,
            email: admin.email || null,
            whatsapp: admin.whatsapp || null,
            role: 'admin',
            password_hash: admin.passwordHash,
            active: admin.active !== false,
            created_at: admin.createdAt,
          });
        }
        res.json({ok: true});
        return;
      }

      const client = db.clients.find((c) => c.id === req.auth?.sub);
      if (!client || !client.passwordHash) {
        res.status(404).json({error: 'Cuenta de cliente no encontrada.'});
        return;
      }
      if (!verifyPassword(currentPassword, client.passwordHash)) {
        res.status(401).json({error: 'La contraseña actual es incorrecta.'});
        return;
      }
      client.passwordHash = hashPassword(newPassword);
      saveDb(db);
      if (isSupabaseConfigured()) {
        await supabaseStore.upsertClient({
          id: client.id,
          name: client.name,
          username: client.username || null,
          whatsapp: client.whatsapp,
          whatsapp_normalized: client.whatsappNormalized,
          password_hash: client.passwordHash,
          address: client.address,
          user_type: client.userType,
          created_at: client.createdAt,
        });
      }
      res.json({ok: true});
    },
  );

  // --- ADMIN AUTH (Only pre-registered admins; public admin self-registration is disabled) ---
  app.get('/api/auth/admin/status', async (_req, res) => {
    res.json({
      configured: true,
      usesEnvPasscode: Boolean((process.env.ADMIN_PASSCODE || '').trim()),
      supabaseConnected: isSupabaseConfigured(),
      adminUsernameHint: 'haroldo90',
    });
  });

  app.post('/api/auth/admin/login', async (req, res) => {
    const identifier = sanitizeText(
      req.body?.username || req.body?.email,
      120,
    ).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();

    if (!identifier || !password) {
      res.status(400).json({error: 'Ingresa tu usuario y contraseña de administrador.'});
      return;
    }

    // 1) Verify against Supabase kicksxr_admins if configured
    if (isSupabaseConfigured()) {
      const sbAdmin = await supabaseStore.findAdminByIdentifier(identifier);
      if (sbAdmin && sbAdmin.active && verifyPassword(password, sbAdmin.password_hash)) {
        const token = signToken({
          sub: sbAdmin.id,
          role: 'admin',
          name: sbAdmin.name,
          username: sbAdmin.username,
        });
        res.json({
          token,
          user: {
            id: sbAdmin.id,
            role: 'admin',
            name: sbAdmin.name,
            username: sbAdmin.username,
            email: sbAdmin.email || undefined,
            whatsapp: sbAdmin.whatsapp || undefined,
          } satisfies AuthUser,
        });
        return;
      }
    }

    // 2) Verify against local server-side admins store (pre-registered + admin-created)
    const localAdmin = db.admins.find(
      (a) =>
        a.active !== false &&
        (a.username.toLowerCase() === identifier ||
          (a.email && a.email.toLowerCase() === identifier)),
    );
    if (localAdmin && verifyPassword(password, localAdmin.passwordHash)) {
      const token = signToken({
        sub: localAdmin.id,
        role: 'admin',
        name: localAdmin.name,
        username: localAdmin.username,
      });
      res.json({
        token,
        user: {
          id: localAdmin.id,
          role: 'admin',
          name: localAdmin.name,
          username: localAdmin.username,
          email: localAdmin.email,
          whatsapp: localAdmin.whatsapp,
        } satisfies AuthUser,
      });
      return;
    }

    // 3) Optional server-side ADMIN_PASSCODE override if configured
    if (envPasscode.length > 0 && constantTimeCompare(password, envPasscode)) {
      const matched = db.admins.find(
        (a) => a.username.toLowerCase() === identifier,
      );
      if (matched) {
        const token = signToken({
          sub: matched.id,
          role: 'admin',
          name: matched.name,
          username: matched.username,
        });
        res.json({
          token,
          user: {
            id: matched.id,
            role: 'admin',
            name: matched.name,
            username: matched.username,
            email: matched.email,
          } satisfies AuthUser,
        });
        return;
      }
    }

    res.status(401).json({
      error:
        'Usuario o contraseña incorrectos. Solo administradores registrados pueden acceder.',
    });
  });

  // --- CLIENT ORDERS & NOTIFICATIONS (also accessible by Admin in Client View) ---
  app.get('/api/orders/mine', requireAuth, async (req: AuthedRequest, res) => {
    await ensureFreshState();
    if (req.auth?.role === 'admin') {
      res.json({orders: db.orders, notifications: db.notifications.slice(0, 60)});
      return;
    }
    const client = db.clients.find((c) => c.id === req.auth?.sub);
    const mine = db.orders.filter(
      (o) =>
        o.clientId === req.auth?.sub ||
        (client?.whatsappNormalized &&
          normalizePhone(o.clientWhatsapp) === client.whatsappNormalized),
    );
    const myOrderIds = new Set(mine.map((o) => o.id));
    const notifications = db.notifications.filter(
      (n) => n.orderId && myOrderIds.has(n.orderId),
    );
    res.json({orders: mine, notifications});
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthedRequest, res) => {
    await ensureFreshState();
    const ntf = db.notifications.find((n) => n.id === req.params.id);
    if (!ntf) {
      res.status(404).json({error: 'Notificación no encontrada.'});
      return;
    }
    if (req.auth?.role !== 'admin') {
      const client = db.clients.find((c) => c.id === req.auth?.sub);
      const ownsOrder = db.orders.some(
        (o) =>
          o.id === ntf.orderId &&
          (o.clientId === req.auth?.sub ||
            (client?.whatsappNormalized &&
              normalizePhone(o.clientWhatsapp) === client.whatsappNormalized)),
      );
      if (!ownsOrder) {
        res.status(403).json({error: 'No tienes permiso para actualizar esta notificación.'});
        return;
      }
    }
    ntf.read = true;
    saveDb(db);
    if (isSupabaseConfigured()) {
      await supabaseStore.upsertNotification(ntf);
    }
    res.json({ok: true});
  });

  app.post('/api/notifications/read-all', requireAuth, async (req: AuthedRequest, res) => {
    await ensureFreshState();
    const updated: NotificationLog[] = [];
    if (req.auth?.role === 'admin') {
      db.notifications.forEach((n) => {
        if (!n.read) {
          n.read = true;
          updated.push(n);
        }
      });
    } else {
      const client = db.clients.find((c) => c.id === req.auth?.sub);
      const myOrderIds = new Set(
        db.orders
          .filter(
            (o) =>
              o.clientId === req.auth?.sub ||
              (client?.whatsappNormalized &&
                normalizePhone(o.clientWhatsapp) === client.whatsappNormalized),
          )
          .map((o) => o.id),
      );
      db.notifications.forEach((n) => {
        if (n.orderId && myOrderIds.has(n.orderId) && !n.read) {
          n.read = true;
          updated.push(n);
        }
      });
    }
    saveDb(db);
    if (isSupabaseConfigured() && updated.length > 0) {
      await Promise.all(updated.map((n) => supabaseStore.upsertNotification(n)));
    }
    res.json({ok: true});
  });

  app.post('/api/orders', requireAuth, async (req: AuthedRequest, res) => {
    await ensureFreshState();
    const clientName = sanitizeText(req.body?.clientName, 80);
    const clientWhatsapp = sanitizeText(req.body?.clientWhatsapp, 25);
    const pairs = Number(req.body?.pairs);
    const serviceId = sanitizeText(req.body?.serviceId, 50);
    const campusId = sanitizeText(req.body?.campusId, 50);
    const deliveryMethod = req.body?.deliveryMethod as DeliveryMethod;
    const deliveryAddress = sanitizeText(req.body?.deliveryAddress, 220);
    const paymentMethod = req.body?.paymentMethod as PaymentMethod;
    const cardLast4 = sanitizeText(req.body?.cardLast4, 4);
    const photoDataUrl =
      typeof req.body?.photoDataUrl === 'string' ? req.body.photoDataUrl : undefined;
    const shoeNotes = sanitizeText(req.body?.shoeNotes, 300);
    const rawDiscountCode = sanitizeText(req.body?.discountCode, 30).toUpperCase();

    if (clientName.length < 2) {
      res.status(400).json({error: 'El nombre de contacto es obligatorio.'});
      return;
    }
    if (normalizePhone(clientWhatsapp).length < 10) {
      res.status(400).json({error: 'Ingresa un número de WhatsApp válido (10 dígitos).'});
      return;
    }
    if (!Number.isInteger(pairs) || pairs < 1 || pairs > 10) {
      res.status(400).json({error: 'Selecciona entre 1 y 10 pares.'});
      return;
    }

    const service = db.services.find((s) => s.id === serviceId && s.active);
    if (!service) {
      res.status(400).json({error: 'Selecciona un servicio válido.'});
      return;
    }

    const campus =
      db.campuses.find((c) => c.id === campusId && c.active) ||
      db.campuses.find((c) => c.active);
    if (!campus) {
      res.status(400).json({error: 'No hay sedes activas disponibles.'});
      return;
    }

    if (deliveryMethod !== 'pickup' && deliveryMethod !== 'delivery') {
      res.status(400).json({error: 'Selecciona un método de devolución válido.'});
      return;
    }
    if (deliveryMethod === 'delivery' && deliveryAddress.length < 5) {
      res.status(400).json({error: 'Ingresa la dirección de entrega a domicilio.'});
      return;
    }
    if (paymentMethod !== 'cash' && paymentMethod !== 'card') {
      res.status(400).json({error: 'Selecciona una forma de pago válida.'});
      return;
    }
    if (photoDataUrl) {
      if (photoDataUrl.length > 4_500_000 || !IMAGE_DATA_URL_REGEX.test(photoDataUrl)) {
        res.status(400).json({
          error: 'Formato de fotografía inválido. Usa JPG, PNG o WebP menor a 3MB.',
        });
        return;
      }
    }

    const subtotal = service.price * pairs;
    const {coupon, discountAmount, error: couponError} = calculateCouponDiscount(
      rawDiscountCode,
      subtotal,
    );
    if (rawDiscountCode && couponError) {
      res.status(400).json({error: couponError});
      return;
    }

    const folio = getNextFolio();
    const bagCode = getNextBagCode();
    const shippingFee = deliveryMethod === 'delivery' ? db.shippingFee : 0;
    const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);
    const paymentStatus: PaymentStatus =
      paymentMethod === 'card' ? 'Pagado' : 'Pago pendiente';
    const now = new Date().toISOString();

    if (coupon) {
      coupon.usageCount += 1;
      if (isSupabaseConfigured()) {
        await supabaseStore.upsertCoupon(coupon);
      }
    }

    const client = db.clients.find((c) => c.id === req.auth?.sub);
    if (client) {
      if (clientName) client.name = clientName;
      if (clientWhatsapp) {
        client.whatsapp = clientWhatsapp;
        client.whatsappNormalized = normalizePhone(clientWhatsapp);
      }
      if (deliveryAddress) client.address = deliveryAddress;
    }

    const freeLocker = db.lockers.find(
      (l) => l.campusId === campus.id && l.status === 'disponible',
    );

    const order: Order = {
      id: `ord-${crypto.randomUUID().slice(0, 8)}`,
      folio,
      bagCode,
      orderQrPayload: `KICKSXR|${folio}|${bagCode}|${campus.id}`,
      clientId: req.auth!.sub,
      clientName,
      clientWhatsapp,
      userType: 'general',
      campusId: campus.id,
      campusName: campus.name,
      pairs,
      serviceId: service.id,
      serviceName: service.name,
      unitPrice: service.price,
      shippingFee,
      discountCode: coupon?.code,
      discountAmount: discountAmount || 0,
      totalAmount,
      photoDataUrl,
      shoeNotes: shoeNotes || undefined,
      deliveryMethod,
      deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : undefined,
      assignedLockerCode: freeLocker?.code,
      paymentMethod,
      paymentStatus,
      cardLast4: paymentMethod === 'card' ? cardLast4 || '4242' : undefined,
      status: 'Pendiente de depósito',
      collectionStatus: 'Pendiente',
      bagVerified: false,
      createdAt: now,
      collectionDate: todayDateStr(),
      updatedAt: now,
      history: [
        {
          status: 'Pendiente de depósito',
          timestamp: now,
          note: `Pedido confirmado (${service.name}, ${pairs} ${pairs === 1 ? 'par' : 'pares'}). Bolsa asignada: ${bagCode}${coupon ? `. Cupón ${coupon.code} (-$${discountAmount} MXN)` : ''}`,
        },
      ],
    };

    db.orders.unshift(order);
    saveDb(db);

    const writes: Promise<unknown>[] = [];
    if (isSupabaseConfigured()) {
      writes.push(supabaseStore.upsertOrder(order));
      writes.push(
        supabaseStore.upsertSettings({
          id: 1,
          shipping_fee: db.shippingFee,
          next_order_seq: db.nextOrderSeq,
          next_bag_seq: db.nextBagSeq,
        }),
      );
      if (client && client.passwordHash) {
        writes.push(
          supabaseStore.upsertClient({
            id: client.id,
            name: client.name,
            username: client.username || null,
            whatsapp: client.whatsapp,
            whatsapp_normalized: client.whatsappNormalized,
            password_hash: client.passwordHash,
            address: client.address,
            user_type: client.userType,
            created_at: client.createdAt,
          }),
        );
      }
    }
    writes.push(
      createNotification({
        orderId: order.id,
        folio: order.folio,
        recipientWhatsapp: order.clientWhatsapp,
        recipientName: order.clientName,
        title: `Pedido ${order.folio} confirmado`,
        message: `Hola ${order.clientName}, tu pedido Kicks XR ${order.folio} fue confirmado. Código de bolsa: ${order.bagCode}. Total: $${order.totalAmount} MXN (${order.paymentStatus}).`,
      }),
    );
    await Promise.all(writes);

    broadcastEvent({
      type: 'orders',
      folio: order.folio,
      orderId: order.id,
      status: order.status,
      title: `Nuevo pedido ${order.folio}`,
      message: `Bolsa ${order.bagCode} asignada en ${order.campusName}.`,
    });
    res.status(201).json({order});
  });

  // Client reports physical bag drop-off
  app.post('/api/orders/:id/deposit', requireAuth, async (req: AuthedRequest, res) => {
    await ensureFreshState();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({error: 'Pedido no encontrado.'});
      return;
    }
    if (req.auth?.role !== 'admin' && order.clientId !== req.auth?.sub) {
      res.status(403).json({error: 'No tienes permiso para modificar este pedido.'});
      return;
    }

    const dropoffMethod = req.body?.dropoffMethod as DropoffMethod;
    if (dropoffMethod !== 'staff' && dropoffMethod !== 'locker') {
      res.status(400).json({error: 'Selecciona la modalidad de entrega de tu bolsa.'});
      return;
    }

    let lockerCode = order.assignedLockerCode;
    let updatedLocker: Locker | undefined;
    if (dropoffMethod === 'locker') {
      const targetLocker =
        db.lockers.find((l) => l.code === lockerCode && l.campusId === order.campusId) ||
        db.lockers.find(
          (l) => l.campusId === order.campusId && l.status === 'disponible',
        );
      if (targetLocker) {
        targetLocker.status = 'ocupado';
        targetLocker.currentBagCode = order.bagCode;
        lockerCode = targetLocker.code;
        updatedLocker = targetLocker;
      }
    }

    const now = new Date().toISOString();
    order.dropoffMethod = dropoffMethod;
    order.assignedLockerCode = dropoffMethod === 'locker' ? lockerCode : undefined;
    order.status = 'Depósito reportado';
    order.updatedAt = now;
    order.history.push({
      status: 'Depósito reportado',
      timestamp: now,
      note:
        dropoffMethod === 'locker'
          ? `Depositado en locker autoservicio ${lockerCode || ''} (${order.campusName})`
          : `Entregado directamente con personal en ${order.campusName}`,
    });

    saveDb(db);
    const writes: Promise<unknown>[] = [];
    if (isSupabaseConfigured()) {
      writes.push(supabaseStore.upsertOrder(order));
      if (updatedLocker) {
        writes.push(supabaseStore.upsertLocker(updatedLocker));
      }
    }
    writes.push(
      createNotification({
        orderId: order.id,
        folio: order.folio,
        recipientWhatsapp: order.clientWhatsapp,
        recipientName: order.clientName,
        title: `Depósito reportado · ${order.folio}`,
        message: `Kicks XR: Registramos el depósito de tu bolsa ${order.bagCode} (${order.folio}) en ${order.campusName}. Te avisaremos cuando llegue a taller.`,
      }),
    );
    await Promise.all(writes);

    broadcastEvent({
      type: 'orders',
      folio: order.folio,
      orderId: order.id,
      status: order.status,
      title: `Depósito reportado · ${order.folio}`,
      message: `Bolsa ${order.bagCode} lista para recolección en ${order.campusName}.`,
    });
    res.json({order});
  });

  // --- ADMIN ENDPOINTS ---
  // Client post-delivery rating (1-5 stars)
  app.post('/api/orders/:id/rate', requireAuth, async (req: AuthedRequest, res) => {
    await ensureFreshState();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({error: 'Pedido no encontrado.'});
      return;
    }
    if (req.auth?.role !== 'admin' && order.clientId !== req.auth?.sub) {
      res.status(403).json({error: 'No tienes permiso para calificar este pedido.'});
      return;
    }
    if (order.status !== 'Entregado') {
      res.status(400).json({
        error: 'Solo puedes calificar pedidos que ya hayan sido entregados.',
      });
      return;
    }
    const rating = Number(req.body?.rating);
    const comment = sanitizeText(req.body?.comment, 300);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({error: 'Selecciona una calificación entre 1 y 5 estrellas.'});
      return;
    }
    const now = new Date().toISOString();
    order.rating = rating;
    order.ratingComment = comment || undefined;
    order.ratedAt = now;
    order.updatedAt = now;

    saveDb(db);
    const writes: Promise<unknown>[] = [];
    if (isSupabaseConfigured()) {
      writes.push(supabaseStore.upsertOrder(order));
    }
    writes.push(
      createNotification({
        orderId: order.id,
        folio: order.folio,
        recipientWhatsapp: order.clientWhatsapp,
        recipientName: order.clientName,
        title: `Nueva calificación (${rating}★) · ${order.folio}`,
        message: `${order.clientName} calificó su servicio con ${rating}/5 estrellas.${comment ? ` Comentario: "${comment}"` : ''}`,
      }),
    );
    await Promise.all(writes);
    broadcastEvent({
      type: 'orders',
      folio: order.folio,
      orderId: order.id,
      title: `Calificación recibida · ${order.folio}`,
      message: `${order.clientName} dejó ${rating}★ en su servicio.`,
    });
    res.json({order});
  });

  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    await ensureFreshState();
    const orders = db.orders;
    const activeOrders = orders.filter((o) => o.status !== 'Cancelado');
    const ratedOrders = orders.filter(
      (o) => typeof o.rating === 'number' && o.rating >= 1 && o.rating <= 5,
    );
    const avgRating =
      ratedOrders.length > 0
        ? Math.round(
            (ratedOrders.reduce((acc, o) => acc + (o.rating || 0), 0) /
              ratedOrders.length) *
              10,
          ) / 10
        : 0;
    const metrics = {
      totalOrders: activeOrders.length,
      pendingCollections: activeOrders.filter(
        (o) =>
          o.collectionStatus === 'Pendiente' &&
          (o.status === 'Depósito reportado' || o.status === 'Pendiente de depósito'),
      ).length,
      inCleaning: activeOrders.filter((o) => o.status === 'En limpieza').length,
      readyForDelivery: activeOrders.filter((o) => o.status === 'Listo para entrega')
        .length,
      delivered: activeOrders.filter((o) => o.status === 'Entregado').length,
      cancelled: orders.filter((o) => o.status === 'Cancelado').length,
      openIncidents: db.incidents.filter((i) => i.status !== 'Resuelta').length,
      revenuePaid: activeOrders
        .filter((o) => o.paymentStatus === 'Pagado')
        .reduce((acc, o) => acc + o.totalAmount, 0),
      revenuePending: activeOrders
        .filter((o) => o.paymentStatus === 'Pago pendiente')
        .reduce((acc, o) => acc + o.totalAmount, 0),
      cashPaid: activeOrders
        .filter((o) => o.paymentStatus === 'Pagado' && o.paymentMethod === 'cash')
        .reduce((acc, o) => acc + o.totalAmount, 0),
      cardPaid: activeOrders
        .filter((o) => o.paymentStatus === 'Pagado' && o.paymentMethod === 'card')
        .reduce((acc, o) => acc + o.totalAmount, 0),
      avgRating,
      ratedCount: ratedOrders.length,
    };

    res.json({
      metrics,
      orders,
      incidents: db.incidents,
      notifications: db.notifications.slice(0, 60),
      config: {
        campuses: db.campuses,
        services: db.services,
        lockers: db.lockers,
        coupons: db.coupons,
        shippingFee: db.shippingFee,
        nextOrderSeq: db.nextOrderSeq,
        nextBagSeq: db.nextBagSeq,
        availableLockersByCampus: buildPublicConfig().availableLockersByCampus,
        supabaseConnected: isSupabaseConfigured(),
      },
    });
  });

  // Admin Walk-in / Mostrador Order Creation
  app.post('/api/admin/orders', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const existingClientId = sanitizeText(req.body?.clientId, 60);
    const existingClient = existingClientId
      ? db.clients.find((c) => c.id === existingClientId)
      : undefined;

    const clientName =
      sanitizeText(req.body?.clientName, 80) || existingClient?.name || '';
    const clientWhatsapp =
      sanitizeText(req.body?.clientWhatsapp, 25) || existingClient?.whatsapp || '';
    const pairs = Number(req.body?.pairs);
    const serviceId = sanitizeText(req.body?.serviceId, 50);
    const campusId = sanitizeText(req.body?.campusId, 50);
    const deliveryMethod = (req.body?.deliveryMethod as DeliveryMethod) || 'pickup';
    const deliveryAddress =
      sanitizeText(req.body?.deliveryAddress, 220) || existingClient?.address || '';
    const paymentMethod = (req.body?.paymentMethod as PaymentMethod) || 'cash';
    const markPaid = Boolean(req.body?.markPaid);
    const shoeNotes = sanitizeText(req.body?.shoeNotes, 300);
    const adminNotes = sanitizeText(req.body?.adminNotes, 300);
    const rawDiscountCode = sanitizeText(req.body?.discountCode, 30).toUpperCase();
    const photoDataUrl =
      typeof req.body?.photoDataUrl === 'string' ? req.body.photoDataUrl : undefined;

    if (clientName.length < 2) {
      res.status(400).json({error: 'Ingresa el nombre del cliente.'});
      return;
    }
    if (normalizePhone(clientWhatsapp).length < 10) {
      res.status(400).json({error: 'Ingresa un WhatsApp válido de 10 dígitos.'});
      return;
    }
    if (!Number.isInteger(pairs) || pairs < 1 || pairs > 10) {
      res.status(400).json({error: 'Selecciona entre 1 y 10 pares.'});
      return;
    }
    const service = db.services.find((s) => s.id === serviceId && s.active);
    if (!service) {
      res.status(400).json({error: 'Selecciona un servicio activo.'});
      return;
    }
    const campus =
      db.campuses.find((c) => c.id === campusId && c.active) ||
      db.campuses.find((c) => c.active);
    if (!campus) {
      res.status(400).json({error: 'No hay sedes activas disponibles.'});
      return;
    }
    if (deliveryMethod === 'delivery' && deliveryAddress.length < 5) {
      res.status(400).json({error: 'Ingresa la dirección de entrega a domicilio.'});
      return;
    }
    if (photoDataUrl) {
      if (photoDataUrl.length > 4_500_000 || !IMAGE_DATA_URL_REGEX.test(photoDataUrl)) {
        res.status(400).json({
          error: 'Formato de fotografía inválido. Usa JPG, PNG o WebP menor a 3MB.',
        });
        return;
      }
    }

    const subtotal = service.price * pairs;
    const {coupon, discountAmount, error: couponError} = calculateCouponDiscount(
      rawDiscountCode,
      subtotal,
    );
    if (rawDiscountCode && couponError) {
      res.status(400).json({error: couponError});
      return;
    }

    const folio = getNextFolio();
    const bagCode = getNextBagCode();
    const shippingFee = deliveryMethod === 'delivery' ? db.shippingFee : 0;
    const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);
    const paymentStatus: PaymentStatus =
      markPaid || paymentMethod === 'card' ? 'Pagado' : 'Pago pendiente';
    const now = new Date().toISOString();

    const writes: Promise<unknown>[] = [];
    if (coupon) {
      coupon.usageCount += 1;
      if (isSupabaseConfigured()) {
        writes.push(supabaseStore.upsertCoupon(coupon));
      }
    }

    const order: Order = {
      id: `ord-${crypto.randomUUID().slice(0, 8)}`,
      folio,
      bagCode,
      orderQrPayload: `KICKSXR|${folio}|${bagCode}|${campus.id}`,
      clientId: existingClient?.id || `walkin-${normalizePhone(clientWhatsapp)}`,
      clientName,
      clientWhatsapp,
      userType: 'general',
      campusId: campus.id,
      campusName: campus.name,
      pairs,
      serviceId: service.id,
      serviceName: service.name,
      unitPrice: service.price,
      shippingFee,
      discountCode: coupon?.code,
      discountAmount: discountAmount || 0,
      totalAmount,
      photoDataUrl,
      shoeNotes: shoeNotes || undefined,
      adminNotes: adminNotes || undefined,
      deliveryMethod,
      deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : undefined,
      dropoffMethod: 'staff',
      paymentMethod,
      paymentStatus,
      status: 'Recibido por KicksXR',
      collectionStatus: 'Recolectado',
      bagVerified: true,
      createdAt: now,
      collectionDate: todayDateStr(),
      updatedAt: now,
      history: [
        {
          status: 'Recibido por KicksXR',
          timestamp: now,
          note: `Pedido registrado en mostrador (${campus.name}).${coupon ? ` Cupón ${coupon.code} (-$${discountAmount} MXN).` : ''}`,
        },
      ],
    };

    db.orders.unshift(order);
    saveDb(db);

    if (isSupabaseConfigured()) {
      writes.push(supabaseStore.upsertOrder(order));
      writes.push(
        supabaseStore.upsertSettings({
          id: 1,
          shipping_fee: db.shippingFee,
          next_order_seq: db.nextOrderSeq,
          next_bag_seq: db.nextBagSeq,
        }),
      );
    }

    const whatsappUrl = buildOrderWhatsappUrl(
      order,
      `¡Hola ${order.clientName}! Registramos tu servicio en Kicks XR.\n• Folio: ${order.folio}\n• Bolsa: ${order.bagCode}\n• Servicio: ${order.serviceName} (${order.pairs} ${order.pairs === 1 ? 'par' : 'pares'})\n• Total: $${order.totalAmount} MXN (${order.paymentStatus})\n• Sede: ${order.campusName}`,
    );

    writes.push(
      createNotification({
        orderId: order.id,
        folio: order.folio,
        recipientWhatsapp: order.clientWhatsapp,
        recipientName: order.clientName,
        title: `Pedido en mostrador · ${order.folio}`,
        message: `${order.clientName} registró ${order.pairs} par(es) en ${order.campusName} (${order.serviceName}).`,
      }),
    );

    await Promise.all(writes);
    broadcastEvent({
      type: 'orders',
      folio: order.folio,
      orderId: order.id,
      status: order.status,
      title: `Nuevo pedido en mostrador · ${order.folio}`,
      message: `${order.clientName} · ${order.serviceName} (${order.bagCode}).`,
    });

    res.status(201).json({order, whatsappUrl});
  });

  app.post('/api/admin/collections/confirm', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const bagCodes = Array.isArray(req.body?.bagCodes)
      ? (req.body.bagCodes as unknown[]).map((c) => sanitizeText(c, 20).toUpperCase())
      : [];

    if (bagCodes.length === 0) {
      res.status(400).json({
        error: 'Selecciona al menos una bolsa verificada para confirmar recepción.',
      });
      return;
    }

    const updatedOrders: Order[] = [];
    const writes: Promise<unknown>[] = [];
    const now = new Date().toISOString();

    for (const code of bagCodes) {
      const order = db.orders.find((o) => o.bagCode.toUpperCase() === code);
      if (!order) continue;

      order.bagVerified = true;
      order.collectionStatus = 'Recolectado';
      if (
        order.status === 'Pendiente de depósito' ||
        order.status === 'Depósito reportado'
      ) {
        order.status = 'Recibido por KicksXR';
        order.history.push({
          status: 'Recibido por KicksXR',
          timestamp: now,
          note: `Bolsa ${order.bagCode} auditada y recibida en taller KicksXR.`,
        });
      }
      order.updatedAt = now;

      const locker = db.lockers.find((l) => l.currentBagCode === order.bagCode);
      if (locker) {
        locker.status = 'disponible';
        locker.currentBagCode = undefined;
        if (isSupabaseConfigured()) {
          writes.push(supabaseStore.upsertLocker(locker));
        }
      }

      updatedOrders.push(order);
      if (isSupabaseConfigured()) {
        writes.push(supabaseStore.upsertOrder(order));
      }

      writes.push(
        createNotification({
          orderId: order.id,
          folio: order.folio,
          recipientWhatsapp: order.clientWhatsapp,
          recipientName: order.clientName,
          title: `Recibido por KicksXR · ${order.folio}`,
          message: `¡Hola ${order.clientName}! Recibimos tu bolsa ${order.bagCode} (${order.folio}) en el taller de Kicks XR. Pronto comenzaremos tu ${order.serviceName}.`,
        }),
      );
    }

    saveDb(db);
    await Promise.all(writes);
    broadcastEvent({
      type: 'orders',
      title: 'Recepción confirmada en taller',
      message: `${updatedOrders.length} bolsa(s) actualizadas a "Recibido por KicksXR".`,
    });
    broadcastEvent({type: 'config'});
    res.json({updatedCount: updatedOrders.length, orders: updatedOrders});
  });

  app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({error: 'Pedido no encontrado.'});
      return;
    }

    const nextStatus = req.body?.status as OrderStatus | undefined;
    const nextPaymentStatus = req.body?.paymentStatus as PaymentStatus | undefined;
    const nextBagCode = sanitizeText(req.body?.bagCode, 20).toUpperCase();
    const note = sanitizeText(req.body?.note, 250);
    const adminNotes =
      typeof req.body?.adminNotes === 'string'
        ? sanitizeText(req.body.adminNotes, 300)
        : undefined;
    const afterPhotoDataUrl =
      typeof req.body?.afterPhotoDataUrl === 'string'
        ? req.body.afterPhotoDataUrl
        : undefined;
    const clearAfterPhoto = req.body?.afterPhotoDataUrl === null;
    const now = new Date().toISOString();

    if (afterPhotoDataUrl) {
      if (
        afterPhotoDataUrl.length > 4_500_000 ||
        !IMAGE_DATA_URL_REGEX.test(afterPhotoDataUrl)
      ) {
        res.status(400).json({
          error: 'Formato de fotografía inválido. Usa JPG, PNG o WebP menor a 3MB.',
        });
        return;
      }
    }

    if (nextBagCode && nextBagCode !== order.bagCode) {
      const duplicate = db.orders.find(
        (o) => o.id !== order.id && o.bagCode.toUpperCase() === nextBagCode,
      );
      if (duplicate) {
        res.status(409).json({
          error: `El código de bolsa ${nextBagCode} ya está asignado al folio ${duplicate.folio}.`,
        });
        return;
      }
      order.bagCode = nextBagCode;
      order.orderQrPayload = `KICKSXR|${order.folio}|${order.bagCode}|${order.campusId}`;
    }

    const writes: Promise<unknown>[] = [];
    let afterPhotoAdded = false;

    if (afterPhotoDataUrl && afterPhotoDataUrl !== order.afterPhotoDataUrl) {
      order.afterPhotoDataUrl = afterPhotoDataUrl;
      afterPhotoAdded = true;
    } else if (clearAfterPhoto) {
      order.afterPhotoDataUrl = undefined;
    }

    if (adminNotes !== undefined) {
      order.adminNotes = adminNotes || undefined;
    }

    if (nextStatus) {
      if (!VALID_STATUSES.includes(nextStatus)) {
        res.status(400).json({error: 'Estado de pedido no válido.'});
        return;
      }
      if (order.status !== nextStatus) {
        order.status = nextStatus;
        if (
          nextStatus === 'Recibido por KicksXR' ||
          nextStatus === 'En limpieza' ||
          nextStatus === 'Listo para entrega' ||
          nextStatus === 'Entregado'
        ) {
          order.collectionStatus = 'Recolectado';
          order.bagVerified = true;
        }
        if (nextStatus === 'Cancelado' || nextStatus === 'Entregado') {
          releaseOrderLocker(order, writes);
        }
        order.history.push({
          status: nextStatus,
          timestamp: now,
          note: note || `Estado actualizado a ${nextStatus}`,
        });

        writes.push(
          createNotification({
            orderId: order.id,
            folio: order.folio,
            recipientWhatsapp: order.clientWhatsapp,
            recipientName: order.clientName,
            title: `${nextStatus} · ${order.folio}`,
            message: `Kicks XR actualiza tu pedido ${order.folio} (Bolsa ${order.bagCode}): ahora está en estatus "${nextStatus}".${note ? ` Nota: ${note}` : ''}`,
          }),
        );
      } else if (note) {
        order.history.push({
          status: order.status,
          timestamp: now,
          note,
        });
      }
    }

    if (afterPhotoAdded && (!nextStatus || nextStatus === order.status)) {
      writes.push(
        createNotification({
          orderId: order.id,
          folio: order.folio,
          recipientWhatsapp: order.clientWhatsapp,
          recipientName: order.clientName,
          title: `Foto del resultado lista · ${order.folio}`,
          message: `¡Tus tenis quedaron listos! Ya puedes ver la fotografía del resultado final en tu pedido ${order.folio}.`,
        }),
      );
    }

    if (nextPaymentStatus) {
      if (nextPaymentStatus !== 'Pagado' && nextPaymentStatus !== 'Pago pendiente') {
        res.status(400).json({error: 'Estado de pago no válido.'});
        return;
      }
      order.paymentStatus = nextPaymentStatus;
    }

    order.updatedAt = now;
    saveDb(db);
    if (isSupabaseConfigured()) {
      writes.push(supabaseStore.upsertOrder(order));
    }
    await Promise.all(writes);
    broadcastEvent({
      type: 'orders',
      folio: order.folio,
      orderId: order.id,
      status: order.status,
      title: `Estatus actualizado · ${order.folio}`,
      message: `El pedido ${order.folio} ahora está en "${order.status}" (${order.paymentStatus}).`,
    });
    const whatsappUrl = buildOrderWhatsappUrl(
      order,
      `¡Hola ${order.clientName}! Kicks XR te informa que tu pedido ${order.folio} (Bolsa ${order.bagCode} · ${order.serviceName}) pasó a estatus "${order.status}".${note ? ` Nota: ${note}.` : ''} Estado de pago: ${order.paymentStatus} ($${order.totalAmount} MXN).`,
    );
    res.json({order, whatsappUrl});
  });

  // Cancel order and release locker
  app.post('/api/admin/orders/:id/cancel', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({error: 'Pedido no encontrado.'});
      return;
    }
    const reason =
      sanitizeText(req.body?.reason, 220) || 'Cancelado por el administrador.';
    const now = new Date().toISOString();
    const writes: Promise<unknown>[] = [];

    order.status = 'Cancelado';
    order.collectionStatus = 'Pendiente';
    order.updatedAt = now;
    order.history.push({
      status: 'Cancelado',
      timestamp: now,
      note: reason,
    });
    releaseOrderLocker(order, writes);

    saveDb(db);
    if (isSupabaseConfigured()) {
      writes.push(supabaseStore.upsertOrder(order));
    }
    writes.push(
      createNotification({
        orderId: order.id,
        folio: order.folio,
        recipientWhatsapp: order.clientWhatsapp,
        recipientName: order.clientName,
        title: `Pedido cancelado · ${order.folio}`,
        message: `Tu pedido ${order.folio} (Bolsa ${order.bagCode}) fue cancelado. Motivo: ${reason}`,
      }),
    );
    await Promise.all(writes);
    broadcastEvent({
      type: 'orders',
      folio: order.folio,
      orderId: order.id,
      status: 'Cancelado',
      title: `Pedido cancelado · ${order.folio}`,
      message: `El pedido ${order.folio} fue cancelado y su locker liberado.`,
    });
    broadcastEvent({type: 'config'});
    const whatsappUrl = buildOrderWhatsappUrl(
      order,
      `Hola ${order.clientName}, te informamos que tu pedido ${order.folio} en Kicks XR fue cancelado. Motivo: ${reason}`,
    );
    res.json({order, whatsappUrl});
  });

  app.post('/api/admin/orders/deliver', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const folio = sanitizeText(req.body?.folio, 32).toUpperCase();
    const deliveryMethod = req.body?.deliveryMethod as DeliveryMethod;
    const markPaid = Boolean(req.body?.markPaid);
    const afterPhotoDataUrl =
      typeof req.body?.afterPhotoDataUrl === 'string'
        ? req.body.afterPhotoDataUrl
        : undefined;

    if (!folio) {
      res.status(400).json({error: 'Ingresa o escanea el folio de confirmación.'});
      return;
    }
    if (afterPhotoDataUrl) {
      if (
        afterPhotoDataUrl.length > 4_500_000 ||
        !IMAGE_DATA_URL_REGEX.test(afterPhotoDataUrl)
      ) {
        res.status(400).json({
          error: 'Formato de fotografía inválido. Usa JPG, PNG o WebP menor a 3MB.',
        });
        return;
      }
    }

    const order = db.orders.find(
      (o) => o.folio.toUpperCase() === folio || o.bagCode.toUpperCase() === folio,
    );
    if (!order) {
      res.status(404).json({
        error: `No se encontró ningún pedido con el folio ${folio}.`,
      });
      return;
    }

    const now = new Date().toISOString();
    if (deliveryMethod === 'pickup' || deliveryMethod === 'delivery') {
      order.deliveryMethod = deliveryMethod;
    }
    if (markPaid) {
      order.paymentStatus = 'Pagado';
    }
    if (afterPhotoDataUrl) {
      order.afterPhotoDataUrl = afterPhotoDataUrl;
    }
    order.status = 'Entregado';
    order.collectionStatus = 'Recolectado';
    order.bagVerified = true;
    order.updatedAt = now;
    order.history.push({
      status: 'Entregado',
      timestamp: now,
      note:
        order.deliveryMethod === 'delivery'
          ? 'Entrega a domicilio confirmada y cerrada.'
          : `Recogida en punto (${order.campusName}) confirmada y cerrada.`,
    });

    const writes: Promise<unknown>[] = [];
    releaseOrderLocker(order, writes);

    saveDb(db);
    if (isSupabaseConfigured()) {
      writes.push(supabaseStore.upsertOrder(order));
    }
    writes.push(
      createNotification({
        orderId: order.id,
        folio: order.folio,
        recipientWhatsapp: order.clientWhatsapp,
        recipientName: order.clientName,
        title: `Pedido entregado · ${order.folio}`,
        message: `¡Gracias por confiar en Kicks XR, ${order.clientName}! Tu pedido ${order.folio} fue marcado como Entregado. ¡Disfruta tus tenis como nuevos y califica tu servicio en la app!`,
      }),
    );
    await Promise.all(writes);

    broadcastEvent({
      type: 'orders',
      folio: order.folio,
      orderId: order.id,
      status: order.status,
      title: `Entrega confirmada · ${order.folio}`,
      message: `El folio ${order.folio} fue entregado y cerrado exitosamente.`,
    });
    const whatsappUrl = buildOrderWhatsappUrl(
      order,
      `¡Gracias por confiar en Kicks XR, ${order.clientName}! Confirmamos la entrega de tu pedido ${order.folio}. ¡Disfruta tus tenis como nuevos!`,
    );
    res.json({order, whatsappUrl});
  });

  app.post('/api/admin/incidents', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const type = req.body?.type as IncidentType;
    const bagCode = sanitizeText(req.body?.bagCode, 25).toUpperCase();
    const folio = sanitizeText(req.body?.folio, 32).toUpperCase();
    const campusId = sanitizeText(req.body?.campusId, 50);
    const description = sanitizeText(req.body?.description, 400);

    if (!VALID_INCIDENT_TYPES.includes(type)) {
      res.status(400).json({error: 'Tipo de incidencia inválido.'});
      return;
    }
    if (!bagCode) {
      res.status(400).json({error: 'Ingresa el código de bolsa involucrado.'});
      return;
    }

    const linkedOrder = db.orders.find(
      (o) =>
        (folio && o.folio.toUpperCase() === folio) ||
        o.bagCode.toUpperCase() === bagCode,
    );
    const campus =
      db.campuses.find((c) => c.id === (campusId || linkedOrder?.campusId)) ||
      db.campuses[0];

    const now = new Date().toISOString();
    const incident: Incident = {
      id: `inc-${crypto.randomUUID().slice(0, 8)}`,
      type,
      bagCode,
      folio: folio || linkedOrder?.folio,
      campusId: campus.id,
      campusName: campus.name,
      description:
        description || `Incidencia operativa (${type}) reportada en ${campus.name}.`,
      status: 'Abierta',
      createdAt: now,
      updatedAt: now,
    };

    db.incidents.unshift(incident);
    saveDb(db);
    const writes: Promise<unknown>[] = [];
    if (isSupabaseConfigured()) {
      writes.push(supabaseStore.upsertIncident(incident));
    }

    if (linkedOrder) {
      writes.push(
        createNotification({
          orderId: linkedOrder.id,
          folio: linkedOrder.folio,
          recipientWhatsapp: linkedOrder.clientWhatsapp,
          recipientName: linkedOrder.clientName,
          title: `Aviso operativo · ${linkedOrder.folio}`,
          message: `Hola ${linkedOrder.clientName}, nuestro equipo Kicks XR registró una revisión (${type}) en tu bolsa ${bagCode} (${linkedOrder.folio}). Estamos atendiéndolo de inmediato.`,
        }),
      );
    }
    await Promise.all(writes);

    broadcastEvent({
      type: 'incidents',
      folio: incident.folio,
      title: `Incidencia: ${type}`,
      message: `Bolsa ${bagCode} reportada en ${campus.name}.`,
    });
    res.status(201).json({incident});
  });

  app.patch('/api/admin/incidents/:id', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const incident = db.incidents.find((i) => i.id === req.params.id);
    if (!incident) {
      res.status(404).json({error: 'Incidencia no encontrada.'});
      return;
    }

    const status = req.body?.status as IncidentStatus | undefined;
    const resolutionNote = sanitizeText(req.body?.resolutionNote, 400);

    if (status) {
      if (!VALID_INCIDENT_STATUSES.includes(status)) {
        res.status(400).json({error: 'Estado de incidencia no válido.'});
        return;
      }
      incident.status = status;
    }
    if (resolutionNote) {
      incident.resolutionNote = resolutionNote;
    }
    incident.updatedAt = new Date().toISOString();
    saveDb(db);
    if (isSupabaseConfigured()) {
      await supabaseStore.upsertIncident(incident);
    }

    broadcastEvent({
      type: 'incidents',
      folio: incident.folio,
      title: `Incidencia ${incident.status}`,
      message: `Bolsa ${incident.bagCode} actualizada a ${incident.status}.`,
    });
    res.json({incident});
  });

  app.post('/api/admin/config/campuses', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const name = sanitizeText(req.body?.name, 80);
    const address = sanitizeText(req.body?.address, 200);
    const type = req.body?.type === 'university' ? 'university' : 'point';

    if (name.length < 2) {
      res.status(400).json({error: 'Ingresa el nombre de la sede o punto.'});
      return;
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 28);
    const id = `punto-${slug}-${Date.now().toString().slice(-3)}`;
    const code = `KXR-${slug.toUpperCase().slice(0, 14)}`;

    const campus: Campus = {
      id,
      name,
      code,
      address: address || 'Dirección por definir',
      type,
      active: true,
    };
    db.campuses.push(campus);
    saveDb(db);
    if (isSupabaseConfigured()) {
      await supabaseStore.upsertCampus(campus);
    }
    broadcastEvent({type: 'config'});
    res.status(201).json({campus});
  });

  app.patch('/api/admin/config/campuses/:id', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const campus = db.campuses.find((c) => c.id === req.params.id);
    if (!campus) {
      res.status(404).json({error: 'Sede no encontrada.'});
      return;
    }
    if (typeof req.body?.active === 'boolean') campus.active = req.body.active;
    const name = sanitizeText(req.body?.name, 80);
    const address = sanitizeText(req.body?.address, 200);
    const type = req.body?.type;
    if (name) campus.name = name;
    if (address) campus.address = address;
    if (type === 'university' || type === 'point') campus.type = type;
    saveDb(db);
    if (isSupabaseConfigured()) {
      await supabaseStore.upsertCampus(campus);
    }
    broadcastEvent({type: 'config'});
    res.json({campus});
  });

  app.post('/api/admin/config/services', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const name = sanitizeText(req.body?.name, 80);
    const description = sanitizeText(req.body?.description, 220);
    const price = Number(req.body?.price);
    const turnaroundHours = Number(req.body?.turnaroundHours) || 24;

    if (name.length < 2 || !Number.isFinite(price) || price <= 0) {
      res.status(400).json({error: 'Ingresa un nombre de servicio y precio válido.'});
      return;
    }

    const service: ServiceItem = {
      id: `svc-${crypto.randomUUID().slice(0, 6)}`,
      name,
      description,
      price: Math.round(price),
      turnaroundHours: Math.max(1, Math.round(turnaroundHours)),
      active: true,
    };
    db.services.push(service);
    saveDb(db);
    if (isSupabaseConfigured()) {
      await supabaseStore.upsertService(service);
    }
    broadcastEvent({type: 'config'});
    res.status(201).json({service});
  });

  app.patch('/api/admin/config/services/:id', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const service = db.services.find((s) => s.id === req.params.id);
    if (!service) {
      res.status(404).json({error: 'Servicio no encontrado.'});
      return;
    }
    const price = Number(req.body?.price);
    if (Number.isFinite(price) && price > 0) service.price = Math.round(price);
    const turnaroundHours = Number(req.body?.turnaroundHours);
    if (Number.isFinite(turnaroundHours) && turnaroundHours >= 1) {
      service.turnaroundHours = Math.round(turnaroundHours);
    }
    if (typeof req.body?.active === 'boolean') service.active = req.body.active;
    const name = sanitizeText(req.body?.name, 80);
    if (name) service.name = name;
    if (typeof req.body?.description === 'string') {
      service.description = sanitizeText(req.body.description, 220);
    }
    saveDb(db);
    if (isSupabaseConfigured()) {
      await supabaseStore.upsertService(service);
    }
    broadcastEvent({type: 'config'});
    res.json({service});
  });

  app.post('/api/admin/config/lockers', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const code = sanitizeText(req.body?.code, 20).toUpperCase();
    const campusId = sanitizeText(req.body?.campusId, 60);
    if (!code || !db.campuses.some((c) => c.id === campusId)) {
      res.status(400).json({error: 'Ingresa un código de locker y sede válidos.'});
      return;
    }
    if (db.lockers.some((l) => l.code === code && l.campusId === campusId)) {
      res.status(409).json({error: 'Ese código de locker ya existe en esta sede.'});
      return;
    }
    const locker: Locker = {
      id: `lk-${crypto.randomUUID().slice(0, 6)}`,
      code,
      campusId,
      status: 'disponible',
    };
    db.lockers.push(locker);
    saveDb(db);
    if (isSupabaseConfigured()) {
      await supabaseStore.upsertLocker(locker);
    }
    broadcastEvent({type: 'config'});
    res.status(201).json({locker});
  });

  app.patch('/api/admin/config/lockers/:id', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const locker = db.lockers.find((l) => l.id === req.params.id);
    if (!locker) {
      res.status(404).json({error: 'Locker no encontrado.'});
      return;
    }
    const status = req.body?.status;
    if (status === 'disponible' || status === 'ocupado' || status === 'mantenimiento') {
      locker.status = status;
      if (status !== 'ocupado') locker.currentBagCode = undefined;
    }
    saveDb(db);
    if (isSupabaseConfigured()) {
      await supabaseStore.upsertLocker(locker);
    }
    broadcastEvent({type: 'config'});
    res.json({locker});
  });

  app.patch('/api/admin/config/settings', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const shippingFee = Number(req.body?.shippingFee);
    if (Number.isFinite(shippingFee) && shippingFee >= 0) {
      db.shippingFee = Math.round(shippingFee);
    }
    saveDb(db);
    if (isSupabaseConfigured()) {
      await supabaseStore.upsertSettings({
        id: 1,
        shipping_fee: db.shippingFee,
        next_order_seq: db.nextOrderSeq,
        next_bag_seq: db.nextBagSeq,
      });
    }
    broadcastEvent({type: 'config'});
    res.json({shippingFee: db.shippingFee});
  });

  // --- ADMIN COUPONS CRUD ---
  app.post('/api/admin/config/coupons', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const code = sanitizeText(req.body?.code, 30)
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    const description = sanitizeText(req.body?.description, 160);
    const discountType = req.body?.discountType === 'fixed' ? 'fixed' : 'percent';
    const value = Number(req.body?.value);

    if (code.length < 3) {
      res.status(400).json({error: 'El código debe tener al menos 3 caracteres.'});
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      res.status(400).json({error: 'Ingresa un valor de descuento mayor a 0.'});
      return;
    }
    if (discountType === 'percent' && value > 90) {
      res.status(400).json({error: 'El descuento porcentual máximo es 90%.'});
      return;
    }
    if (db.coupons.some((c) => c.code.toUpperCase() === code)) {
      res.status(409).json({error: `El cupón ${code} ya existe.`});
      return;
    }

    const coupon: Coupon = {
      id: `cpn-${crypto.randomUUID().slice(0, 6)}`,
      code,
      description:
        description ||
        (discountType === 'percent'
          ? `${Math.round(value)}% de descuento`
          : `$${Math.round(value)} MXN de descuento`),
      discountType,
      value: Math.round(value),
      active: true,
      usageCount: 0,
      createdAt: new Date().toISOString(),
    };

    db.coupons.unshift(coupon);
    saveDb(db);
    if (isSupabaseConfigured()) {
      await supabaseStore.upsertCoupon(coupon);
    }
    broadcastEvent({type: 'config'});
    res.status(201).json({coupon});
  });

  app.patch('/api/admin/config/coupons/:id', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const coupon = db.coupons.find((c) => c.id === req.params.id);
    if (!coupon) {
      res.status(404).json({error: 'Cupón no encontrado.'});
      return;
    }
    if (typeof req.body?.active === 'boolean') coupon.active = req.body.active;
    const description = sanitizeText(req.body?.description, 160);
    if (description) coupon.description = description;
    const value = Number(req.body?.value);
    if (Number.isFinite(value) && value > 0) {
      coupon.value =
        coupon.discountType === 'percent'
          ? Math.min(90, Math.round(value))
          : Math.round(value);
    }
    saveDb(db);
    if (isSupabaseConfigured()) {
      await supabaseStore.upsertCoupon(coupon);
    }
    broadcastEvent({type: 'config'});
    res.json({coupon});
  });

  app.delete('/api/admin/config/coupons/:id', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const idx = db.coupons.findIndex((c) => c.id === req.params.id);
    if (idx < 0) {
      res.status(404).json({error: 'Cupón no encontrado.'});
      return;
    }
    const [removed] = db.coupons.splice(idx, 1);
    saveDb(db);
    if (isSupabaseConfigured()) {
      await supabaseStore.deleteCoupon(removed.id);
    }
    broadcastEvent({type: 'config'});
    res.json({ok: true});
  });

  // --- ADMIN USER MANAGEMENT (Register Admins & Clients + Share Credentials via WhatsApp) ---
  app.get('/api/admin/users', requireAdmin, async (_req, res) => {
    if (isSupabaseConfigured()) {
      const [sbAdmins, sbClients] = await Promise.all([
        supabaseStore.listAdmins(),
        supabaseStore.listClients(),
      ]);
      if (sbAdmins && sbAdmins.length > 0) {
        for (const row of sbAdmins) {
          const idx = db.admins.findIndex(
            (a) =>
              a.id === row.id ||
              a.username.toLowerCase() === row.username.toLowerCase(),
          );
          const mapped: StoredAdmin = {
            id: row.id,
            username: row.username,
            email: row.email || undefined,
            whatsapp: row.whatsapp || undefined,
            name: row.name,
            passwordHash: row.password_hash,
            active: row.active,
            createdAt: row.created_at,
          };
          if (idx >= 0) db.admins[idx] = mapped;
          else db.admins.push(mapped);
        }
      }
      if (sbClients && sbClients.length > 0) {
        for (const row of sbClients) {
          const rowUsername = row.username ? sanitizeUsername(row.username) : undefined;
          const idx = db.clients.findIndex(
            (c) =>
              c.id === row.id ||
              (rowUsername && c.username?.toLowerCase() === rowUsername) ||
              c.whatsappNormalized === row.whatsapp_normalized,
          );
          const mapped: StoredClient = {
            id: row.id,
            name: row.name,
            username: rowUsername || (idx >= 0 ? db.clients[idx].username : undefined),
            whatsapp: row.whatsapp,
            whatsappNormalized: row.whatsapp_normalized,
            passwordHash: row.password_hash,
            address: row.address,
            userType: row.user_type || 'general',
            createdAt: row.created_at,
          };
          if (idx >= 0) db.clients[idx] = mapped;
          else db.clients.push(mapped);
        }
      }
      saveDb(db);
    }

    res.json({
      admins: db.admins.map((a) => ({
        id: a.id,
        name: a.name,
        username: a.username,
        email: a.email,
        whatsapp: a.whatsapp,
        role: 'admin' as const,
        active: a.active !== false,
        createdAt: a.createdAt,
      })),
      clients: db.clients.map((c) => ({
        id: c.id,
        name: c.name,
        username: c.username,
        whatsapp: c.whatsapp,
        address: c.address,
        userType: c.userType,
        createdAt: c.createdAt,
      })),
      supabaseConnected: isSupabaseConfigured(),
    });
  });

  app.post('/api/admin/users/admin', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const name = sanitizeText(req.body?.name, 80);
    const username = sanitizeText(req.body?.username, 50)
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '');
    const email = sanitizeText(req.body?.email, 120).toLowerCase();
    const whatsapp = sanitizeText(req.body?.whatsapp, 25);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2) {
      res.status(400).json({error: 'Ingresa el nombre completo del administrador.'});
      return;
    }
    if (username.length < 3) {
      res.status(400).json({
        error: 'Ingresa un nombre de usuario válido (mínimo 3 caracteres, sin espacios).',
      });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({error: 'La contraseña debe tener al menos 6 caracteres.'});
      return;
    }

    const existsLocal = db.admins.some(
      (a) => a.username.toLowerCase() === username,
    );
    const existsSb = isSupabaseConfigured()
      ? await supabaseStore.findAdminByIdentifier(username)
      : null;

    if (existsLocal || existsSb) {
      res.status(409).json({
        error: `El usuario "${username}" ya está registrado como administrador.`,
      });
      return;
    }

    const now = new Date().toISOString();
    const newAdmin: StoredAdmin = {
      id: `adm-${crypto.randomUUID().slice(0, 8)}`,
      name,
      username,
      email: email || `${username}@kicksxr.com`,
      whatsapp: whatsapp || undefined,
      passwordHash: hashPassword(password),
      active: true,
      createdAt: now,
    };

    db.admins.unshift(newAdmin);
    saveDb(db);

    const supabaseSynced = isSupabaseConfigured()
      ? await supabaseStore.upsertAdmin({
          id: newAdmin.id,
          name: newAdmin.name,
          username: newAdmin.username,
          email: newAdmin.email,
          whatsapp: newAdmin.whatsapp || null,
          role: 'admin',
          password_hash: newAdmin.passwordHash,
          active: true,
          created_at: newAdmin.createdAt,
        })
      : false;

    const credentials = buildCredentialsPayload({
      req,
      role: 'admin',
      name: newAdmin.name,
      identifier: newAdmin.username,
      password,
      whatsapp: newAdmin.whatsapp,
    });

    res.status(201).json({
      admin: {
        id: newAdmin.id,
        name: newAdmin.name,
        username: newAdmin.username,
        email: newAdmin.email,
        whatsapp: newAdmin.whatsapp,
        role: 'admin' as const,
        active: true,
        createdAt: newAdmin.createdAt,
      },
      credentials,
      supabaseSynced,
    });
  });

  app.patch('/api/admin/users/admin/:id', requireAdmin, async (req: AuthedRequest, res) => {
    await ensureFreshState();
    const admin = db.admins.find((a) => a.id === req.params.id);
    if (!admin) {
      res.status(404).json({error: 'Administrador no encontrado.'});
      return;
    }

    if (typeof req.body?.active === 'boolean') {
      if (req.auth?.sub === admin.id && !req.body.active) {
        res.status(400).json({
          error: 'No puedes desactivar tu propia cuenta mientras tienes sesión activa.',
        });
        return;
      }
      admin.active = req.body.active;
    }

    const whatsapp = sanitizeText(req.body?.whatsapp, 25);
    if (whatsapp) admin.whatsapp = whatsapp;

    const newPassword =
      typeof req.body?.password === 'string' ? req.body.password : '';
    let credentials = undefined;
    if (newPassword) {
      if (newPassword.length < 6) {
        res.status(400).json({error: 'La nueva contraseña debe tener al menos 6 caracteres.'});
        return;
      }
      admin.passwordHash = hashPassword(newPassword);
      credentials = buildCredentialsPayload({
        req,
        role: 'admin',
        name: admin.name,
        identifier: admin.username,
        password: newPassword,
        whatsapp: admin.whatsapp,
      });
    }

    saveDb(db);
    const supabaseSynced = isSupabaseConfigured()
      ? await supabaseStore.upsertAdmin({
          id: admin.id,
          name: admin.name,
          username: admin.username,
          email: admin.email || `${admin.username}@kicksxr.com`,
          whatsapp: admin.whatsapp || null,
          role: 'admin',
          password_hash: admin.passwordHash,
          active: admin.active !== false,
          created_at: admin.createdAt,
        })
      : false;

    res.json({
      admin: {
        id: admin.id,
        name: admin.name,
        username: admin.username,
        email: admin.email,
        whatsapp: admin.whatsapp,
        role: 'admin' as const,
        active: admin.active !== false,
        createdAt: admin.createdAt,
      },
      credentials,
      supabaseSynced,
    });
  });

  app.post('/api/admin/users/client', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const name = sanitizeText(req.body?.name, 80);
    const username = sanitizeUsername(req.body?.username);
    const whatsapp = sanitizeText(req.body?.whatsapp, 25);
    const whatsappNormalized = normalizePhone(whatsapp);
    const address = sanitizeText(req.body?.address, 220);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2) {
      res.status(400).json({error: 'Ingresa el nombre completo del cliente.'});
      return;
    }
    if (username.length < 3) {
      res.status(400).json({
        error: 'Ingresa un nombre de usuario válido (mínimo 3 caracteres, sin espacios).',
      });
      return;
    }
    if (whatsappNormalized.length < 10) {
      res.status(400).json({error: 'Ingresa un número de WhatsApp válido (10 dígitos).'});
      return;
    }
    if (address.length < 5) {
      res.status(400).json({error: 'Ingresa la dirección de entrega del cliente.'});
      return;
    }
    if (password.length < 6) {
      res.status(400).json({error: 'La contraseña debe tener al menos 6 caracteres.'});
      return;
    }

    const existsUserLocal = db.clients.some(
      (c) => c.username && c.username.toLowerCase() === username,
    );
    const existsUserSb = isSupabaseConfigured()
      ? await supabaseStore.findClientByUsername(username)
      : null;

    if (existsUserLocal || existsUserSb) {
      res.status(409).json({
        error: `El usuario "${username}" ya está registrado para otro cliente.`,
      });
      return;
    }

    const existsLocal = db.clients.some(
      (c) => c.whatsappNormalized === whatsappNormalized && c.passwordHash,
    );
    const existsSb = isSupabaseConfigured()
      ? await supabaseStore.findClientByWhatsapp(whatsappNormalized)
      : null;

    if (existsLocal || existsSb) {
      res.status(409).json({
        error: 'Ya existe un cliente registrado con ese número de WhatsApp.',
      });
      return;
    }

    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);
    const newClient: StoredClient = {
      id: `cli-${crypto.randomUUID().slice(0, 10)}`,
      name,
      username,
      whatsapp,
      whatsappNormalized,
      passwordHash,
      address,
      userType: 'general',
      createdAt: now,
    };

    db.clients.unshift(newClient);
    saveDb(db);

    const supabaseSynced = isSupabaseConfigured()
      ? await supabaseStore.upsertClient({
          id: newClient.id,
          name: newClient.name,
          username: newClient.username,
          whatsapp: newClient.whatsapp,
          whatsapp_normalized: newClient.whatsappNormalized,
          password_hash: passwordHash,
          address: newClient.address,
          user_type: 'general',
          created_at: newClient.createdAt,
        })
      : false;

    const credentials = buildCredentialsPayload({
      req,
      role: 'client',
      name: newClient.name,
      identifier: newClient.username || newClient.whatsapp,
      password,
      whatsapp: newClient.whatsapp,
    });

    res.status(201).json({
      client: {
        id: newClient.id,
        name: newClient.name,
        username: newClient.username,
        whatsapp: newClient.whatsapp,
        address: newClient.address,
        userType: newClient.userType,
        createdAt: newClient.createdAt,
      },
      credentials,
      supabaseSynced,
    });
  });

  app.patch('/api/admin/users/client/:id', requireAdmin, async (req, res) => {
    await ensureFreshState();
    const client = db.clients.find((c) => c.id === req.params.id);
    if (!client) {
      res.status(404).json({error: 'Cliente no encontrado.'});
      return;
    }

    const name = sanitizeText(req.body?.name, 80);
    const address = sanitizeText(req.body?.address, 220);
    if (name.length >= 2) client.name = name;
    if (address.length >= 5) client.address = address;

    const newPassword =
      typeof req.body?.password === 'string' ? req.body.password : '';
    let credentials = undefined;
    if (newPassword) {
      if (newPassword.length < 6) {
        res.status(400).json({error: 'La nueva contraseña debe tener al menos 6 caracteres.'});
        return;
      }
      client.passwordHash = hashPassword(newPassword);
      credentials = buildCredentialsPayload({
        req,
        role: 'client',
        name: client.name,
        identifier: client.username || client.whatsapp,
        password: newPassword,
        whatsapp: client.whatsapp,
      });
    }

    saveDb(db);
    const supabaseSynced =
      isSupabaseConfigured() && client.passwordHash
        ? await supabaseStore.upsertClient({
            id: client.id,
            name: client.name,
            username: client.username || null,
            whatsapp: client.whatsapp,
            whatsapp_normalized: client.whatsappNormalized,
            password_hash: client.passwordHash,
            address: client.address,
            user_type: client.userType,
            created_at: client.createdAt,
          })
        : false;

    res.json({
      client: {
        id: client.id,
        name: client.name,
        username: client.username,
        whatsapp: client.whatsapp,
        address: client.address,
        userType: client.userType,
        createdAt: client.createdAt,
      },
      credentials,
      supabaseSynced,
    });
  });

  app.get('/api/admin/supabase/health', requireAdmin, async (_req, res) => {
    const health = await supabaseStore.checkHealth();
    res.json(health);
  });

  return app;
}

let cachedApp: Express | null = null;
let initPromise: Promise<Express> | null = null;

export async function getApiApp(): Promise<Express> {
  if (cachedApp) return cachedApp;
  if (!initPromise) {
    initPromise = (async () => {
      const app = createApiApp();
      await ensureFreshState(true);
      cachedApp = app;
      return app;
    })();
  }
  return initPromise;
}
