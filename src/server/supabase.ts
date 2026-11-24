import type {
  Campus,
  Incident,
  Locker,
  NotificationLog,
  Order,
  ServiceItem,
} from '../types.ts';

export interface SupabaseAdminRow {
  id: string;
  name: string;
  username: string;
  email?: string | null;
  whatsapp?: string | null;
  role: string;
  password_hash: string;
  active: boolean;
  created_at: string;
}

export interface SupabaseClientRow {
  id: string;
  name: string;
  whatsapp: string;
  whatsapp_normalized: string;
  password_hash: string;
  address: string;
  user_type: 'general' | 'university';
  created_at: string;
}

export interface SupabaseSettingsRow {
  id: number;
  shipping_fee: number;
  next_order_seq: number;
  next_bag_seq: number;
}

interface SbResult<T> {
  ok: boolean;
  data: T | null;
  status: number;
  error?: string;
}

function getSupabaseRestBase(): string | null {
  const rawUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim();
  if (!rawUrl) return null;
  const cleaned = rawUrl.replace(/\/+$/, '');
  if (cleaned.endsWith('/rest/v1')) return cleaned;
  return `${cleaned}/rest/v1`;
}

function getSupabaseApiKey(): string | null {
  const key = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();
  return key || null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseRestBase() && getSupabaseApiKey());
}

