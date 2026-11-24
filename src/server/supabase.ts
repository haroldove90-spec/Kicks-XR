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

function getSupabaseRestBase(): string | null {
  const rawUrl = (process.env.SUPABASE_URL || '').trim();
  if (!rawUrl) return null;
  const cleaned = rawUrl.replace(/\/+$/, '');
  if (cleaned.endsWith('/rest/v1')) return cleaned;
  return `${cleaned}/rest/v1`;
}

function getSupabaseApiKey(): string | null {
  const key = (
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

async function sbFetch<T>(
  tablePath: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    prefer?: string;
  } = {},
): Promise<T | null> {
  const base = getSupabaseRestBase();
  const apiKey = getSupabaseApiKey();
  if (!base || !apiKey) return null;

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
    });
    if (!res.ok) {
      return null;
    }
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export const supabaseStore = {
  isConfigured: isSupabaseConfigured,

  async findAdminByIdentifier(identifier: string): Promise<SupabaseAdminRow | null> {
    const clean = encodeURIComponent(identifier.trim().toLowerCase());
    const rows = await sbFetch<SupabaseAdminRow[]>(
      `kicksxr_admins?or=(username.ilike.${clean},email.ilike.${clean})&active=eq.true&limit=1`,
    );
    return rows && rows.length > 0 ? rows[0] : null;
  },

  async listAdmins(): Promise<SupabaseAdminRow[] | null> {
    return sbFetch<SupabaseAdminRow[]>('kicksxr_admins?select=*&active=eq.true');
  },

  async upsertAdmin(admin: SupabaseAdminRow): Promise<boolean> {
    const res = await sbFetch('kicksxr_admins', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: admin,
    });
    return res !== null;
  },

  async findClientByWhatsapp(whatsappNormalized: string): Promise<SupabaseClientRow | null> {
    const clean = encodeURIComponent(whatsappNormalized);
    const rows = await sbFetch<SupabaseClientRow[]>(
      `kicksxr_clients?whatsapp_normalized=eq.${clean}&limit=1`,
    );
    return rows && rows.length > 0 ? rows[0] : null;
  },

  async upsertClient(client: SupabaseClientRow): Promise<void> {
    await sbFetch('kicksxr_clients', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: client,
    });
  },

  async upsertOrder(order: Order): Promise<void> {
    await sbFetch('kicksxr_orders', {
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
  },

  async upsertIncident(incident: Incident): Promise<void> {
    await sbFetch('kicksxr_incidents', {
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
  },

  async upsertNotification(ntf: NotificationLog): Promise<void> {
    await sbFetch('kicksxr_notifications', {
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
  },

  async upsertCampus(campus: Campus): Promise<void> {
    await sbFetch('kicksxr_campuses', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: campus,
    });
  },

  async upsertService(service: ServiceItem): Promise<void> {
    await sbFetch('kicksxr_services', {
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
  },

  async upsertLocker(locker: Locker): Promise<void> {
    await sbFetch('kicksxr_lockers', {
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
  },
};
