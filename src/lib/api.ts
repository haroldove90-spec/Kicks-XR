import type {
  AdminConfig,
  AdminDashboardMetrics,
  AuthUser,
  Campus,
  Coupon,
  CreatedCredentials,
  DeliveryMethod,
  DropoffMethod,
  Incident,
  IncidentStatus,
  IncidentType,
  ManagedAdminUser,
  ManagedClientUser,
  MercadoPagoAdminConfig,
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
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
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
    if (res.status === 401 && authToken && !url.includes('/api/auth/')) {
      unauthorizedHandler?.();
    }
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

  // Client auth (Homeli onboarding + email/phone login)
  registerClient: (body: {
    name: string;
    email?: string;
    username?: string;
    whatsapp: string;
    password: string;
    address?: string;
    mapsUrl?: string;
    age?: number;
    idDocumentNumber?: string;
    language?: 'es' | 'en';
    accountMode?: 'usuario' | 'negocio' | 'ambos';
    locationGranted?: boolean;
  }) =>
    request<{token: string; user: AuthUser}>('/api/auth/client/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  loginClient: (body: {email?: string; username?: string; password: string}) =>
    request<{token: string; user: AuthUser}>('/api/auth/client/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  requestPhoneOtp: (body: {phone: string; countryCode?: string}) =>
    request<{
      sent: boolean;
      maskedPhone: string;
      expiresInSeconds: number;
      deliveryMode: 'twilio' | 'instant';
      instantCode?: string;
    }>('/api/auth/client/otp/request', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  verifyPhoneOtp: (body: {
    phone: string;
    code: string;
    language?: 'es' | 'en';
    accountMode?: 'usuario' | 'negocio' | 'ambos';
    locationGranted?: boolean;
  }) =>
    request<{token: string; user: AuthUser; isNewUser: boolean}>(
      '/api/auth/client/otp/verify',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),

  completeClientOnboarding: (body: {
    name?: string;
    city?: string;
    birthDate?: string;
    gender?: string;
    interests?: string[];
    avatarDataUrl?: string;
    language?: 'es' | 'en';
    accountMode?: 'usuario' | 'negocio' | 'ambos';
    locationGranted?: boolean;
    notificationsGranted?: boolean;
    mapsUrl?: string;
    profileCompleted?: boolean;
  }) =>
    request<{user: AuthUser}>('/api/client/onboarding', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  startGuestClientSession: (deviceId?: string) =>
    request<{token: string; user: AuthUser}>('/api/auth/client/guest', {
      method: 'POST',
      body: JSON.stringify({deviceId}),
    }),

  updateClientProfile: (body: {
    name: string;
    whatsapp: string;
    address: string;
    mapsUrl?: string;
    age?: number;
    idDocumentNumber?: string;
    email?: string;
    city?: string;
    birthDate?: string;
    gender?: string;
    interests?: string[];
    avatarDataUrl?: string;
  }) =>
    request<{user: AuthUser}>('/api/client/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  changeClientPassword: (body: {currentPassword: string; newPassword: string}) =>
    request<{ok: boolean}>('/api/client/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  validateCoupon: (code: string, subtotal: number) =>
    request<{
      coupon: {
        id: string;
        code: string;
        description: string;
        discountType: 'percent' | 'fixed';
        value: number;
      };
      discountAmount: number;
    }>('/api/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({code, subtotal}),
    }),

  // Client orders
  getMyOrders: () =>
    request<{orders: Order[]; notifications: NotificationLog[]}>('/api/orders/mine'),

  createOrder: (body: {
    clientName: string;
    clientWhatsapp: string;
    clientAge?: number;
    clientIdDocument?: string;
    clientAddress?: string;
    clientMapsUrl?: string;
    pairs: number;
    serviceId: string;
    campusId: string;
    deliveryMethod: DeliveryMethod;
    deliveryAddress?: string;
    paymentMethod: PaymentMethod;
    cardLast4?: string;
    photoDataUrl?: string;
    shoeNotes?: string;
    discountCode?: string;
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

  rateOrder: (orderId: string, body: {rating: number; comment?: string}) =>
    request<{order: Order}>(`/api/orders/${encodeURIComponent(orderId)}/rate`, {
      method: 'POST',
      body: JSON.stringify(body),
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
    mapsUrl?: string;
    age?: number;
    idDocumentNumber?: string;
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
    body: {
      name?: string;
      address?: string;
      mapsUrl?: string;
      age?: number;
      idDocumentNumber?: string;
      password?: string;
    },
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

  createAdminOrder: (body: {
    clientId?: string;
    clientName: string;
    clientWhatsapp: string;
    pairs: number;
    serviceId: string;
    campusId: string;
    deliveryMethod: DeliveryMethod;
    deliveryAddress?: string;
    paymentMethod: PaymentMethod;
    markPaid?: boolean;
    customFolio?: string;
    customTotal?: number;
    unitPrice?: number;
    shoeNotes?: string;
    adminNotes?: string;
    discountCode?: string;
    photoDataUrl?: string;
  }) =>
    request<{order: Order; whatsappUrl: string}>('/api/admin/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateAdminOrder: (
    orderId: string,
    body: {
      folio?: string;
      totalAmount?: number;
      unitPrice?: number;
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      bagCode?: string;
      note?: string;
      adminNotes?: string;
      afterPhotoDataUrl?: string | null;
    },
  ) =>
    request<{order: Order; whatsappUrl: string}>(
      `/api/admin/orders/${encodeURIComponent(orderId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    ),

  cancelAdminOrder: (orderId: string, reason: string) =>
    request<{order: Order; whatsappUrl: string}>(
      `/api/admin/orders/${encodeURIComponent(orderId)}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({reason}),
      },
    ),

  confirmDelivery: (body: {
    folio: string;
    deliveryMethod: DeliveryMethod;
    markPaid?: boolean;
    afterPhotoDataUrl?: string;
  }) =>
    request<{order: Order; whatsappUrl: string}>('/api/admin/orders/deliver', {
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

  updateCampus: (
    id: string,
    body: {active?: boolean; name?: string; address?: string; type?: 'university' | 'point'},
  ) =>
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

  updateService: (
    id: string,
    body: {
      price?: number;
      active?: boolean;
      name?: string;
      description?: string;
      turnaroundHours?: number;
    },
  ) =>
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

  updateSettings: (body: {
    shippingFee?: number;
    nextOrderSeq?: number;
    nextBagSeq?: number;
  }) =>
    request('/api/admin/config/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  createCoupon: (body: {
    code: string;
    description: string;
    discountType: 'percent' | 'fixed';
    value: number;
  }) =>
    request<{coupon: Coupon}>('/api/admin/config/coupons', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateCoupon: (
    id: string,
    body: {active?: boolean; description?: string; value?: number},
  ) =>
    request<{coupon: Coupon}>(`/api/admin/config/coupons/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteCoupon: (id: string) =>
    request<{ok: boolean}>(`/api/admin/config/coupons/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Mercado Pago — Admin configuration
  getMercadoPagoConfig: () =>
    request<{config: MercadoPagoAdminConfig}>('/api/admin/mercadopago'),

  updateMercadoPagoConfig: (body: {
    enabled?: boolean;
    sandboxMode?: boolean;
    publicKey?: string;
    accessToken?: string;
    clearAccessToken?: boolean;
  }) =>
    request<{config: MercadoPagoAdminConfig; supabaseSynced: boolean}>(
      '/api/admin/mercadopago',
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    ),

  testMercadoPagoConfig: () =>
    request<{
      ok: boolean;
      accountId?: string;
      nickname?: string;
      email?: string;
      siteId?: string;
      sandboxMode: boolean;
    }>('/api/admin/mercadopago/test', {
      method: 'POST',
    }),

  // Mercado Pago — Client Checkout Pro
  createMercadoPagoPreference: (orderId: string) =>
    request<{
      preferenceId: string;
      checkoutUrl: string;
      sandboxMode: boolean;
    }>('/api/mercadopago/preference', {
      method: 'POST',
      body: JSON.stringify({orderId}),
    }),

  verifyMercadoPagoPayment: (orderId: string, paymentId?: string) =>
    request<{order: Order; verified: boolean; mpStatus: string}>(
      '/api/mercadopago/verify',
      {
        method: 'POST',
        body: JSON.stringify({orderId, paymentId}),
      },
    ),
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
