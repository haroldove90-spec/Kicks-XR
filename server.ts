import crypto from 'crypto';
import dotenv from 'dotenv';
import express, {NextFunction, Request, Response} from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import {isSupabaseConfigured, supabaseStore} from './src/server/supabase.ts';
import type {
  AuthUser,
  Campus,
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
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_PATH = path.resolve(DATA_DIR, 'kicksxr-db.json');

if (!DB_PATH.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid database path');
}

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const IMAGE_DATA_URL_REGEX =
  /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

interface StoredAdmin {
  id: string;
  username: string;
  email?: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

interface StoredClient {
  id: string;
  name: string;
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
  shippingFee: number;
  nextOrderSeq: number;
  nextBagSeq: number;
  orders: Order[];
  incidents: Incident[];
  notifications: NotificationLog[];
}

function normalizePhone(raw: string): string {
  return String(raw || '').replace(/\D/g, '').slice(0, 15);
}

function sanitizeText(raw: unknown, maxLen = 200): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLen);
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
    admins: [],
    clients: [],
    campuses,
    services,
    lockers,
    shippingFee: 75,
    nextOrderSeq: 1044,
    nextBagSeq: 30,
    orders,
    incidents,
    notifications,
  };
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
        if (parsed.admin && parsed.admins.length === 0) {
          parsed.admins.push({
            id: 'adm-migrated',
            username: parsed.admin.email?.split('@')[0] || 'admin',
            email: parsed.admin.email,
            name: parsed.admin.name,
            passwordHash: parsed.admin.passwordHash,
            createdAt: parsed.admin.createdAt,
          });
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

function saveDb(state: DatabaseState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }
  const tmpPath = path.resolve(DATA_DIR, `kicksxr-db.${process.pid}.tmp`);
  if (!tmpPath.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temp database path');
  }
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

const db: DatabaseState = loadDb();

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

function createNotification(params: {
  orderId?: string;
  folio?: string;
  recipientWhatsapp?: string;
  recipientName?: string;
  title: string;
  message: string;
}): NotificationLog {
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
  void supabaseStore.upsertNotification(entry);
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
];

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

async function startServer() {
  const app = express();
  app.use(express.json({limit: '6mb'}));

  // Real-time SSE endpoint (non-PII notifications & state invalidations)
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
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
  app.get('/api/public/config', (_req, res) => {
    res.json(buildPublicConfig());
  });

  // Sanitized order tracking by folio or bag code
  app.get('/api/orders/track/:folio', (req, res) => {
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
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      history: order.history,
    });
  });

  // --- CLIENT AUTH ---
  app.post('/api/auth/client/register', async (req, res) => {
    const name = sanitizeText(req.body?.name, 80);
    const whatsapp = sanitizeText(req.body?.whatsapp, 25);
    const whatsappNormalized = normalizePhone(whatsapp);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const address = sanitizeText(req.body?.address, 220);

    if (name.length < 2) {
      res.status(400).json({error: 'Ingresa tu nombre completo.'});
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
        whatsapp: client.whatsapp,
        whatsapp_normalized: client.whatsappNormalized,
        password_hash: passwordHash,
        address: client.address,
        user_type: 'general',
        created_at: client.createdAt,
      });
    }

    const token = signToken({sub: client.id, role: 'client', name: client.name});
    res.status(201).json({token, user: buildAuthUserFromClient(client)});
  });

  app.post('/api/auth/client/login', async (req, res) => {
    const whatsappNormalized = normalizePhone(req.body?.whatsapp || '');
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (whatsappNormalized.length < 10 || !password) {
      res.status(400).json({error: 'Ingresa tu WhatsApp y contraseña.'});
      return;
    }

    let client = db.clients.find(
      (c) => c.whatsappNormalized === whatsappNormalized && c.passwordHash,
    );

    if (!client && isSupabaseConfigured()) {
      const sbClient = await supabaseStore.findClientByWhatsapp(whatsappNormalized);
      if (sbClient) {
        client = {
          id: sbClient.id,
          name: sbClient.name,
          whatsapp: sbClient.whatsapp,
          whatsappNormalized: sbClient.whatsapp_normalized,
          passwordHash: sbClient.password_hash,
          address: sbClient.address,
          userType: sbClient.user_type || 'general',
          createdAt: sbClient.created_at,
        };
        db.clients.push(client);
        saveDb(db);
      }
    }

    if (!client || !client.passwordHash || !verifyPassword(password, client.passwordHash)) {
      res.status(401).json({error: 'WhatsApp o contraseña incorrectos.'});
      return;
    }

    const token = signToken({sub: client.id, role: 'client', name: client.name});
    res.json({token, user: buildAuthUserFromClient(client)});
  });

  // Update authenticated client profile
  app.patch('/api/client/profile', requireAuth, async (req: AuthedRequest, res) => {
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

  // --- ADMIN AUTH (Supabase kicksxr_admins + local fallback + env override) ---
  app.get('/api/auth/admin/status', async (_req, res) => {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const usesEnvPasscode = envPasscode.length > 0;
    const sbConnected = isSupabaseConfigured();
    let hasSbAdmins = false;
    let firstUsername = db.admins[0]?.username || 'haroldo90';

    if (sbConnected) {
      const rows = await supabaseStore.listAdmins();
      if (rows && rows.length > 0) {
        hasSbAdmins = true;
        firstUsername = rows[0].username;
      }
    }

    const configured = usesEnvPasscode || hasSbAdmins || db.admins.length > 0;
    res.json({
      configured,
      usesEnvPasscode,
      supabaseConnected: sbConnected,
      adminUsernameHint: firstUsername,
    });
  });

  app.post('/api/auth/admin/setup', async (req, res) => {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const sbAdmins = isSupabaseConfigured()
      ? await supabaseStore.listAdmins()
      : null;

    if (envPasscode.length > 0 || db.admins.length > 0 || (sbAdmins && sbAdmins.length > 0)) {
      res.status(409).json({
        error: 'El acceso de administrador ya está configurado. Inicia sesión con tu usuario y contraseña.',
      });
      return;
    }

    const username = sanitizeText(req.body?.username, 60).toLowerCase();
    const email = sanitizeText(req.body?.email, 120).toLowerCase();
    const name = sanitizeText(req.body?.name, 80) || 'Harold Anguiano';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (username.length < 3) {
      res.status(400).json({error: 'Ingresa un nombre de usuario (ej. haroldo90).'});
      return;
    }
    if (password.length < 6) {
      res.status(400).json({error: 'La contraseña debe tener al menos 6 caracteres.'});
      return;
    }

    const newAdmin: StoredAdmin = {
      id: `adm-${crypto.randomUUID().slice(0, 8)}`,
      username,
      email: email || `${username}@kicksxr.com`,
      name,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    db.admins.push(newAdmin);
    saveDb(db);

    if (isSupabaseConfigured()) {
      await supabaseStore.upsertAdmin({
        id: newAdmin.id,
        name: newAdmin.name,
        username: newAdmin.username,
        email: newAdmin.email,
        role: 'admin',
        password_hash: newAdmin.passwordHash,
        active: true,
        created_at: newAdmin.createdAt,
      });
    }

    const token = signToken({
      sub: newAdmin.id,
      role: 'admin',
      name: newAdmin.name,
      username: newAdmin.username,
    });
    res.status(201).json({
      token,
      user: {
        id: newAdmin.id,
        role: 'admin',
        name: newAdmin.name,
        username: newAdmin.username,
        email: newAdmin.email,
      } satisfies AuthUser,
    });
  });

  app.post('/api/auth/admin/login', async (req, res) => {
    const identifier = sanitizeText(
      req.body?.username || req.body?.email,
      120,
    ).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();

    if (!password) {
      res.status(400).json({error: 'Ingresa tu contraseña de administrador.'});
      return;
    }

    // 1) Server-side ADMIN_PASSCODE override if configured in Secrets
    if (envPasscode.length > 0 && constantTimeCompare(password, envPasscode)) {
      const adminUsername = identifier || db.admins[0]?.username || 'haroldo90';
      const adminName =
        adminUsername === 'haroldo90'
          ? 'Harold Anguiano'
          : db.admins.find((a) => a.username === adminUsername)?.name ||
            'Administrador KicksXR';
      const token = signToken({
        sub: `adm-${adminUsername}`,
        role: 'admin',
        name: adminName,
        username: adminUsername,
      });
      res.json({
        token,
        user: {
          id: `adm-${adminUsername}`,
          role: 'admin',
          name: adminName,
          username: adminUsername,
          email: `${adminUsername}@kicksxr.com`,
        } satisfies AuthUser,
      });
      return;
    }

    // 2) Verify against Supabase kicksxr_admins if configured
    if (isSupabaseConfigured() && identifier) {
      const sbAdmin = await supabaseStore.findAdminByIdentifier(identifier);
      if (sbAdmin && verifyPassword(password, sbAdmin.password_hash)) {
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
          } satisfies AuthUser,
        });
        return;
      }
    }

    // 3) Verify against local server-side admins store
    const localAdmin = db.admins.find(
      (a) =>
        !identifier ||
        a.username.toLowerCase() === identifier ||
        (a.email && a.email.toLowerCase() === identifier),
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
        } satisfies AuthUser,
      });
      return;
    }

    if (db.admins.length === 0 && !isSupabaseConfigured() && envPasscode.length === 0) {
      res.status(400).json({
        error: 'Primero configura tu usuario y contraseña de administrador.',
      });
      return;
    }

    res.status(401).json({error: 'Usuario o contraseña incorrectos.'});
  });

  // --- CLIENT ORDERS & NOTIFICATIONS (also accessible by Admin in Client View) ---
  app.get('/api/orders/mine', requireAuth, (req: AuthedRequest, res) => {
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

  app.patch('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
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
    void supabaseStore.upsertNotification(ntf);
    res.json({ok: true});
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
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
    updated.forEach((n) => {
      void supabaseStore.upsertNotification(n);
    });
    res.json({ok: true});
  });

  app.post('/api/orders', requireAuth, (req: AuthedRequest, res) => {
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

    const folio = getNextFolio();
    const bagCode = getNextBagCode();
    const shippingFee = deliveryMethod === 'delivery' ? db.shippingFee : 0;
    const totalAmount = service.price * pairs + shippingFee;
    const paymentStatus: PaymentStatus =
      paymentMethod === 'card' ? 'Pagado' : 'Pago pendiente';
    const now = new Date().toISOString();

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
      totalAmount,
      photoDataUrl,
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
          note: `Pedido confirmado (${service.name}, ${pairs} ${pairs === 1 ? 'par' : 'pares'}). Bolsa asignada: ${bagCode}`,
        },
      ],
    };

    db.orders.unshift(order);
    saveDb(db);
    void supabaseStore.upsertOrder(order);

    createNotification({
      orderId: order.id,
      folio: order.folio,
      recipientWhatsapp: order.clientWhatsapp,
      recipientName: order.clientName,
      title: `Pedido ${order.folio} confirmado`,
      message: `Hola ${order.clientName}, tu pedido Kicks XR ${order.folio} fue confirmado. Código de bolsa: ${order.bagCode}. Total: $${order.totalAmount} MXN (${order.paymentStatus}).`,
    });

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
  app.post('/api/orders/:id/deposit', requireAuth, (req: AuthedRequest, res) => {
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
        void supabaseStore.upsertLocker(targetLocker);
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
    void supabaseStore.upsertOrder(order);

    createNotification({
      orderId: order.id,
      folio: order.folio,
      recipientWhatsapp: order.clientWhatsapp,
      recipientName: order.clientName,
      title: `Depósito reportado · ${order.folio}`,
      message: `Kicks XR: Registramos el depósito de tu bolsa ${order.bagCode} (${order.folio}) en ${order.campusName}. Te avisaremos cuando llegue a taller.`,
    });

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
  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const orders = db.orders;
    const metrics = {
      totalOrders: orders.length,
      pendingCollections: orders.filter(
        (o) =>
          o.collectionStatus === 'Pendiente' &&
          (o.status === 'Depósito reportado' || o.status === 'Pendiente de depósito'),
      ).length,
      inCleaning: orders.filter((o) => o.status === 'En limpieza').length,
      readyForDelivery: orders.filter((o) => o.status === 'Listo para entrega').length,
      delivered: orders.filter((o) => o.status === 'Entregado').length,
      openIncidents: db.incidents.filter((i) => i.status !== 'Resuelta').length,
      revenuePaid: orders
        .filter((o) => o.paymentStatus === 'Pagado')
        .reduce((acc, o) => acc + o.totalAmount, 0),
      revenuePending: orders
        .filter((o) => o.paymentStatus === 'Pago pendiente')
        .reduce((acc, o) => acc + o.totalAmount, 0),
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
        shippingFee: db.shippingFee,
        nextOrderSeq: db.nextOrderSeq,
        nextBagSeq: db.nextBagSeq,
        availableLockersByCampus: buildPublicConfig().availableLockersByCampus,
        supabaseConnected: isSupabaseConfigured(),
      },
    });
  });

  app.post('/api/admin/collections/confirm', requireAdmin, (req, res) => {
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
        void supabaseStore.upsertLocker(locker);
      }

      updatedOrders.push(order);
      void supabaseStore.upsertOrder(order);

      createNotification({
        orderId: order.id,
        folio: order.folio,
        recipientWhatsapp: order.clientWhatsapp,
        recipientName: order.clientName,
        title: `Recibido por KicksXR · ${order.folio}`,
        message: `¡Hola ${order.clientName}! Recibimos tu bolsa ${order.bagCode} (${order.folio}) en el taller de Kicks XR. Pronto comenzaremos tu ${order.serviceName}.`,
      });
    }

    saveDb(db);
    broadcastEvent({
      type: 'orders',
      title: 'Recepción confirmada en taller',
      message: `${updatedOrders.length} bolsa(s) actualizadas a "Recibido por KicksXR".`,
    });
    broadcastEvent({type: 'config'});
    res.json({updatedCount: updatedOrders.length, orders: updatedOrders});
  });

  app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({error: 'Pedido no encontrado.'});
      return;
    }

    const nextStatus = req.body?.status as OrderStatus | undefined;
    const nextPaymentStatus = req.body?.paymentStatus as PaymentStatus | undefined;
    const nextBagCode = sanitizeText(req.body?.bagCode, 20).toUpperCase();
    const note = sanitizeText(req.body?.note, 200);
    const now = new Date().toISOString();

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
        order.history.push({
          status: nextStatus,
          timestamp: now,
          note: note || `Estado actualizado a ${nextStatus}`,
        });

        createNotification({
          orderId: order.id,
          folio: order.folio,
          recipientWhatsapp: order.clientWhatsapp,
          recipientName: order.clientName,
          title: `${nextStatus} · ${order.folio}`,
          message: `Kicks XR actualiza tu pedido ${order.folio} (Bolsa ${order.bagCode}): ahora está en estatus "${nextStatus}".`,
        });
      }
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
    void supabaseStore.upsertOrder(order);
    broadcastEvent({
      type: 'orders',
      folio: order.folio,
      orderId: order.id,
      status: order.status,
      title: `Estatus actualizado · ${order.folio}`,
      message: `El pedido ${order.folio} ahora está en "${order.status}" (${order.paymentStatus}).`,
    });
    res.json({order});
  });

  app.post('/api/admin/orders/deliver', requireAdmin, (req, res) => {
    const folio = sanitizeText(req.body?.folio, 32).toUpperCase();
    const deliveryMethod = req.body?.deliveryMethod as DeliveryMethod;
    const markPaid = Boolean(req.body?.markPaid);

    if (!folio) {
      res.status(400).json({error: 'Ingresa o escanea el folio de confirmación.'});
      return;
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

    const locker = db.lockers.find((l) => l.currentBagCode === order.bagCode);
    if (locker) {
      locker.status = 'disponible';
      locker.currentBagCode = undefined;
      void supabaseStore.upsertLocker(locker);
    }

    saveDb(db);
    void supabaseStore.upsertOrder(order);

    createNotification({
      orderId: order.id,
      folio: order.folio,
      recipientWhatsapp: order.clientWhatsapp,
      recipientName: order.clientName,
      title: `Pedido entregado · ${order.folio}`,
      message: `¡Gracias por confiar en Kicks XR, ${order.clientName}! Tu pedido ${order.folio} fue marcado como Entregado. ¡Disfruta tus tenis como nuevos!`,
    });

    broadcastEvent({
      type: 'orders',
      folio: order.folio,
      orderId: order.id,
      status: order.status,
      title: `Entrega confirmada · ${order.folio}`,
      message: `El folio ${order.folio} fue entregado y cerrado exitosamente.`,
    });
    res.json({order});
  });

  app.post('/api/admin/incidents', requireAdmin, (req, res) => {
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
    void supabaseStore.upsertIncident(incident);

    if (linkedOrder) {
      createNotification({
        orderId: linkedOrder.id,
        folio: linkedOrder.folio,
        recipientWhatsapp: linkedOrder.clientWhatsapp,
        recipientName: linkedOrder.clientName,
        title: `Aviso operativo · ${linkedOrder.folio}`,
        message: `Hola ${linkedOrder.clientName}, nuestro equipo Kicks XR registró una revisión (${type}) en tu bolsa ${bagCode} (${linkedOrder.folio}). Estamos atendiéndolo de inmediato.`,
      });
    }

    broadcastEvent({
      type: 'incidents',
      folio: incident.folio,
      title: `Incidencia: ${type}`,
      message: `Bolsa ${bagCode} reportada en ${campus.name}.`,
    });
    res.status(201).json({incident});
  });

  app.patch('/api/admin/incidents/:id', requireAdmin, (req, res) => {
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
    void supabaseStore.upsertIncident(incident);

    broadcastEvent({
      type: 'incidents',
      folio: incident.folio,
      title: `Incidencia ${incident.status}`,
      message: `Bolsa ${incident.bagCode} actualizada a ${incident.status}.`,
    });
    res.json({incident});
  });

  app.post('/api/admin/config/campuses', requireAdmin, (req, res) => {
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
    void supabaseStore.upsertCampus(campus);
    broadcastEvent({type: 'config'});
    res.status(201).json({campus});
  });

  app.patch('/api/admin/config/campuses/:id', requireAdmin, (req, res) => {
    const campus = db.campuses.find((c) => c.id === req.params.id);
    if (!campus) {
      res.status(404).json({error: 'Sede no encontrada.'});
      return;
    }
    if (typeof req.body?.active === 'boolean') campus.active = req.body.active;
    const name = sanitizeText(req.body?.name, 80);
    const address = sanitizeText(req.body?.address, 200);
    if (name) campus.name = name;
    if (address) campus.address = address;
    saveDb(db);
    void supabaseStore.upsertCampus(campus);
    broadcastEvent({type: 'config'});
    res.json({campus});
  });

  app.post('/api/admin/config/services', requireAdmin, (req, res) => {
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
    void supabaseStore.upsertService(service);
    broadcastEvent({type: 'config'});
    res.status(201).json({service});
  });

  app.patch('/api/admin/config/services/:id', requireAdmin, (req, res) => {
    const service = db.services.find((s) => s.id === req.params.id);
    if (!service) {
      res.status(404).json({error: 'Servicio no encontrado.'});
      return;
    }
    const price = Number(req.body?.price);
    if (Number.isFinite(price) && price > 0) service.price = Math.round(price);
    if (typeof req.body?.active === 'boolean') service.active = req.body.active;
    const name = sanitizeText(req.body?.name, 80);
    if (name) service.name = name;
    saveDb(db);
    void supabaseStore.upsertService(service);
    broadcastEvent({type: 'config'});
    res.json({service});
  });

  app.post('/api/admin/config/lockers', requireAdmin, (req, res) => {
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
    void supabaseStore.upsertLocker(locker);
    broadcastEvent({type: 'config'});
    res.status(201).json({locker});
  });

  app.patch('/api/admin/config/lockers/:id', requireAdmin, (req, res) => {
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
    void supabaseStore.upsertLocker(locker);
    broadcastEvent({type: 'config'});
    res.json({locker});
  });

  app.patch('/api/admin/config/settings', requireAdmin, (req, res) => {
    const shippingFee = Number(req.body?.shippingFee);
    if (Number.isFinite(shippingFee) && shippingFee >= 0) {
      db.shippingFee = Math.round(shippingFee);
    }
    saveDb(db);
    broadcastEvent({type: 'config'});
    res.json({shippingFee: db.shippingFee});
  });

  const httpServer = http.createServer(app);

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    // Prevent Vite 8's default /@vite/client from opening a failing WebSocket to port 24678
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript; charset=utf-8').send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) {
  return url;
}
export class ErrorOverlay extends HTMLElement {}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Kicks XR server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Kicks XR server:', err);
  process.exit(1);
});
