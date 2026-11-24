import type {
  AdminConfig,
  AdminDashboardMetrics,
  AuthUser,
  Campus,
  DeliveryMethod,
  DropoffMethod,
  Incident,
  IncidentStatus,
  IncidentType,
  NotificationLog,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PublicConfig,
  PublicOrderTrack,
} from '../types';

// Keep Bearer token strictly in JS memory (never localStorage/sessionStorage)
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
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
    throw new Error(data?.error || `Error de comunicación (${res.status})`);
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
    whatsapp: string;
    password: string;
    address: string;
  }) =>
    request<{token: string; user: AuthUser}>('/api/auth/client/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  loginClient: (body: {whatsapp: string; password: string}) =>
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

  // Admin auth
  getAdminStatus: () =>
    request<{
      configured: boolean;
      usesEnvPasscode: boolean;
      supabaseConnected: boolean;
      adminUsernameHint: string;
    }>('/api/auth/admin/status'),

  setupAdmin: (body: {name: string; username: string; email?: string; password: string}) =>
    request<{token: string; user: AuthUser}>('/api/auth/admin/setup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  loginAdmin: (body: {username: string; password: string}) =>
    request<{token: string; user: AuthUser}>('/api/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

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
  const handler = (ev: MessageEvent) => {
    try {
      const parsed = JSON.parse(ev.data);
      onUpdate(parsed);
    } catch {
      onUpdate({type: 'orders'});
    }
  };
  source.addEventListener('update', handler);
  return () => {
    source.removeEventListener('update', handler);
    source.close();
  };
}
