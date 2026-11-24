import type {
  AdminConfig,
  AdminDashboardMetrics,
  AuthUser,
  Campus,
  CreatedCredentials,
  DeliveryMethod,
  DropoffMethod,
  Incident,
  IncidentStatus,
  IncidentType,
  ManagedAdminUser,
  ManagedClientUser,
  NotificationLog,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PublicConfig,
  PublicOrderTrack,
  SupabaseHealthStatus,
} from '../types';

// Keep Bearer token strictly in JS memory (never localStorage/sessionStorage)
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(url, {...options, headers});
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      data?.error || `Error de comunicación (${res.status})`,
      res.status,
      data?.code,
    );
  }

  return data as T;
}

export const api = {
  getPublicConfig: () => request<PublicConfig>('/api/public/config'),

  trackOrder: (folio: string) =>
    request<PublicOrderTrack>(`/api/orders/track/${encodeURIComponent(folio.trim())}`),

  // Client auth
  registerClient: (body: {
    name: string;
    username: string;
    whatsapp: string;
    password: string;
    address: string;
  }) =>
    request<{token: string; user: AuthUser}>('/api/auth/client/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  loginClient: (body: {username: string; password: string}) =>
    request<{token: string; user: AuthUser}>('/api/auth/client/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateClientProfile: (body: {name: string; whatsapp: string; address: string}) =>
    request<{user: AuthUser}>('/api/client/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // Client orders
  getMyOrders: () =>
    request<{orders: Order[]; notifications: NotificationLog[]}>('/api/orders/mine'),

  createOrder: (body: {
    clientName: string;
    clientWhatsapp: string;
    pairs: number;
    serviceId: string;
    campusId: string;
    deliveryMethod: DeliveryMethod;
    deliveryAddress?: string;
    paymentMethod: PaymentMethod;
    cardLast4?: string;
    photoDataUrl?: string;
  }) =>
    request<{order: Order}>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  reportDeposit: (orderId: string, dropoffMethod: DropoffMethod) =>
    request<{order: Order}>(`/api/orders/${encodeURIComponent(orderId)}/deposit`, {
      method: 'POST',
      body: JSON.stringify({dropoffMethod}),
    }),

  markNotificationRead: (notificationId: string) =>
    request<{ok: boolean}>(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PATCH',
    }),

  markAllNotificationsRead: () =>
    request<{ok: boolean}>('/api/notifications/read-all', {
      method: 'POST',
    }),

  // Admin auth (login only — no public admin registration)
  loginAdmin: (body: {username: string; password: string}) =>
    request<{token: string; user: AuthUser}>('/api/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Admin user management (create admins & clients + WhatsApp credentials)
  getAdminUsers: () =>
    request<{
      admins: ManagedAdminUser[];
      clients: ManagedClientUser[];
      supabaseConnected: boolean;
    }>('/api/admin/users'),

  createAdminUser: (body: {
    name: string;
    username: string;
    email?: string;
    whatsapp?: string;
    password: string;
  }) =>
    request<{
      admin: ManagedAdminUser;
      credentials: CreatedCredentials;
      supabaseSynced: boolean;
    }>('/api/admin/users/admin', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateAdminUser: (
    id: string,
    body: {active?: boolean; password?: string; whatsapp?: string},
  ) =>
    request<{
      admin: ManagedAdminUser;
      credentials?: CreatedCredentials;
      supabaseSynced: boolean;
    }>(`/api/admin/users/admin/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  createClientUser: (body: {
    name: string;
    username: string;
    whatsapp: string;
    address: string;
    password: string;
  }) =>
    request<{
      client: ManagedClientUser;
      credentials: CreatedCredentials;
      supabaseSynced: boolean;
    }>('/api/admin/users/client', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateClientUser: (
    id: string,
    body: {name?: string; address?: string; password?: string},
  ) =>
    request<{
      client: ManagedClientUser;
      credentials?: CreatedCredentials;
      supabaseSynced: boolean;
    }>(`/api/admin/users/client/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  getSupabaseHealth: () =>
    request<SupabaseHealthStatus>('/api/admin/supabase/health'),

  // Admin operations
  getAdminOverview: () =>
    request<{
      metrics: AdminDashboardMetrics;
      orders: Order[];
      incidents: Incident[];
      notifications: NotificationLog[];
      config: AdminConfig;
    }>('/api/admin/overview'),

  confirmCollectionBags: (bagCodes: string[]) =>
    request<{updatedCount: number; orders: Order[]}>('/api/admin/collections/confirm', {
      method: 'POST',
      body: JSON.stringify({bagCodes}),
    }),

  updateAdminOrder: (
    orderId: string,
    body: {
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      bagCode?: string;
      note?: string;
    },
  ) =>
    request<{order: Order}>(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  confirmDelivery: (body: {
    folio: string;
    deliveryMethod: DeliveryMethod;
    markPaid?: boolean;
  }) =>
    request<{order: Order}>('/api/admin/orders/deliver', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createIncident: (body: {
    type: IncidentType;
    bagCode: string;
    folio?: string;
    campusId?: string;
    description?: string;
  }) =>
    request<{incident: Incident}>('/api/admin/incidents', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateIncident: (
    incidentId: string,
    body: {status?: IncidentStatus; resolutionNote?: string},
  ) =>
    request<{incident: Incident}>(`/api/admin/incidents/${encodeURIComponent(incidentId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  createCampus: (body: {name: string; address: string; type: 'university' | 'point'}) =>
    request<{campus: Campus}>('/api/admin/config/campuses', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateCampus: (id: string, body: {active?: boolean; name?: string; address?: string}) =>
    request<{campus: Campus}>(`/api/admin/config/campuses/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  createService: (body: {
    name: string;
    description: string;
    price: number;
    turnaroundHours: number;
  }) =>
    request('/api/admin/config/services', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateService: (id: string, body: {price?: number; active?: boolean; name?: string}) =>
    request(`/api/admin/config/services/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  createLocker: (body: {code: string; campusId: string}) =>
    request('/api/admin/config/lockers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateLocker: (id: string, body: {status: 'disponible' | 'ocupado' | 'mantenimiento'}) =>
    request(`/api/admin/config/lockers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  updateSettings: (body: {shippingFee: number}) =>
    request('/api/admin/config/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export function subscribeToRealtimeUpdates(
  onUpdate: (event: {
    type: string;
    folio?: string;
    orderId?: string;
    status?: string;
    title?: string;
    message?: string;
  }) => void,
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }
  const source = new EventSource('/api/events');
  let pollTimer: number | null = null;

  const handler = (ev: MessageEvent) => {
    try {
      const parsed = JSON.parse(ev.data);
      onUpdate(parsed);
    } catch {
      onUpdate({type: 'orders'});
    }
  };

  const onConnected = (ev: MessageEvent) => {
    try {
      const parsed = JSON.parse(ev.data);
      if (parsed?.mode === 'serverless') {
        source.close();
        if (pollTimer === null) {
          pollTimer = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
              onUpdate({type: 'orders'});
            }
          }, 20000);
        }
      }
    } catch {
      // Ignore parse errors
    }
  };

  source.addEventListener('update', handler);
  source.addEventListener('connected', onConnected);
  return () => {
    source.removeEventListener('update', handler);
    source.removeEventListener('connected', onConnected);
    source.close();
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
    }
  };
}
