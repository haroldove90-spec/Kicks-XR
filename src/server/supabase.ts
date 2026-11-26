import type {
  Campus,
  Coupon,
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
  username?: string | null;
  email?: string | null;
  whatsapp: string;
  whatsapp_normalized: string;
  password_hash: string;
  address: string;
  maps_url?: string | null;
  age?: number | null;
  id_document_number?: string | null;
  user_type: 'general' | 'university';
  ine_photo_data_url?: string | null;
  language?: string | null;
  account_mode?: string | null;
  city?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  interests?: string[] | null;
  avatar_data_url?: string | null;
  location_granted?: boolean | null;
  notifications_granted?: boolean | null;
  profile_completed?: boolean | null;
  created_at: string;
}

export interface SupabaseSettingsRow {
  id: number;
  shipping_fee: number;
  next_order_seq: number;
  next_bag_seq: number;
  mp_enabled?: boolean | null;
  mp_sandbox?: boolean | null;
  mp_public_key?: string | null;
  mp_access_token?: string | null;
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
      'kicksxr_coupons',
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

  async findClientByUsername(username: string): Promise<SupabaseClientRow | null> {
    const clean = encodeURIComponent(username.trim().toLowerCase());
    const res = await sbRequest<SupabaseClientRow[]>(
      `kicksxr_clients?username=ilike.${clean}&limit=1`,
    );
    return res.ok && res.data && res.data.length > 0 ? res.data[0] : null;
  },

  async findClientByEmail(email: string): Promise<SupabaseClientRow | null> {
    const clean = encodeURIComponent(email.trim().toLowerCase());
    const res = await sbRequest<SupabaseClientRow[]>(
      `kicksxr_clients?email=ilike.${clean}&limit=1`,
    );
    return res.ok && res.data && res.data.length > 0 ? res.data[0] : null;
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
    if (!res.ok && res.status === 400) {
      // Backward-compatible fallback if newly added Homeli columns have not yet been migrated in Supabase
      const {
        email: _omitEmail,
        language: _omitLang,
        account_mode: _omitMode,
        city: _omitCity,
        birth_date: _omitBirth,
        gender: _omitGender,
        interests: _omitInterests,
        avatar_data_url: _omitAvatar,
        location_granted: _omitLoc,
        notifications_granted: _omitNotif,
        profile_completed: _omitDone,
        ...v2Client
      } = client;
      const retry0 = await sbRequest('kicksxr_clients?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: v2Client,
      });
      if (retry0.ok) return true;

      const {
        maps_url: _omitMaps,
        age: _omitAge,
        id_document_number: _omitIdDoc,
        ine_photo_data_url: _omitIne,
        ...midClient
      } = v2Client;
      const retry1 = await sbRequest('kicksxr_clients?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: midClient,
      });
      if (retry1.ok) return true;

