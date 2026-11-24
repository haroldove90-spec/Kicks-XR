export type UserRole = 'client' | 'admin';

export type OrderStatus =
  | 'Pendiente de depósito'
  | 'Depósito reportado'
  | 'Recibido por KicksXR'
  | 'En limpieza'
  | 'Listo para entrega'
  | 'Entregado';

export type CollectionStatus = 'Pendiente' | 'Recolectado';
export type DeliveryMethod = 'pickup' | 'delivery';
export type DropoffMethod = 'staff' | 'locker';
export type PaymentMethod = 'cash' | 'card';
export type PaymentStatus = 'Pago pendiente' | 'Pagado';

export type IncidentType =
  | 'Bolsa faltante'
  | 'Bolsa sin pedido'
  | 'Código duplicado';

export type IncidentStatus = 'Abierta' | 'En revisión' | 'Resuelta';

export interface AuthUser {
  id: string;
  role: UserRole;
  name: string;
  username?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  userType?: 'general' | 'university';
  campusId?: string;
  campusName?: string;
}

export interface Campus {
  id: string;
  name: string;
  code: string;
  address: string;
  type: 'university' | 'point';
  active: boolean;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  turnaroundHours: number;
  active: boolean;
}

export interface Locker {
  id: string;
  code: string;
  campusId: string;
  status: 'disponible' | 'ocupado' | 'mantenimiento';
  currentBagCode?: string;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface Order {
  id: string;
  folio: string;
  bagCode: string;
  orderQrPayload: string;
  clientId: string;
  clientName: string;
  clientWhatsapp: string;
  userType: 'general' | 'university';
  campusId: string;
  campusName: string;
  pairs: number;
  serviceId: string;
  serviceName: string;
  unitPrice: number;
  shippingFee: number;
  totalAmount: number;
  photoDataUrl?: string;
  deliveryMethod: DeliveryMethod;
  deliveryAddress?: string;
  dropoffMethod?: DropoffMethod;
  assignedLockerCode?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cardLast4?: string;
  status: OrderStatus;
  collectionStatus: CollectionStatus;
  bagVerified: boolean;
  createdAt: string;
  collectionDate: string;
  updatedAt: string;
  history: StatusHistoryEntry[];
}

export interface PublicOrderTrack {
  folio: string;
  bagCode: string;
  campusName: string;
  pairs: number;
  serviceName: string;
  deliveryMethod: DeliveryMethod;
  dropoffMethod?: DropoffMethod;
  assignedLockerCode?: string;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  history: StatusHistoryEntry[];
}

export interface Incident {
  id: string;
  type: IncidentType;
  bagCode: string;
  folio?: string;
  campusId: string;
  campusName: string;
  description: string;
  status: IncidentStatus;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLog {
  id: string;
  orderId?: string;
  folio?: string;
  recipientWhatsapp?: string;
  recipientName?: string;
  channel: 'WhatsApp' | 'Push';
  title: string;
  message: string;
  whatsappUrl?: string;
  read?: boolean;
  createdAt: string;
}

export interface PublicConfig {
  campuses: Campus[];
  services: ServiceItem[];
  shippingFee: number;
  availableLockersByCampus: Record<string, number>;
  supabaseConnected?: boolean;
}

export interface AdminConfig extends PublicConfig {
  lockers: Locker[];
  nextOrderSeq: number;
  nextBagSeq: number;
}

export interface AdminDashboardMetrics {
  totalOrders: number;
  pendingCollections: number;
  inCleaning: number;
  readyForDelivery: number;
  delivered: number;
  openIncidents: number;
  revenuePaid: number;
  revenuePending: number;
}

export interface PopupAlert {
  id: string;
  title: string;
  message: string;
  tone?: 'success' | 'info' | 'warning' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  whatsappUrl?: string;
}

export interface ManagedAdminUser {
  id: string;
  name: string;
  username: string;
  email?: string;
  whatsapp?: string;
  role: 'admin';
  active: boolean;
  createdAt: string;
}

export interface ManagedClientUser {
  id: string;
  name: string;
  whatsapp: string;
  address: string;
  userType: 'general' | 'university';
  createdAt: string;
}

export interface CreatedCredentials {
  role: UserRole;
  name: string;
  identifier: string;
  password: string;
  whatsapp?: string;
  loginUrl: string;
  shareMessage: string;
  whatsappUrl: string;
}

export interface SupabaseHealthStatus {
  configured: boolean;
  connected: boolean;
  tables: Record<string, boolean>;
  error?: string;
}