async function sbRequest<T>(
  tablePath: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    prefer?: string;
  } = {},
): Promise<SbResult<T>> {
  const base = getSupabaseRestBase();
  const apiKey = getSupabaseApiKey();
  if (!base || !apiKey) {
    return {ok: false, data: null, status: 0, error: 'Supabase no configurado'};
  }

  const headers: Record<string, string> = {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  try {
    const res = await fetch(`${base}/${tablePath}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(8000),
    });

    const text = await res.text();
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(text);
        if (parsed?.message) msg = parsed.message;
      } catch {
        if (text) msg = text.slice(0, 180);
      }
      return {ok: false, data: null, status: res.status, error: msg};
    }

    if (!text) {
      return {ok: true, data: null, status: res.status};
    }
    return {ok: true, data: JSON.parse(text) as T, status: res.status};
  } catch (err) {
    return {
      ok: false,
      data: null,
      status: 0,
      error: err instanceof Error ? err.message : 'Error de red con Supabase',
    };
  }
}

export const supabaseStore = {
  isConfigured: isSupabaseConfigured,

  async checkHealth(): Promise<{
    configured: boolean;
    connected: boolean;
    tables: Record<string, boolean>;
    error?: string;
  }> {
    const tableNames = [
      'kicksxr_admins',
      'kicksxr_clients',
      'kicksxr_campuses',
      'kicksxr_services',
      'kicksxr_lockers',
      'kicksxr_orders',
      'kicksxr_incidents',
      'kicksxr_notifications',
      'kicksxr_settings',
    ];
    const tables: Record<string, boolean> = {};
    if (!isSupabaseConfigured()) {
      tableNames.forEach((t) => {
        tables[t] = false;
      });
      return {
        configured: false,
        connected: false,
        tables,
        error: 'Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no detectadas.',
      };
    }

    let firstError: string | undefined;
    let allOk = true;
    await Promise.all(
      tableNames.map(async (table) => {
        const r = await sbRequest<unknown[]>(`${table}?select=*&limit=1`);
        tables[table] = r.ok;
        if (!r.ok) {
          allOk = false;
          if (!firstError) firstError = `${table}: ${r.error}`;
        }
      }),
    );

    return {
      configured: true,
      connected: allOk,
      tables,
      error: firstError,
    };
  },

  async findAdminByIdentifier(identifier: string): Promise<SupabaseAdminRow | null> {
    const clean = encodeURIComponent(identifier.trim().toLowerCase());
    const res = await sbRequest<SupabaseAdminRow[]>(
      `kicksxr_admins?or=(username.ilike.${clean},email.ilike.${clean})&active=eq.true&limit=1`,
    );
    return res.ok && res.data && res.data.length > 0 ? res.data[0] : null;
  },

  async listAdmins(): Promise<SupabaseAdminRow[] | null> {
    const res = await sbRequest<SupabaseAdminRow[]>(
      'kicksxr_admins?select=*&order=created_at.desc',
    );
    return res.ok ? res.data || [] : null;
  },

  async upsertAdmin(admin: SupabaseAdminRow): Promise<boolean> {
    const res = await sbRequest('kicksxr_admins?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: admin,
    });
    if (!res.ok && res.error?.includes('whatsapp')) {
      // Fallback if table was created before whatsapp column was added
      const {whatsapp: _omit, ...legacyAdmin} = admin;
      const retry = await sbRequest('kicksxr_admins?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: legacyAdmin,
      });
      return retry.ok;
    }
    return res.ok;
  },

  async listClients(): Promise<SupabaseClientRow[] | null> {
    const res = await sbRequest<SupabaseClientRow[]>(
      'kicksxr_clients?select=*&order=created_at.desc',
    );
    return res.ok ? res.data || [] : null;
  },

  async findClientByWhatsapp(whatsappNormalized: string): Promise<SupabaseClientRow | null> {
    const clean = encodeURIComponent(whatsappNormalized);
    const res = await sbRequest<SupabaseClientRow[]>(
      `kicksxr_clients?whatsapp_normalized=eq.${clean}&limit=1`,
    );
    return res.ok && res.data && res.data.length > 0 ? res.data[0] : null;
  },

  async upsertClient(client: SupabaseClientRow): Promise<boolean> {
    const res = await sbRequest('kicksxr_clients?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: client,
    });
    return res.ok;
  },

  async listCampuses(): Promise<Campus[] | null> {
    const res = await sbRequest<Campus[]>('kicksxr_campuses?select=*');
    return res.ok ? res.data || [] : null;
  },

  async upsertCampus(campus: Campus): Promise<boolean> {
    const res = await sbRequest('kicksxr_campuses?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: campus,
    });
    return res.ok;
  },

  async listServices(): Promise<ServiceItem[] | null> {
    const res = await sbRequest<
      Array<{
        id: string;
        name: string;
        description: string;
        price: number;
        turnaround_hours: number;
        active: boolean;
      }>
    >('kicksxr_services?select=*');
    if (!res.ok || !res.data) return null;
    return res.data.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      price: Number(s.price),
      turnaroundHours: Number(s.turnaround_hours || 24),
      active: Boolean(s.active),
    }));
  },

  async upsertService(service: ServiceItem): Promise<boolean> {
    const res = await sbRequest('kicksxr_services?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: {
        id: service.id,
        name: service.name,
        description: service.description,
        price: service.price,
        turnaround_hours: service.turnaroundHours,
        active: service.active,
      },
    });
    return res.ok;
  },

  async listLockers(): Promise<Locker[] | null> {
    const res = await sbRequest<
      Array<{
        id: string;
        code: string;
        campus_id: string;
        status: 'disponible' | 'ocupado' | 'mantenimiento';
        current_bag_code?: string | null;
      }>
    >('kicksxr_lockers?select=*');
    if (!res.ok || !res.data) return null;
    return res.data.map((l) => ({
      id: l.id,
      code: l.code,
      campusId: l.campus_id,
      status: l.status,
      currentBagCode: l.current_bag_code || undefined,
    }));
  },

  async upsertLocker(locker: Locker): Promise<boolean> {
    const res = await sbRequest('kicksxr_lockers?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: {
        id: locker.id,
        code: locker.code,
        campus_id: locker.campusId,
        status: locker.status,
        current_bag_code: locker.currentBagCode || null,
      },
    });
    return res.ok;
  },

  async listOrders(): Promise<Order[] | null> {
    const res = await sbRequest<Array<Record<string, unknown>>>(
      'kicksxr_orders?select=*&order=created_at.desc',
    );
    if (!res.ok || !res.data) return null;
    return res.data.map((row) => ({
      id: String(row.id),
      folio: String(row.folio),
      bagCode: String(row.bag_code),
      orderQrPayload: String(row.order_qr_payload),
      clientId: String(row.client_id),
      clientName: String(row.client_name),
      clientWhatsapp: String(row.client_whatsapp),
      userType: (row.user_type as 'general' | 'university') || 'general',
      campusId: String(row.campus_id),
      campusName: String(row.campus_name),
      pairs: Number(row.pairs || 1),
      serviceId: String(row.service_id),
      serviceName: String(row.service_name),
      unitPrice: Number(row.unit_price || 0),
      shippingFee: Number(row.shipping_fee || 0),
      totalAmount: Number(row.total_amount || 0),
      photoDataUrl: row.photo_data_url ? String(row.photo_data_url) : undefined,
      deliveryMethod: row.delivery_method as Order['deliveryMethod'],
      deliveryAddress: row.delivery_address ? String(row.delivery_address) : undefined,
      dropoffMethod: (row.dropoff_method as Order['dropoffMethod']) || undefined,
      assignedLockerCode: row.assigned_locker_code
        ? String(row.assigned_locker_code)
        : undefined,
      paymentMethod: row.payment_method as Order['paymentMethod'],
      paymentStatus: row.payment_status as Order['paymentStatus'],
      cardLast4: row.card_last4 ? String(row.card_last4) : undefined,
      status: row.status as Order['status'],
      collectionStatus: row.collection_status as Order['collectionStatus'],
      bagVerified: Boolean(row.bag_verified),
      collectionDate: String(row.collection_date || ''),
      history: Array.isArray(row.history) ? (row.history as Order['history']) : [],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  async upsertOrder(order: Order): Promise<boolean> {
    const res = await sbRequest('kicksxr_orders?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: {
        id: order.id,
        folio: order.folio,
        bag_code: order.bagCode,
        order_qr_payload: order.orderQrPayload,
        client_id: order.clientId,
        client_name: order.clientName,
        client_whatsapp: order.clientWhatsapp,
        user_type: order.userType,
        campus_id: order.campusId,
        campus_name: order.campusName,
        pairs: order.pairs,
        service_id: order.serviceId,
        service_name: order.serviceName,
        unit_price: order.unitPrice,
        shipping_fee: order.shippingFee,
        total_amount: order.totalAmount,
        photo_data_url: order.photoDataUrl || null,
        delivery_method: order.deliveryMethod,
        delivery_address: order.deliveryAddress || null,
        dropoff_method: order.dropoffMethod || null,
        assigned_locker_code: order.assignedLockerCode || null,
        payment_method: order.paymentMethod,
        payment_status: order.paymentStatus,
        card_last4: order.cardLast4 || null,
        status: order.status,
        collection_status: order.collectionStatus,
        bag_verified: order.bagVerified,
        collection_date: order.collectionDate,
        history: order.history,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
      },
    });
    return res.ok;
  },

  async listIncidents(): Promise<Incident[] | null> {
    const res = await sbRequest<Array<Record<string, unknown>>>(
      'kicksxr_incidents?select=*&order=created_at.desc',
    );
    if (!res.ok || !res.data) return null;
    return res.data.map((row) => ({
      id: String(row.id),
      type: row.type as Incident['type'],
      bagCode: String(row.bag_code),
      folio: row.folio ? String(row.folio) : undefined,
      campusId: String(row.campus_id),
      campusName: String(row.campus_name),
      description: String(row.description),
      status: row.status as Incident['status'],
      resolutionNote: row.resolution_note ? String(row.resolution_note) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  async upsertIncident(incident: Incident): Promise<boolean> {
    const res = await sbRequest('kicksxr_incidents?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: {
        id: incident.id,
        type: incident.type,
        bag_code: incident.bagCode,
        folio: incident.folio || null,
        campus_id: incident.campusId,
        campus_name: incident.campusName,
        description: incident.description,
        status: incident.status,
        resolution_note: incident.resolutionNote || null,
        created_at: incident.createdAt,
        updated_at: incident.updatedAt,
      },
    });
    return res.ok;
  },

  async listNotifications(): Promise<NotificationLog[] | null> {
    const res = await sbRequest<Array<Record<string, unknown>>>(
      'kicksxr_notifications?select=*&order=created_at.desc&limit=120',
    );
    if (!res.ok || !res.data) return null;
    return res.data.map((row) => ({
      id: String(row.id),
      orderId: row.order_id ? String(row.order_id) : undefined,
      folio: row.folio ? String(row.folio) : undefined,
      recipientWhatsapp: row.recipient_whatsapp
        ? String(row.recipient_whatsapp)
        : undefined,
      recipientName: row.recipient_name ? String(row.recipient_name) : undefined,
      channel: (row.channel as 'WhatsApp' | 'Push') || 'WhatsApp',
      title: String(row.title),
      message: String(row.message),
      whatsappUrl: row.whatsapp_url ? String(row.whatsapp_url) : undefined,
      read: Boolean(row.is_read),
      createdAt: String(row.created_at),
    }));
  },

  async upsertNotification(ntf: NotificationLog): Promise<boolean> {
    const res = await sbRequest('kicksxr_notifications?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: {
        id: ntf.id,
        order_id: ntf.orderId || null,
        folio: ntf.folio || null,
        recipient_whatsapp: ntf.recipientWhatsapp || null,
        recipient_name: ntf.recipientName || null,
        channel: ntf.channel,
        title: ntf.title,
        message: ntf.message,
        whatsapp_url: ntf.whatsappUrl || null,
        is_read: Boolean(ntf.read),
        created_at: ntf.createdAt,
      },
    });
    return res.ok;
  },

  async getSettings(): Promise<SupabaseSettingsRow | null> {
    const res = await sbRequest<SupabaseSettingsRow[]>(
      'kicksxr_settings?id=eq.1&limit=1',
    );
    return res.ok && res.data && res.data.length > 0 ? res.data[0] : null;
  },

  async upsertSettings(settings: SupabaseSettingsRow): Promise<boolean> {
    const res = await sbRequest('kicksxr_settings?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: settings,
    });
    return res.ok;
  },
};