      const {username: _omitUser, ...legacyClient} = midClient;
      const retry2 = await sbRequest('kicksxr_clients?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: legacyClient,
      });
      return retry2.ok;
    }
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
      clientAge:
        row.client_age !== null && row.client_age !== undefined
          ? Number(row.client_age)
          : undefined,
      clientIdDocument: row.client_id_document
        ? String(row.client_id_document)
        : undefined,
      clientAddress: row.client_address ? String(row.client_address) : undefined,
      clientMapsUrl: row.client_maps_url ? String(row.client_maps_url) : undefined,
      userType: (row.user_type as 'general' | 'university') || 'general',
      campusId: String(row.campus_id),
      campusName: String(row.campus_name),
      pairs: Number(row.pairs || 1),
      serviceId: String(row.service_id),
      serviceName: String(row.service_name),
      unitPrice: Number(row.unit_price || 0),
      shippingFee: Number(row.shipping_fee || 0),
      discountCode: row.discount_code ? String(row.discount_code) : undefined,
      discountAmount: row.discount_amount ? Number(row.discount_amount) : 0,
      totalAmount: Number(row.total_amount || 0),
      photoDataUrl: row.photo_data_url ? String(row.photo_data_url) : undefined,
      afterPhotoDataUrl: row.after_photo_data_url
        ? String(row.after_photo_data_url)
        : undefined,
      shoeNotes: row.shoe_notes ? String(row.shoe_notes) : undefined,
      adminNotes: row.admin_notes ? String(row.admin_notes) : undefined,
      rating:
        row.rating !== null && row.rating !== undefined ? Number(row.rating) : undefined,
      ratingComment: row.rating_comment ? String(row.rating_comment) : undefined,
      ratedAt: row.rated_at ? String(row.rated_at) : undefined,
      deliveryMethod: row.delivery_method as Order['deliveryMethod'],
      deliveryAddress: row.delivery_address ? String(row.delivery_address) : undefined,
      dropoffMethod: (row.dropoff_method as Order['dropoffMethod']) || undefined,
      assignedLockerCode: row.assigned_locker_code
        ? String(row.assigned_locker_code)
        : undefined,
      paymentMethod: row.payment_method as Order['paymentMethod'],
      paymentStatus: row.payment_status as Order['paymentStatus'],
      cardLast4: row.card_last4 ? String(row.card_last4) : undefined,
      mpPreferenceId: row.mp_preference_id ? String(row.mp_preference_id) : undefined,
      mpPaymentId: row.mp_payment_id ? String(row.mp_payment_id) : undefined,
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
    const baseBody = {
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
    };

    const fullBody = {
      ...baseBody,
      after_photo_data_url: order.afterPhotoDataUrl || null,
      shoe_notes: order.shoeNotes || null,
      admin_notes: order.adminNotes || null,
      discount_code: order.discountCode || null,
      discount_amount: order.discountAmount || 0,
      rating: order.rating ?? null,
      rating_comment: order.ratingComment || null,
      rated_at: order.ratedAt || null,
      client_age: order.clientAge ?? null,
      client_id_document: order.clientIdDocument || null,
      client_address: order.clientAddress || null,
      client_maps_url: order.clientMapsUrl || null,
      mp_preference_id: order.mpPreferenceId || null,
      mp_payment_id: order.mpPaymentId || null,
    };

    const res = await sbRequest('kicksxr_orders?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: fullBody,
    });
    if (!res.ok && res.status === 400) {
      // Backward-compatible fallback if new columns have not yet been added in Supabase
      const retry = await sbRequest('kicksxr_orders?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: baseBody,
      });
      return retry.ok;
    }
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
    if (!res.ok && res.status === 400) {
      const retry = await sbRequest('kicksxr_settings?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: {
          id: settings.id,
          shipping_fee: settings.shipping_fee,
          next_order_seq: settings.next_order_seq,
          next_bag_seq: settings.next_bag_seq,
        },
      });
      return retry.ok;
    }
    return res.ok;
  },

  async listCoupons(): Promise<Coupon[] | null> {
    const res = await sbRequest<Array<Record<string, unknown>>>(
      'kicksxr_coupons?select=*&order=created_at.desc',
    );
    if (!res.ok || !res.data) return null;
    return res.data.map((row) => ({
      id: String(row.id),
      code: String(row.code).toUpperCase(),
      description: String(row.description || ''),
      discountType: row.discount_type === 'fixed' ? 'fixed' : 'percent',
      value: Number(row.value || 0),
      active: Boolean(row.active),
      usageCount: Number(row.usage_count || 0),
      createdAt: String(row.created_at),
    }));
  },

  async upsertCoupon(coupon: Coupon): Promise<boolean> {
    const res = await sbRequest('kicksxr_coupons?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: {
        id: coupon.id,
        code: coupon.code.toUpperCase(),
        description: coupon.description,
        discount_type: coupon.discountType,
        value: coupon.value,
        active: coupon.active,
        usage_count: coupon.usageCount,
        created_at: coupon.createdAt,
      },
    });
    return res.ok;
  },

  async deleteCoupon(id: string): Promise<boolean> {
    const res = await sbRequest(
      `kicksxr_coupons?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    );
    return res.ok;
  },
};
