import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  Ban,
  Banknote,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Home,
  IdCard,
  ImageOff,
  Layers,
  Lock,
  MapPin,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  Truck,
  UserPlus,
  Users,
  Wallet,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {QRCodeSVG} from 'qrcode.react';
import {api, subscribeToRealtimeUpdates} from '../lib/api';
import {compressImageFile} from '../lib/image';
import {
  formatPaymentMethodLabel,
  isSafeGoogleMapsUrl,
  parseOrderQrPayload,
  type ParsedOrderQrData,
} from '../lib/qrPayload';
import type {
  AdminConfig,
  AdminDashboardMetrics,
  AuthUser,
  Campus,
  DeliveryMethod,
  Incident,
  IncidentStatus,
  IncidentType,
  NotificationLog,
  Order,
  OrderStatus,
  PaymentStatus,
  PopupAlert,
  SupabaseHealthStatus,
} from '../types';
import {AdminMercadoPagoModule} from './AdminMercadoPagoModule';
import {
  AdminOrderDetailModal,
  isSafePhotoDataUrl,
} from './AdminOrderDetailModal';
import {AdminReportsModule} from './AdminReportsModule';
import {AdminServicesModule} from './AdminServicesModule';
import {AdminUsersModule} from './AdminUsersModule';
import {AdminWalkInOrderModal} from './AdminWalkInOrderModal';
import {AppShell, type NavModuleItem} from './AppShell';
import {NotificationsCenter} from './NotificationsCenter';
import {OrderReceiptModal} from './OrderReceiptModal';
import {OrderTimeline} from './OrderTimeline';
import {QRScannerModal} from './QRScannerModal';

interface AdminAppProps {
  user: AuthUser;
  onLogout: () => void;
  onPushAlert: (alert: Omit<PopupAlert, 'id'>) => void;
  onSwitchToClient: () => void;
}

type AdminTab =
  | 'home'
  | 'collections'
  | 'orders'
  | 'services'
  | 'mercadopago'
  | 'reports'
  | 'incidents'
  | 'users'
  | 'notifications'
  | 'config';

const ORDER_STATUSES: OrderStatus[] = [
  'Depósito reportado',
  'Recibido por KicksXR',
  'En limpieza',
  'Listo para entrega',
  'Entregado',
];

function buildDirectWhatsappUrl(order: Order, customStatus?: OrderStatus): string {
  const digits = (order.clientWhatsapp || '').replace(/\D/g, '');
  const fullPhone =
    digits.length === 10
      ? `52${digits}`
      : digits.startsWith('52')
        ? digits
        : `52${digits}`;
  const status = customStatus || order.status;
  const text = `Hola ${order.clientName}, te contactamos de Homeli. Tu pedido ${order.folio} (Bolsa ${order.bagCode} · ${order.serviceName}) se encuentra en estatus: "${status}". Total: $${order.totalAmount} MXN (${order.paymentStatus}).`;
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
}

const INCIDENT_TYPES: IncidentType[] = [
  'Bolsa faltante',
  'Bolsa sin pedido',
  'Código duplicado',
];

export const AdminApp: React.FC<AdminAppProps> = ({
  user,
  onLogout,
  onPushAlert,
  onSwitchToClient,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('collections');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [config, setConfig] = useState<AdminConfig | null>(null);

  // Module 1: Recolecciones filters
  const [filterCampus, setFilterCampus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [filterCollectionState, setFilterCollectionState] = useState<
    'all' | 'Pendiente' | 'Recolectado'
  >('Pendiente');

  // Module 2: Verificar bolsas
  const [bagScanInput, setBagScanInput] = useState('');
  const [checkedBags, setCheckedBags] = useState<Record<string, boolean>>({});
  const [scannerTarget, setScannerTarget] = useState<
    'bag' | 'delivery' | 'quick' | null
  >(null);
  const [scannedQrResult, setScannedQrResult] = useState<{
    decoded: ParsedOrderQrData;
    matchedOrder: Order | null;
  } | null>(null);

  // Module 3: Gestionar pedido
  const [orderSearch, setOrderSearch] = useState('');
  const [orderPhotoFilter, setOrderPhotoFilter] = useState<'all' | 'with_photo'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOrderModal, setDetailOrderModal] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<OrderStatus>('En limpieza');
  const [editPayment, setEditPayment] = useState<PaymentStatus>('Pago pendiente');
  const [editFolio, setEditFolio] = useState('');
  const [editBagCode, setEditBagCode] = useState('');
  const [editTotalAmount, setEditTotalAmount] = useState('');
  const [editAfterPhoto, setEditAfterPhoto] = useState<string | null | undefined>(
    undefined,
  );
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [editStatusNote, setEditStatusNote] = useState('');
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const afterPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    filename: string;
  } | null>(null);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);

  // Module 4: Confirmar devolución
  const [deliverMethod, setDeliverMethod] = useState<DeliveryMethod>('pickup');
  const [deliverFolio, setDeliverFolio] = useState('');
  const [deliverMarkPaid, setDeliverMarkPaid] = useState(true);
  const [deliverAfterPhoto, setDeliverAfterPhoto] = useState<string | undefined>(
    undefined,
  );
  const deliverAfterPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Module 5: Incidencias
  const [incType, setIncType] = useState<IncidentType>('Bolsa faltante');
  const [incBagCode, setIncBagCode] = useState('');
  const [incFolio, setIncFolio] = useState('');
  const [incCampusId, setIncCampusId] = useState('');
  const [incDesc, setIncDesc] = useState('');
  const [incFilter, setIncFilter] = useState<'all' | IncidentStatus>('all');

  // Module 6: Configuración
  const [newCampusName, setNewCampusName] = useState('');
  const [newCampusAddress, setNewCampusAddress] = useState('');
  const [newCampusType, setNewCampusType] = useState<'university' | 'point'>(
    'point',
  );
  const [editingCampusId, setEditingCampusId] = useState<string | null>(null);
  const [editCampusName, setEditCampusName] = useState('');
  const [editCampusAddress, setEditCampusAddress] = useState('');
  const [editCampusType, setEditCampusType] = useState<'university' | 'point'>('point');

  const [qrCampusModal, setQrCampusModal] = useState<Campus | null>(null);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('250');
  const [newServiceHours, setNewServiceHours] = useState('24');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editServiceName, setEditServiceName] = useState('');
  const [editServiceDesc, setEditServiceDesc] = useState('');
  const [editServicePrice, setEditServicePrice] = useState('250');
  const [editServiceHours, setEditServiceHours] = useState('24');

  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDesc, setNewCouponDesc] = useState('');
  const [newCouponType, setNewCouponType] = useState<'percent' | 'fixed'>('percent');
  const [newCouponValue, setNewCouponValue] = useState('10');

  const [newLockerCode, setNewLockerCode] = useState('');
  const [newLockerCampus, setNewLockerCampus] = useState('');
  const [shippingFeeInput, setShippingFeeInput] = useState('75');
  const [nextOrderSeqInput, setNextOrderSeqInput] = useState('1044');
  const [nextBagSeqInput, setNextBagSeqInput] = useState('30');
  const [sbHealth, setSbHealth] = useState<SupabaseHealthStatus | null>(null);
  const [checkingSb, setCheckingSb] = useState(false);

  const checkSupabaseHealth = useCallback(async () => {
    setCheckingSb(true);
    try {
      const status = await api.getSupabaseHealth();
      setSbHealth(status);
    } catch {
      // ignore transient error
    } finally {
      setCheckingSb(false);
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    try {
      const data = await api.getAdminOverview();
      setMetrics(data.metrics);
      setOrders(data.orders);
      setIncidents(data.incidents);
      setNotifications(data.notifications);
      setConfig(data.config);
      setShippingFeeInput(String(data.config.shippingFee));
      setNextOrderSeqInput(String(data.config.nextOrderSeq));
      setNextBagSeqInput(String(data.config.nextBagSeq));
      if (!newLockerCampus && data.config.campuses[0]) {
        setNewLockerCampus(data.config.campuses[0].id);
      }
      if (!incCampusId && data.config.campuses[0]) {
        setIncCampusId(data.config.campuses[0].id);
      }
      setSelectedOrderId((prev) => prev || data.orders[0]?.id || null);
    } catch (err) {
      onPushAlert({
        title: 'Error de carga',
        message:
          err instanceof Error ? err.message : 'Error cargando datos del panel.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [incCampusId, newLockerCampus, onPushAlert]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (activeTab === 'config' && !sbHealth) {
      checkSupabaseHealth();
    }
  }, [activeTab, sbHealth, checkSupabaseHealth]);

  useEffect(() => {
    return subscribeToRealtimeUpdates((ev) => {
      fetchOverview();
      if (ev.title && (ev.type === 'orders' || ev.type === 'incidents')) {
        onPushAlert({
          title: ev.title,
          message: ev.message || 'Actualización operativa en tiempo real.',
          tone: ev.type === 'incidents' ? 'warning' : 'info',
          actionLabel:
            ev.type === 'incidents' ? 'Ver incidencias' : 'Ver notificaciones',
          onAction: () =>
            setActiveTab(
              ev.type === 'incidents' ? 'incidents' : 'notifications',
            ),
        });
      }
    });
  }, [fetchOverview, onPushAlert]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || orders[0] || null,
    [orders, selectedOrderId],
  );

  useEffect(() => {
    if (!selectedOrder) return;
    setEditStatus(
      selectedOrder.status === 'Pendiente de depósito'
        ? 'Depósito reportado'
        : selectedOrder.status,
    );
    setEditPayment(selectedOrder.paymentStatus);
    setEditFolio(selectedOrder.folio);
    setEditBagCode(selectedOrder.bagCode);
    setEditTotalAmount(String(selectedOrder.totalAmount));
    setEditAfterPhoto(selectedOrder.afterPhotoDataUrl);
    setEditAdminNotes(selectedOrder.adminNotes || '');
    setEditStatusNote('');
    setCancelMode(false);
    setCancelReason('');
  }, [selectedOrder]);

  const collectionBatch = useMemo(() => {
    return orders.filter((o) => {
      if (filterCampus !== 'all' && o.campusId !== filterCampus) return false;
      if (filterDate && o.collectionDate !== filterDate) return false;
      if (
        filterCollectionState !== 'all' &&
        o.collectionStatus !== filterCollectionState
      ) {
        return false;
      }
      return true;
    });
  }, [orders, filterCampus, filterDate, filterCollectionState]);

  const pendingVerificationOrders = useMemo(
    () =>
      collectionBatch.filter(
        (o) =>
          o.collectionStatus === 'Pendiente' ||
          checkedBags[o.bagCode] !== undefined,
      ),
    [collectionBatch, checkedBags],
  );

  const openPhotoLightbox = useCallback((order: Order) => {
    if (!isSafePhotoDataUrl(order.photoDataUrl)) return;
    setLightboxZoomed(false);
    setLightboxPhoto({
      url: order.photoDataUrl,
      title: `Tenis · ${order.folio} (${order.bagCode})`,
      subtitle: `${order.clientName} · ${order.serviceName} (${order.pairs} ${order.pairs === 1 ? 'par' : 'pares'})`,
      filename: `${order.folio}-${order.bagCode}-tenis.jpg`,
    });
  }, []);

  useEffect(() => {
    if (!lightboxPhoto) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxPhoto(null);
        setLightboxZoomed(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxPhoto]);

  const ordersWithPhotoCount = useMemo(
    () => orders.filter((o) => isSafePhotoDataUrl(o.photoDataUrl)).length,
    [orders],
  );

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (orderPhotoFilter === 'with_photo' && !isSafePhotoDataUrl(o.photoDataUrl)) {
        return false;
      }
      if (!q) return true;
      return (
        (o.folio || '').toLowerCase().includes(q) ||
        (o.bagCode || '').toLowerCase().includes(q) ||
        (o.clientName || '').toLowerCase().includes(q) ||
        (o.clientWhatsapp || '').toLowerCase().includes(q) ||
        (o.serviceName || '').toLowerCase().includes(q) ||
        (o.campusName || '').toLowerCase().includes(q) ||
        (o.assignedLockerCode || '').toLowerCase().includes(q)
      );
    });
  }, [orders, orderSearch, orderPhotoFilter]);

  const readyToDeliverOrders = useMemo(
    () => orders.filter((o) => o.status !== 'Entregado' && o.status !== 'Cancelado'),
    [orders],
  );

  const handleScanOrAddBag = (rawValue: string) => {
    const parsed = parseOrderQrPayload(rawValue);
    const code = (parsed.bagCode || parsed.folio || rawValue.trim()).toUpperCase();
    if (!code) return;
    setBagScanInput(code);

    const match = orders.find(
      (o) =>
        (parsed.bagCode && o.bagCode.toUpperCase() === parsed.bagCode) ||
        (parsed.folio && o.folio.toUpperCase() === parsed.folio) ||
        o.bagCode.toUpperCase() === code ||
        o.folio.toUpperCase() === code,
    );
    if (!match) {
      onPushAlert({
        title: `Bolsa ${code} sin pedido`,
        message:
          'No existe un pedido vinculado a este código. Puedes registrarla como incidencia.',
        tone: 'warning',
        actionLabel: 'Ir a incidencias',
        onAction: () => {
          setIncType('Bolsa sin pedido');
          setIncBagCode(code);
          setActiveTab('incidents');
        },
      });
      return;
    }
    setCheckedBags((prev) => ({...prev, [match.bagCode]: true}));
    onPushAlert({
      title: `Bolsa ${match.bagCode} verificada`,
      message: `Vinculada al folio ${match.folio} (${match.clientName}).`,
      tone: 'success',
    });
  };

  const handleQuickQrScan = (rawValue: string) => {
    const decoded = parseOrderQrPayload(rawValue);
    if (!decoded.raw) return;
    const matchedOrder =
      orders.find(
        (o) =>
          (decoded.folio && o.folio.toUpperCase() === decoded.folio) ||
          (decoded.bagCode && o.bagCode.toUpperCase() === decoded.bagCode),
      ) || null;
    setScannedQrResult({decoded, matchedOrder});
    if (matchedOrder) {
      onPushAlert({
        title: `QR leído · ${matchedOrder.folio}`,
        message: `Cliente: ${matchedOrder.clientName} · Servicio: ${matchedOrder.serviceName}.`,
        tone: 'success',
      });
    } else if (decoded.clientName || decoded.folio) {
      onPushAlert({
        title: 'Datos leídos del código QR',
        message: `Se extrajo la ficha${decoded.clientName ? ` de ${decoded.clientName}` : ''}.`,
        tone: 'info',
      });
    } else {
      onPushAlert({
        title: 'Código leído sin coincidencia',
        message: `No se encontró un pedido con "${decoded.raw.slice(0, 32)}".`,
        tone: 'warning',
      });
    }
  };

  const handleConfirmReception = async () => {
    const verifiedCodes = Object.entries(checkedBags)
      .filter(([, isChecked]) => isChecked)
      .map(([code]) => code);

    if (verifiedCodes.length === 0) {
      onPushAlert({
        title: 'Selecciona al menos una bolsa',
        message: 'Marca las bolsas verificadas antes de confirmar recepción.',
        tone: 'warning',
      });
      return;
    }

    try {
      const res = await api.confirmCollectionBags(verifiedCodes);
      setCheckedBags({});
      setBagScanInput('');
      onPushAlert({
        title: 'Recepción confirmada',
        message: `${res.updatedCount} bolsa(s) recibidas en taller. Clientes actualizados a "Recibido por KicksXR".`,
        tone: 'success',
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error en recepción',
        message:
          err instanceof Error ? err.message : 'Error al confirmar recepción.',
        tone: 'error',
      });
    }
  };

  const handleOpenIncidentFromCollection = () => {
    const missingOrder = pendingVerificationOrders.find(
      (o) => !checkedBags[o.bagCode],
    );
    setIncType('Bolsa faltante');
    setIncBagCode(bagScanInput.trim().toUpperCase() || missingOrder?.bagCode || '');
    setIncFolio(missingOrder?.folio || '');
    setIncCampusId(missingOrder?.campusId || config?.campuses[0]?.id || '');
    setIncDesc(
      missingOrder
        ? `Bolsa ${missingOrder.bagCode} (${missingOrder.folio}) reportada en app pero no encontrada en recolección física.`
        : '',
    );
    setActiveTab('incidents');
  };

  const handleAfterPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setEditAfterPhoto(compressed);
      onPushAlert({
        title: 'Foto del resultado lista',
        message: 'Pulsa "Actualizar estado" para guardar la foto del después en el pedido.',
        tone: 'info',
      });
    } catch (err) {
      onPushAlert({
        title: 'Error de imagen',
        message: err instanceof Error ? err.message : 'No se pudo procesar la foto.',
        tone: 'error',
      });
    }
    e.target.value = '';
  };

  const handleDeliverAfterPhotoFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setDeliverAfterPhoto(compressed);
    } catch (err) {
      onPushAlert({
        title: 'Error de imagen',
        message: err instanceof Error ? err.message : 'No se pudo procesar la foto.',
        tone: 'error',
      });
    }
    e.target.value = '';
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;
    const parsedTotal = Number(editTotalAmount);
    if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
      onPushAlert({
        title: 'Costo inválido',
        message: 'Ingresa un costo de servicio válido ($0 o mayor).',
        tone: 'warning',
      });
      return;
    }
    try {
      const res = await api.updateAdminOrder(selectedOrder.id, {
        folio: editFolio.trim().toUpperCase(),
        totalAmount: Math.round(parsedTotal),
        status: editStatus,
        paymentStatus: editPayment,
        bagCode: editBagCode.trim().toUpperCase(),
        note: editStatusNote.trim() || undefined,
        adminNotes: editAdminNotes,
        afterPhotoDataUrl:
          editAfterPhoto === null ? null : editAfterPhoto || undefined,
      });
      setEditStatusNote('');
      onPushAlert({
        title: `Pedido ${res.order.folio} actualizado`,
        message: `Estatus: "${res.order.status}" · Costo: $${res.order.totalAmount} MXN · Pago: ${res.order.paymentStatus}.`,
        tone: 'success',
        whatsappUrl: res.whatsappUrl,
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error al actualizar pedido',
        message:
          err instanceof Error ? err.message : 'Error al actualizar el pedido.',
        tone: 'error',
      });
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    setCancellingOrder(true);
    try {
      const res = await api.cancelAdminOrder(
        selectedOrder.id,
        cancelReason.trim(),
      );
      setCancelMode(false);
      setCancelReason('');
      onPushAlert({
        title: `Pedido ${selectedOrder.folio} cancelado`,
        message:
          'El pedido fue cancelado y cualquier locker asignado se liberó automáticamente.',
        tone: 'warning',
        whatsappUrl: res.whatsappUrl,
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'No se pudo cancelar',
        message:
          err instanceof Error ? err.message : 'Error al cancelar el pedido.',
        tone: 'error',
      });
    } finally {
      setCancellingOrder(false);
    }
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseOrderQrPayload(deliverFolio);
    const code = (parsed.folio || parsed.bagCode || deliverFolio.trim()).toUpperCase();
    if (!code) {
      onPushAlert({
        title: 'Folio requerido',
        message: 'Ingresa o escanea el folio de confirmación.',
        tone: 'warning',
      });
      return;
    }
    try {
      const res = await api.confirmDelivery({
        folio: code,
        deliveryMethod: deliverMethod,
        markPaid: deliverMarkPaid,
        afterPhotoDataUrl: deliverAfterPhoto,
      });
      setDeliverFolio('');
      setDeliverAfterPhoto(undefined);
      onPushAlert({
        title: `Entrega cerrada · ${res.order.folio}`,
        message: `El pedido ${res.order.folio} fue marcado como Entregado y el cliente fue notificado.`,
        tone: 'success',
        whatsappUrl: res.whatsappUrl,
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error al confirmar entrega',
        message:
          err instanceof Error ? err.message : 'Error al confirmar entrega.',
        tone: 'error',
      });
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createIncident({
        type: incType,
        bagCode: incBagCode,
        folio: incFolio || undefined,
        campusId: incCampusId || undefined,
        description: incDesc || undefined,
      });
      setIncBagCode('');
      setIncFolio('');
      setIncDesc('');
      onPushAlert({
        title: 'Incidencia registrada',
        message: `Se registró "${incType}" en la bandeja de resolución.`,
        tone: 'warning',
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error en incidencia',
        message:
          err instanceof Error ? err.message : 'No se pudo registrar la incidencia.',
        tone: 'error',
      });
    }
  };

  const handleResolveIncident = async (
    id: string,
    status: IncidentStatus,
    resolutionNote?: string,
  ) => {
    try {
      await api.updateIncident(id, {status, resolutionNote});
      onPushAlert({
        title: `Incidencia ${status}`,
        message: 'El seguimiento de la incidencia fue actualizado.',
        tone: 'success',
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error',
        message:
          err instanceof Error ? err.message : 'Error actualizando incidencia.',
        tone: 'error',
      });
    }
  };

  const handleAddCampus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCampus({
        name: newCampusName,
        address: newCampusAddress,
        type: newCampusType,
      });
      setNewCampusName('');
      setNewCampusAddress('');
      onPushAlert({
        title: 'Sede creada',
        message: 'La nueva sede ya está disponible en la app.',
        tone: 'success',
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Error agregando sede.',
        tone: 'error',
      });
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createService({
        name: newServiceName,
        description: newServiceDesc,
        price: Number(newServicePrice),
        turnaroundHours: Number(newServiceHours),
      });
      setNewServiceName('');
      setNewServiceDesc('');
      onPushAlert({
        title: 'Servicio agregado',
        message: 'El catálogo de servicios fue actualizado.',
        tone: 'success',
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Error agregando servicio.',
        tone: 'error',
      });
    }
  };

  const handleAddLocker = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createLocker({code: newLockerCode, campusId: newLockerCampus});
      setNewLockerCode('');
      onPushAlert({
        title: 'Locker registrado',
        message: 'El locker está listo para asignaciones autoservicio.',
        tone: 'success',
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Error agregando locker.',
        tone: 'error',
      });
    }
  };

  const handleSaveCampusEdit = async (id: string) => {
    try {
      await api.updateCampus(id, {
        name: editCampusName.trim(),
        address: editCampusAddress.trim(),
        type: editCampusType,
      });
      setEditingCampusId(null);
      onPushAlert({
        title: 'Sede actualizada',
        message: 'Los cambios de la sede se guardaron correctamente.',
        tone: 'success',
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Error editando sede.',
        tone: 'error',
      });
    }
  };

  const handleSaveServiceEdit = async (id: string) => {
    try {
      await api.updateService(id, {
        name: editServiceName.trim(),
        description: editServiceDesc.trim(),
        price: Number(editServicePrice),
        turnaroundHours: Number(editServiceHours),
      });
      setEditingServiceId(null);
      onPushAlert({
        title: 'Servicio actualizado',
        message: 'Precio y detalles del servicio guardados correctamente.',
        tone: 'success',
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Error editando servicio.',
        tone: 'error',
      });
    }
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCoupon({
        code: newCouponCode.trim().toUpperCase(),
        description: newCouponDesc.trim(),
        discountType: newCouponType,
        value: Number(newCouponValue),
      });
      setNewCouponCode('');
      setNewCouponDesc('');
      onPushAlert({
        title: 'Cupón creado',
        message: 'El código promocional ya está activo para clientes y mostrador.',
        tone: 'success',
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error creando cupón',
        message: err instanceof Error ? err.message : 'No se pudo crear el cupón.',
        tone: 'error',
      });
    }
  };

  const handleDeleteCoupon = async (id: string, code: string) => {
    try {
      await api.deleteCoupon(id);
      onPushAlert({
        title: `Cupón ${code} eliminado`,
        message: 'El código promocional fue dado de baja.',
        tone: 'info',
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Error eliminando cupón.',
        tone: 'error',
      });
    }
  };

  const handleSaveShipping = async () => {
    try {
      await api.updateSettings({shippingFee: Number(shippingFeeInput)});
      onPushAlert({
        title: 'Tarifa guardada',
        message: 'El costo de envío a domicilio fue actualizado.',
        tone: 'success',
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Error guardando tarifa.',
        tone: 'error',
      });
    }
  };

  const handleSaveSequences = async () => {
    const nextOrderSeq = Math.floor(Number(nextOrderSeqInput));
    const nextBagSeq = Math.floor(Number(nextBagSeqInput));
    if (!Number.isFinite(nextOrderSeq) || nextOrderSeq < 1 || !Number.isFinite(nextBagSeq) || nextBagSeq < 1) {
      onPushAlert({
        title: 'Numeración inválida',
        message: 'Ingresa números enteros mayores a 0 para folio y bolsa.',
        tone: 'warning',
      });
      return;
    }
    try {
      await api.updateSettings({nextOrderSeq, nextBagSeq});
      onPushAlert({
        title: 'Numeración actualizada',
        message: `El próximo pedido usará el folio KXR-${nextOrderSeq} y bolsa B-${String(nextBagSeq).padStart(3, '0')}.`,
        tone: 'success',
      });
      fetchOverview();
    } catch (err) {
      onPushAlert({
        title: 'Error',
        message: err instanceof Error ? err.message : 'No se pudo guardar la numeración.',
        tone: 'error',
      });
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? {...n, read: true} : n)),
    );
    await api.markNotificationRead(id).catch(() => {});
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({...n, read: true})));
    await api.markAllNotificationsRead().catch(() => {});
    onPushAlert({
      title: 'Notificaciones leídas',
      message: 'Todas las alertas del panel se marcaron como leídas.',
      tone: 'info',
    });
  };

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const navItems: NavModuleItem[] = [
    {id: 'home', label: 'Inicio', icon: Home},
    {
      id: 'collections',
      label: 'Recolecciones',
      shortLabel: 'Recolec.',
      icon: Package,
      badgeCount: metrics?.pendingCollections || 0,
    },
    {
      id: 'orders',
      label: 'Pedidos',
      icon: ShoppingBag,
      badgeCount: (metrics?.inCleaning || 0) + (metrics?.readyForDelivery || 0),
    },
    {
      id: 'services',
      label: 'Servicios y Precios',
      shortLabel: 'Servicios',
      icon: Sparkles,
      hideOnMobileBar: true, // Accessible via Inicio quick button & Desktop Sidebar
    },
    {
      id: 'mercadopago',
      label: 'Mercado Pago',
      shortLabel: 'M. Pago',
      icon: Wallet,
      hideOnMobileBar: true, // Accessible via Inicio quick button & Desktop Sidebar
    },
    {
      id: 'reports',
      label: 'Reportes / Caja',
      shortLabel: 'Reportes',
      icon: BarChart3,
      hideOnMobileBar: true, // Accessible via Inicio quick button & Desktop Sidebar
    },
    {
      id: 'incidents',
      label: 'Incidencias',
      shortLabel: 'Incidenc.',
      icon: AlertTriangle,
      badgeCount: metrics?.openIncidents || 0,
    },
    {
      id: 'users',
      label: 'Usuarios',
      shortLabel: 'Usuarios',
      icon: Users,
    },
    {
      id: 'notifications',
      label: 'Notificaciones',
      shortLabel: 'Alertas',
      icon: Bell,
      badgeCount: unreadNotifications,
      hideOnMobileBar: true, // Accessible via Header Bell Icon on mobile
    },
    {id: 'config', label: 'Configuración', shortLabel: 'Config.', icon: Settings},
  ];

  const visibleIncidents =
    incFilter === 'all'
      ? incidents
      : incidents.filter((i) => i.status === incFilter);

  return (
    <AppShell
      roleLabel="Administrador"
      userName={user.name}
      navItems={navItems}
      activeNav={activeTab}
      onSelectNav={(id) => setActiveTab(id as AdminTab)}
      onOpenNotifications={() => setActiveTab('notifications')}
      onLogout={onLogout}
      notifications={notifications}
      quickAction={{
        label: 'Escanear QR',
        shortLabel: 'QR',
        icon: QrCode,
        onClick: () => setScannerTarget('quick'),
      }}
      switchRoleAction={{
        label: 'Vista Cliente',
        shortLabel: 'Cliente',
        onSwitch: onSwitchToClient,
      }}
    >
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          {/* MODULE 0: INICIO */}
          {activeTab === 'home' && metrics && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl font-extrabold text-[#1A1E2A]">
                    Panel Operativo Homeli
                  </h1>
                  <p className="text-sm text-slate-600">
                    Resumen en tiempo real de recolecciones, taller, entregas, caja e incidencias
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScannerTarget('quick')}
                    className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[#1A1E2A] px-4 text-xs sm:text-sm font-bold text-[#FCF61C] hover:bg-[#11141D] transition-colors cursor-pointer"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>Escanear QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('services')}
                    className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-bold text-[#1A1E2A] hover:border-[#8BAF03] hover:text-[#5E7800] transition-colors cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4 text-[#5E7800]" />
                    <span>Servicios y precios</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('mercadopago')}
                    className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-bold text-[#1A1E2A] hover:border-[#8BAF03] hover:text-[#5E7800] transition-colors cursor-pointer"
                  >
                    <Wallet className="h-4 w-4 text-[#5E7800]" />
                    <span>Mercado Pago</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-bold text-[#1A1E2A] hover:border-[#8BAF03] hover:text-[#5E7800] transition-colors cursor-pointer"
                  >
                    <BarChart3 className="h-4 w-4 text-[#5E7800]" />
                    <span>Corte de caja</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalkInModalOpen(true)}
                    className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[#8BAF03] px-4 text-xs sm:text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] transition-colors cursor-pointer"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>+ Pedido mostrador</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('collections')}
                  className="rounded-2xl bg-white border border-slate-200 p-5 text-left hover:border-[#8BAF03] transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-slate-500">
                    Recolecciones pendientes
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-[#1A1E2A] tabular-nums">
                    {metrics.pendingCollections}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[#5E7800]">
                    Abrir lote de bolsas →
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="rounded-2xl bg-white border border-slate-200 p-5 text-left hover:border-[#8BAF03] transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-slate-500">
                    En limpieza / Listos
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-[#5E7800] tabular-nums">
                    {metrics.inCleaning + metrics.readyForDelivery}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {metrics.inCleaning} limpieza · {metrics.readyForDelivery} listos
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('incidents')}
                  className="rounded-2xl bg-white border border-slate-200 p-5 text-left hover:border-[#8BAF03] transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-slate-500">
                    Incidencias activas
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-[#1A1E2A] tabular-nums">
                    {metrics.openIncidents}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {metrics.ratedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {metrics.avgRating} ({metrics.ratedCount} reseñas)
                      </span>
                    ) : (
                      'Faltantes, sin pedido o duplicados'
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className="rounded-2xl bg-[#1A1E2A] text-white p-5 text-left hover:bg-[#11141D] transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-white/70">
                    Ingresos cobrados
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-[#FCF61C] tabular-nums">
                    ${metrics.revenuePaid}
                  </div>
                  <div className="mt-1 text-[11px] text-white/75 tabular-nums">
                    Efectivo ${metrics.cashPaid} · Tarjeta ${metrics.cardPaid}
                    {(metrics.mercadoPagoPaid || 0) > 0
                      ? ` · M. Pago $${metrics.mercadoPagoPaid}`
                      : ''}{' '}
                    · Pend. ${metrics.revenuePending}
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-base font-bold text-[#1A1E2A]">
                      Pedidos recientes
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="text-xs font-bold text-[#5E7800] hover:underline cursor-pointer"
                    >
                      Ver todos
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs text-slate-500">
                          <th className="py-2.5 pr-3 font-semibold">Foto</th>
                          <th className="py-2.5 pr-3 font-semibold">Folio / Bolsa</th>
                          <th className="py-2.5 pr-3 font-semibold">Cliente / Servicio</th>
                          <th className="py-2.5 pr-3 font-semibold">Estatus</th>
                          <th className="py-2.5 text-right font-semibold">Total / Ver</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.slice(0, 6).map((o) => {
                          const hasPhoto = isSafePhotoDataUrl(o.photoDataUrl);
                          return (
                            <tr
                              key={o.id}
                              onClick={() => setDetailOrderModal(o)}
                              className="hover:bg-slate-50 cursor-pointer"
                            >
                              <td className="py-2.5 pr-3">
                                {hasPhoto ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPhotoLightbox(o);
                                    }}
                                    title="Ver fotografía de tenis"
                                    className="group relative h-11 w-11 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 block shrink-0 cursor-pointer"
                                  >
                                    <img
                                      src={o.photoDataUrl}
                                      alt={`Tenis ${o.folio}`}
                                      className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                                    />
                                  </button>
                                ) : (
                                  <div
                                    title="Sin foto adjunta"
                                    className="h-11 w-11 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 shrink-0"
                                  >
                                    <ImageOff className="h-4 w-4" />
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 pr-3">
                                <div className="font-mono font-bold text-[#1A1E2A]">
                                  {o.folio}
                                </div>
                                <div className="font-mono text-xs font-semibold text-[#1A1E2A]">
                                  {o.bagCode}
                                </div>
                              </td>
                              <td className="py-2.5 pr-3 max-w-[175px]">
                                <div className="font-semibold text-[#1A1E2A] truncate">
                                  {o.clientName}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  {o.serviceName} · {o.pairs}{' '}
                                  {o.pairs === 1 ? 'par' : 'pares'}
                                </div>
                              </td>
                              <td className="py-2.5 pr-3 text-xs font-semibold text-[#5E7800]">
                                {o.status}
                              </td>
                              <td className="py-2.5 text-right">
                                <div className="font-mono font-bold tabular-nums text-[#1A1E2A]">
                                  ${o.totalAmount}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailOrderModal(o);
                                  }}
                                  className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#5E7800] hover:underline cursor-pointer"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>Detalle</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-base font-bold text-[#1A1E2A]">
                      Alertas recientes
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('notifications')}
                      className="text-xs font-bold text-[#5E7800] hover:underline cursor-pointer"
                    >
                      Ver módulo
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Cuando cambies el estado de un pedido aparecerán aquí las alertas.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {notifications.slice(0, 6).map((n) => (
                        <div
                          key={n.id}
                          className="rounded-xl bg-slate-50 p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#1A1E2A]">{n.title}</span>
                            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                              {new Date(n.createdAt).toLocaleTimeString('es-MX', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-slate-600">{n.message}</p>
                          {n.whatsappUrl && (
                            <a
                              href={n.whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-bold text-[#5E7800] hover:underline"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span>Abrir en WhatsApp</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODULE 1 & 2: RECOLECCIONES + VERIFICAR BOLSAS */}
          {activeTab === 'collections' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <section className="xl:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-3 rounded-xl bg-[#8BAF03] px-4 py-3 text-[#1A1E2A]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-display text-base font-extrabold text-[#5E7800] shrink-0">
                    1
                  </span>
                  <h2 className="font-display text-lg font-extrabold">
                    1. Recolecciones
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1A1E2A] mb-1">
                      Sede / Punto
                    </label>
                    <select
                      value={filterCampus}
                      onChange={(e) => setFilterCampus(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#1A1E2A]"
                    >
                      <option value="all">Todas las sedes</option>
                      {config?.campuses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1A1E2A] mb-1">
                      Fecha
                    </label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-[#1A1E2A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1A1E2A] mb-1">
                      Estado
                    </label>
                    <select
                      value={filterCollectionState}
                      onChange={(e) =>
                        setFilterCollectionState(
                          e.target.value as 'all' | 'Pendiente' | 'Recolectado',
                        )
                      }
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#1A1E2A]"
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Recolectado">Recolectado</option>
                      <option value="all">Todos</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-[#1A1E2A]">
                        <th className="py-2.5 px-3 rounded-l-lg">Foto</th>
                        <th className="py-2.5 px-3">Bolsa / Folio</th>
                        <th className="py-2.5 px-3">Cliente y servicio</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3 text-right rounded-r-lg">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {collectionBatch.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-8 text-center text-sm text-slate-500"
                          >
                            No hay bolsas que coincidan con estos filtros.
                          </td>
                        </tr>
                      ) : (
                        collectionBatch.map((item) => {
                          const hasPhoto = isSafePhotoDataUrl(item.photoDataUrl);
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-3">
                                {hasPhoto ? (
                                  <button
                                    type="button"
                                    onClick={() => openPhotoLightbox(item)}
                                    title="Ampliar fotografía de los tenis"
                                    className="group relative h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 block shrink-0 cursor-pointer"
                                  >
                                    <img
                                      src={item.photoDataUrl}
                                      alt={`Tenis ${item.folio}`}
                                      className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                                    />
                                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center transition-colors">
                                      <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </span>
                                  </button>
                                ) : (
                                  <div
                                    title="Sin fotografía adjunta"
                                    className="h-12 w-12 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 shrink-0"
                                  >
                                    <ImageOff className="h-4 w-4" />
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5 font-mono font-bold text-[#1A1E2A]">
                                  <ShoppingBag className="h-4 w-4 text-[#1A1E2A] shrink-0" />
                                  <span>{item.bagCode}</span>
                                </div>
                                <div className="font-mono text-xs font-semibold text-slate-500">
                                  {item.folio}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-xs text-[#1A1E2A]">
                                  {item.clientName}
                                </div>
                                <div className="text-xs text-slate-600">
                                  {item.serviceName} · {item.pairs}{' '}
                                  {item.pairs === 1 ? 'par' : 'pares'} ·{' '}
                                  <span className="font-mono font-bold text-[#5E7800]">
                                    ${item.totalAmount}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {item.campusName}
                                  {item.assignedLockerCode && (
                                    <span className="ml-1 font-mono font-semibold text-[#1A1E2A]">
                                      ({item.assignedLockerCode})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold ${
                                    item.collectionStatus === 'Recolectado'
                                      ? 'bg-[#F3F8DE] text-[#8BAF03]'
                                      : 'bg-[#FCF61C] text-[#1A1E2A]'
                                  }`}
                                >
                                  {item.collectionStatus}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setDetailOrderModal(item)}
                                    title="Ver detalle completo y foto de tenis"
                                    className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-[#1A1E2A] hover:border-[#8BAF03] hover:text-[#5E7800] transition-colors whitespace-nowrap cursor-pointer"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Detalle</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBagScanInput(item.bagCode);
                                      setCheckedBags((prev) => ({
                                        ...prev,
                                        [item.bagCode]: true,
                                      }));
                                    }}
                                    className="min-h-[38px] rounded-xl bg-[#8BAF03] px-3 text-xs font-bold text-[#1A1E2A] hover:bg-[#749402] transition-colors whitespace-nowrap cursor-pointer"
                                  >
                                    Abrir recolección
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="xl:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-3 rounded-xl bg-[#8BAF03] px-4 py-3 text-[#1A1E2A]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-display text-base font-extrabold text-[#5E7800] shrink-0">
                    2
                  </span>
                  <h2 className="font-display text-lg font-extrabold">
                    2. Verificar bolsas
                  </h2>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1A1E2A] mb-1.5">
                    Código de bolsa
                  </label>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleScanOrAddBag(bagScanInput);
                    }}
                    className="flex gap-2"
                  >
                    <div className="relative flex-1">
                      <ShoppingBag className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={bagScanInput}
                        onChange={(e) => setBagScanInput(e.target.value)}
                        placeholder="B-028"
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-mono uppercase text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setScannerTarget('bag')}
                      className="min-h-[44px] px-3.5 rounded-xl border border-[#8BAF03]/30 bg-[#FCF61C]/25 text-[#1A1E2A] hover:bg-[#1A1E2A] hover:text-[#FCF61C] transition-colors cursor-pointer"
                      title="Escanear código de bolsa"
                    >
                      <QrCode className="h-5 w-5" />
                    </button>
                    <button
                      type="submit"
                      className="min-h-[44px] px-4 rounded-xl bg-[#1A1E2A] text-xs font-bold text-white hover:bg-[#1A1E2A] whitespace-nowrap cursor-pointer"
                    >
                      Verificar
                    </button>
                  </form>
                </div>

                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {pendingVerificationOrders.length === 0 ? (
                    <div className="p-5 text-center text-sm text-slate-500">
                      Todas las bolsas filtradas ya fueron verificadas en taller.
                    </div>
                  ) : (
                    pendingVerificationOrders.map((item) => {
                      const isChecked = Boolean(checkedBags[item.bagCode]);
                      const hasPhoto = isSafePhotoDataUrl(item.photoDataUrl);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2.5 p-3.5 hover:bg-slate-50"
                        >
                          <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                setCheckedBags((prev) => ({
                                  ...prev,
                                  [item.bagCode]: e.target.checked,
                                }))
                              }
                              className="h-5 w-5 rounded accent-[#8BAF03] cursor-pointer shrink-0"
                            />
                            {hasPhoto ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openPhotoLightbox(item);
                                }}
                                title="Ver foto de tenis"
                                className="h-10 w-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-pointer"
                              >
                                <img
                                  src={item.photoDataUrl}
                                  alt={`Tenis ${item.folio}`}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ) : (
                              <ShoppingBag className="h-5 w-5 text-[#1A1E2A] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="font-mono text-sm font-bold text-[#1A1E2A]">
                                {item.bagCode}
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {item.folio} · {item.clientName} · {item.serviceName}
                              </div>
                            </div>
                          </label>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setDetailOrderModal(item)}
                              title="Ver detalles del pedido"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-[#8BAF03] hover:text-[#5E7800] transition-colors cursor-pointer"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <span
                              className={`rounded-lg px-2.5 py-1 text-xs font-bold whitespace-nowrap ${
                                isChecked
                                  ? 'bg-[#F3F8DE] text-[#8BAF03]'
                                  : 'bg-[#FCF61C] text-[#1A1E2A]'
                              }`}
                            >
                              {isChecked ? 'Verificada' : 'Faltante'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleConfirmReception}
                    className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#8BAF03] px-4 text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] transition-colors cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>Confirmar recepción</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenIncidentFromCollection}
                    className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#8BAF03] bg-white px-4 text-sm font-bold text-[#1A1E2A] hover:bg-[#FCF61C]/25 transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span>Registrar incidencia</span>
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* MODULE 3 & 4: GESTIONAR PEDIDO + CONFIRMAR DEVOLUCIÓN */}
          {activeTab === 'orders' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-4 rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setWalkInModalOpen(true)}
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#1A1E2A] px-4 text-xs font-bold text-white hover:bg-[#11141D] transition-colors cursor-pointer"
                >
                  <UserPlus className="h-4 w-4 text-[#5E7800]" />
                  <span>+ Crear pedido rápido en mostrador</span>
                </button>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Buscar folio, bolsa, cliente o servicio..."
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setOrderPhotoFilter('all')}
                    className={`min-h-[34px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      orderPhotoFilter === 'all'
                        ? 'bg-white text-[#1A1E2A] shadow-xs'
                        : 'text-slate-600 hover:text-[#1A1E2A]'
                    }`}
                  >
                    Todos ({orders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderPhotoFilter('with_photo')}
                    className={`min-h-[34px] inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      orderPhotoFilter === 'with_photo'
                        ? 'bg-white text-[#8BAF03] shadow-xs'
                        : 'text-slate-600 hover:text-[#1A1E2A]'
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Con foto ({ordersWithPhotoCount})</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                  {filteredOrders.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-500">
                      No hay pedidos que coincidan con la búsqueda.
                    </div>
                  ) : (
                    filteredOrders.map((o) => {
                      const active = selectedOrder?.id === o.id;
                      const hasPhoto = isSafePhotoDataUrl(o.photoDataUrl);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setSelectedOrderId(o.id)}
                          className={`w-full rounded-xl border p-3 text-left transition-colors cursor-pointer flex items-center gap-3 ${
                            active
                              ? 'border-[#8BAF03] bg-[#F3F8DE]'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          {hasPhoto ? (
                            <img
                              src={o.photoDataUrl}
                              alt={`Tenis ${o.folio}`}
                              className="h-12 w-12 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 shrink-0">
                              <ImageOff className="h-4 w-4" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-sm font-extrabold text-[#1A1E2A]">
                                {o.folio}
                              </span>
                              <span className="font-mono text-xs font-bold text-[#1A1E2A]">
                                {o.bagCode}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs font-semibold text-slate-700 truncate">
                              {o.clientName} · {o.serviceName}
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-bold text-[#5E7800] truncate">
                                {o.status}
                              </span>
                              <span className="font-mono font-bold text-slate-600 tabular-nums shrink-0">
                                {o.pairs}p · ${o.totalAmount}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="xl:col-span-8 space-y-6">
                <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#8BAF03] px-4 py-3 text-[#1A1E2A]">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-display text-base font-extrabold text-[#5E7800] shrink-0">
                        3
                      </span>
                      <h2 className="font-display text-lg font-extrabold">
                        3. Gestionar pedido y detalles del servicio
                      </h2>
                    </div>
                    {selectedOrder && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReceiptOrder(selectedOrder)}
                          className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 text-xs font-bold text-white transition-colors cursor-pointer"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          <span>Ticket</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailOrderModal(selectedOrder)}
                          className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 text-xs font-bold text-white transition-colors cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Ficha completa y QR</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedOrder ? (
                    <div className="space-y-5">
                      <input
                        ref={afterPhotoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAfterPhotoFile}
                        className="sr-only"
                      />

                      <div className="grid grid-cols-1 lg:grid-cols-3 rounded-2xl border border-slate-200 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                        {/* Folio editable por el Admin */}
                        <div className="p-4 flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F3F8DE] text-[#1A1E2A] shrink-0">
                            <ShoppingBag className="h-6 w-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-slate-500">
                                Folio (editable)
                              </span>
                              {selectedOrder.status === 'Cancelado' && (
                                <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                  Cancelado
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={editFolio}
                              onChange={(e) => setEditFolio(e.target.value.toUpperCase())}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1 font-mono text-lg font-extrabold uppercase text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                            />
                            <div className="mt-0.5 text-[10px] text-slate-400">
                              Registrado{' '}
                              {new Date(selectedOrder.createdAt).toLocaleDateString('es-MX')}
                            </div>
                          </div>
                        </div>

                        {/* Bolsa editable */}
                        <div className="p-4 flex flex-col justify-center">
                          <div className="text-[11px] font-semibold text-slate-500">
                            Bolsa (vincular o editar etiqueta)
                          </div>
                          <input
                            type="text"
                            value={editBagCode}
                            onChange={(e) => setEditBagCode(e.target.value.toUpperCase())}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1 font-mono text-lg font-extrabold uppercase text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                          />
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {selectedOrder.pairs}{' '}
                            {selectedOrder.pairs === 1 ? 'par' : 'pares'} ·{' '}
                            {selectedOrder.serviceName}
                          </div>
                        </div>

                        {/* Costo del servicio estipulado por el Admin */}
                        <div className="p-4 flex flex-col justify-center bg-[#F3F8DE]/35">
                          <div className="text-[11px] font-bold text-[#1A1E2A]">
                            Costo del servicio ($ MXN)
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="font-mono text-lg font-extrabold text-[#5E7800]">
                              $
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={editTotalAmount}
                              onChange={(e) => setEditTotalAmount(e.target.value)}
                              className="w-full rounded-lg border border-[#8BAF03]/35 bg-white px-2.5 py-1 font-mono text-lg font-extrabold text-[#5E7800] tabular-nums focus:border-[#8BAF03] focus:outline-none"
                            />
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            Estipula o ajusta el precio total y guarda abajo
                          </div>
                        </div>
                      </div>

                      {/* Evidencia fotográfica Antes y Después + Detalles completos del pedido y servicio */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                        {/* Photo Evidence Card: Antes + Después */}
                        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#1A1E2A]">
                              <Camera className="h-4 w-4 text-[#5E7800]" />
                              <span>Evidencia: Antes y Después</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 flex-1">
                            {/* ANTES */}
                            <div className="flex flex-col gap-1.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Antes (Cliente)
                              </div>
                              {isSafePhotoDataUrl(selectedOrder.photoDataUrl) ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openPhotoLightbox(selectedOrder)}
                                    className="group relative h-36 w-full overflow-hidden rounded-xl border border-slate-200 bg-white flex items-center justify-center cursor-pointer"
                                  >
                                    <img
                                      src={selectedOrder.photoDataUrl}
                                      alt={`Antes ${selectedOrder.folio}`}
                                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                    <span className="absolute bottom-1.5 right-1.5 rounded-md bg-[#1A1E2A]/80 p-1 text-white">
                                      <ZoomIn className="h-3 w-3" />
                                    </span>
                                  </button>
                                  <a
                                    href={selectedOrder.photoDataUrl}
                                    download={`${selectedOrder.folio}-antes.jpg`}
                                    className="min-h-[30px] inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-bold text-[#1A1E2A] hover:bg-slate-50"
                                  >
                                    <Download className="h-3 w-3 text-[#5E7800]" />
                                    <span>Bajar</span>
                                  </a>
                                </>
                              ) : (
                                <div className="h-36 rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-[11px] text-slate-400 p-2 text-center">
                                  <ImageOff className="h-5 w-5 text-slate-300 mb-1" />
                                  <span>Sin foto inicial</span>
                                </div>
                              )}
                            </div>

                            {/* DESPUÉS */}
                            <div className="flex flex-col gap-1.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-[#5E7800] flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                <span>Después (Taller)</span>
                              </div>
                              {isSafePhotoDataUrl(editAfterPhoto) ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLightboxZoomed(false);
                                      setLightboxPhoto({
                                        url: editAfterPhoto,
                                        title: `Resultado final (Después) · ${selectedOrder.folio}`,
                                        subtitle: `${selectedOrder.clientName} · ${selectedOrder.serviceName}`,
                                        filename: `${selectedOrder.folio}-despues.jpg`,
                                      });
                                    }}
                                    className="group relative h-36 w-full overflow-hidden rounded-xl border border-[#8BAF03]/30 bg-white flex items-center justify-center cursor-pointer"
                                  >
                                    <img
                                      src={editAfterPhoto}
                                      alt={`Después ${selectedOrder.folio}`}
                                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                    <span className="absolute bottom-1.5 right-1.5 rounded-md bg-[#8BAF03] p-1 text-[#1A1E2A]">
                                      <ZoomIn className="h-3 w-3" />
                                    </span>
                                  </button>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => afterPhotoInputRef.current?.click()}
                                      className="flex-1 min-h-[30px] inline-flex items-center justify-center gap-1 rounded-lg border border-[#8BAF03]/30 bg-[#F3F8DE] px-2 text-[11px] font-bold text-[#5E7800] cursor-pointer"
                                    >
                                      <Camera className="h-3 w-3" />
                                      <span>Cambiar</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditAfterPhoto(null)}
                                      title="Quitar foto del después"
                                      className="min-h-[30px] px-2 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => afterPhotoInputRef.current?.click()}
                                  className="h-36 rounded-xl border-2 border-dashed border-[#8BAF03]/35 bg-[#F3F8DE]/40 hover:bg-[#F3F8DE] flex flex-col items-center justify-center text-[11px] font-bold text-[#5E7800] p-2 text-center transition-colors cursor-pointer"
                                >
                                  <Camera className="h-5 w-5 mb-1" />
                                  <span>Subir foto del Después</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Full Order & Service Breakdown Card */}
                        <div className="lg:col-span-7 rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-sm">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-[#1A1E2A]">
                              Detalles del pedido y servicio
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                selectedOrder.bagVerified
                                  ? 'bg-[#F3F8DE] text-[#8BAF03]'
                                  : 'bg-[#FCF61C] text-[#1A1E2A]'
                              }`}
                            >
                              {selectedOrder.bagVerified
                                ? 'Bolsa verificada'
                                : `Recolección: ${selectedOrder.collectionStatus}`}
                            </span>
                          </div>

                          <div className="space-y-2 text-xs sm:text-sm">
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Cliente</span>
                              <span className="font-bold text-[#1A1E2A] text-right">
                                {selectedOrder.clientName}
                                {selectedOrder.clientAge
                                  ? ` · ${selectedOrder.clientAge} años`
                                  : ''}
                              </span>
                            </div>
                            {selectedOrder.clientIdDocument && (
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500">INE / Pasaporte</span>
                                <span className="font-mono font-bold text-[#1A1E2A] text-right">
                                  {selectedOrder.clientIdDocument}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">WhatsApp</span>
                              <a
                                href={buildDirectWhatsappUrl(selectedOrder, editStatus)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-mono font-bold text-[#5E7800] hover:underline"
                              >
                                <span>{selectedOrder.clientWhatsapp || '—'}</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Servicio</span>
                              <span className="font-bold text-[#1A1E2A] text-right">
                                {selectedOrder.serviceName} ({selectedOrder.pairs}{' '}
                                {selectedOrder.pairs === 1 ? 'par' : 'pares'})
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Desglose</span>
                              <span className="font-mono font-semibold text-[#1A1E2A] tabular-nums text-right">
                                ${selectedOrder.unitPrice} × {selectedOrder.pairs}
                                {selectedOrder.shippingFee > 0
                                  ? ` + $${selectedOrder.shippingFee} envío`
                                  : ''}
                                {selectedOrder.discountAmount &&
                                selectedOrder.discountAmount > 0
                                  ? ` - $${selectedOrder.discountAmount} (${selectedOrder.discountCode || 'Cupón'})`
                                  : ''}{' '}
                                ={' '}
                                <strong className="text-[#5E7800]">
                                  ${selectedOrder.totalAmount} MXN
                                </strong>
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Pago</span>
                              <span className="font-semibold text-[#1A1E2A] text-right">
                                {formatPaymentMethodLabel(
                                  selectedOrder.paymentMethod,
                                  selectedOrder.cardLast4,
                                )}{' '}
                                ·{' '}
                                <strong
                                  className={
                                    selectedOrder.paymentStatus === 'Pagado'
                                      ? 'text-[#5E7800]'
                                      : 'text-[#1A1E2A]'
                                  }
                                >
                                  {selectedOrder.paymentStatus}
                                </strong>
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Sede / Depósito</span>
                              <span className="font-semibold text-[#1A1E2A] text-right">
                                {selectedOrder.campusName}
                                {selectedOrder.dropoffMethod === 'locker'
                                  ? ` · Locker ${selectedOrder.assignedLockerCode || ''}`
                                  : selectedOrder.dropoffMethod === 'staff'
                                    ? ' · Con personal'
                                    : ''}
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Devolución</span>
                              <span className="font-semibold text-[#1A1E2A] text-right">
                                {selectedOrder.deliveryMethod === 'delivery'
                                  ? 'Entrega a domicilio'
                                  : `Recoger en ${selectedOrder.campusName}`}
                              </span>
                            </div>
                            {(selectedOrder.deliveryAddress ||
                              selectedOrder.clientAddress ||
                              isSafeGoogleMapsUrl(selectedOrder.clientMapsUrl)) && (
                              <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs text-[#1A1E2A] space-y-1.5">
                                {(selectedOrder.deliveryAddress ||
                                  selectedOrder.clientAddress) && (
                                  <div className="flex items-start gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 text-[#5E7800] shrink-0 mt-0.5" />
                                    <span>
                                      <strong>Dirección:</strong>{' '}
                                      {selectedOrder.deliveryAddress ||
                                        selectedOrder.clientAddress}
                                    </span>
                                  </div>
                                )}
                                {isSafeGoogleMapsUrl(selectedOrder.clientMapsUrl) && (
                                  <a
                                    href={selectedOrder.clientMapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#F3F8DE] border border-[#8BAF03]/35 px-2.5 py-1 text-[11px] font-bold text-[#5E7800] hover:bg-[#8BAF03] hover:text-[#1A1E2A] transition-colors"
                                  >
                                    <MapPin className="h-3 w-3" />
                                    <span>Abrir ubicación en Google Maps</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            )}
                            {selectedOrder.shoeNotes && (
                              <div className="rounded-lg bg-[#FCF61C]/20 border border-[#8BAF03]/30 p-2.5 text-xs text-[#1A1E2A] flex items-start gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-[#1A1E2A] shrink-0 mt-0.5" />
                                <span>
                                  <strong className="text-[#1A1E2A]">
                                    Notas del cliente:
                                  </strong>{' '}
                                  {selectedOrder.shoeNotes}
                                </span>
                              </div>
                            )}
                            {selectedOrder.rating && (
                              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-[#1A1E2A] flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1 font-bold text-amber-800">
                                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                  <span>{selectedOrder.rating}/5</span>
                                  {selectedOrder.ratingComment && (
                                    <span className="font-normal text-slate-700 ml-1">
                                      — "{selectedOrder.ratingComment}"
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="flex flex-wrap justify-between gap-2 pt-1.5 border-t border-slate-200/80 text-[11px] text-slate-500">
                              <span>
                                Creado:{' '}
                                <strong className="font-mono text-[#1A1E2A]">
                                  {new Date(selectedOrder.createdAt).toLocaleString(
                                    'es-MX',
                                  )}
                                </strong>
                              </span>
                              <span>
                                Actualizado:{' '}
                                <strong className="font-mono text-[#1A1E2A]">
                                  {new Date(selectedOrder.updatedAt).toLocaleString(
                                    'es-MX',
                                  )}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-slate-200 p-4">
                          <label className="block text-xs font-bold text-slate-500 mb-2">
                            Estado del pedido
                          </label>
                          <select
                            value={
                              editStatus === 'Cancelado'
                                ? 'Depósito reportado'
                                : editStatus
                            }
                            disabled={selectedOrder.status === 'Cancelado'}
                            onChange={(e) =>
                              setEditStatus(e.target.value as OrderStatus)
                            }
                            className="w-full min-h-[44px] rounded-xl bg-[#F3F8DE] border border-[#8BAF03]/30 px-3 text-sm font-bold text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none disabled:opacity-60"
                          >
                            {ORDER_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-4">
                          <label className="block text-xs font-bold text-slate-500 mb-2">
                            Pago (
                            {formatPaymentMethodLabel(
                              selectedOrder.paymentMethod,
                              selectedOrder.cardLast4,
                            )}
                            )
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setEditPayment((p) =>
                                p === 'Pagado' ? 'Pago pendiente' : 'Pagado',
                              )
                            }
                            className={`w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors cursor-pointer ${
                              editPayment === 'Pagado'
                                ? 'bg-[#F3F8DE] text-[#8BAF03] border border-[#8BAF03]/30'
                                : 'bg-[#FCF61C] text-[#1A1E2A] border border-[#1A1E2A]/25'
                            }`}
                          >
                            {editPayment === 'Pagado' ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <CreditCard className="h-4 w-4" />
                            )}
                            <span>{editPayment}</span>
                          </button>
                        </div>
                      </div>

                      {/* Notas de actualización y notas internas de taller */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#1A1E2A] mb-1">
                            Nota del cambio (visible en historial del cliente)
                          </label>
                          <input
                            type="text"
                            value={editStatusNote}
                            onChange={(e) => setEditStatusNote(e.target.value)}
                            placeholder="Ej. Secado completado y sellado hidrofóbico aplicado"
                            className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#1A1E2A] mb-1">
                            Notas internas de taller (solo Admin)
                          </label>
                          <input
                            type="text"
                            value={editAdminNotes}
                            onChange={(e) => setEditAdminNotes(e.target.value)}
                            placeholder="Ej. Usar cepillo suave en gamuza, plantilla suelta..."
                            className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Primary Action Bar + WhatsApp + Cancelar */}
                      <div className="flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          onClick={handleUpdateOrder}
                          className="flex-1 min-w-[180px] min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#8BAF03] px-5 text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] transition-colors cursor-pointer"
                        >
                          <Pencil className="h-4 w-4" />
                          <span>Guardar actualización</span>
                        </button>

                        <a
                          href={buildDirectWhatsappUrl(selectedOrder, editStatus)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#1A1E2A] px-4 text-xs sm:text-sm font-bold text-white hover:bg-[#11141D] transition-colors"
                        >
                          <MessageSquare className="h-4 w-4 text-[#5E7800]" />
                          <span>Notificar por WhatsApp</span>
                          <ExternalLink className="h-3.5 w-3.5 opacity-75" />
                        </a>

                        {selectedOrder.status !== 'Entregado' &&
                          selectedOrder.status !== 'Cancelado' && (
                            <button
                              type="button"
                              onClick={() => setCancelMode((v) => !v)}
                              className="min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 text-xs sm:text-sm font-bold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                            >
                              <Ban className="h-4 w-4" />
                              <span>Cancelar</span>
                            </button>
                          )}
                      </div>

                      {cancelMode &&
                        selectedOrder.status !== 'Entregado' &&
                        selectedOrder.status !== 'Cancelado' && (
                          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                            <div className="text-xs font-extrabold text-red-800">
                              Confirmar cancelación de pedido {selectedOrder.folio}
                              {selectedOrder.assignedLockerCode
                                ? ` (se liberará el locker ${selectedOrder.assignedLockerCode})`
                                : ''}
                            </div>
                            <input
                              type="text"
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              placeholder="Motivo de cancelación (opcional)"
                              className="w-full min-h-[40px] rounded-lg border border-red-200 bg-white px-3 text-xs text-[#1A1E2A]"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setCancelMode(false)}
                                className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 cursor-pointer"
                              >
                                Volver
                              </button>
                              <button
                                type="button"
                                disabled={cancellingOrder}
                                onClick={handleCancelOrder}
                                className="min-h-[36px] rounded-lg bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60 cursor-pointer"
                              >
                                {cancellingOrder
                                  ? 'Cancelando...'
                                  : 'Confirmar cancelación'}
                              </button>
                            </div>
                          </div>
                        )}

                      {/* Inline Order Timeline */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-[#1A1E2A] mb-3">
                          Historial y seguimiento del servicio
                        </div>
                        <OrderTimeline
                          currentStatus={selectedOrder.status}
                          history={selectedOrder.history}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Selecciona un pedido de la lista para gestionarlo.
                    </p>
                  )}
                </section>

                <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5">
                  <div className="flex items-center gap-3 rounded-xl bg-[#8BAF03] px-4 py-3 text-[#1A1E2A]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-display text-base font-extrabold text-[#5E7800] shrink-0">
                      4
                    </span>
                    <h2 className="font-display text-lg font-extrabold">
                      4. Confirmar devolución
                    </h2>
                  </div>

                  <form onSubmit={handleConfirmDelivery} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setDeliverMethod('pickup')}
                        className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all cursor-pointer ${
                          deliverMethod === 'pickup'
                            ? 'border-[#8BAF03] bg-[#F3F8DE]'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                            deliverMethod === 'pickup'
                              ? 'border-[#8BAF03]'
                              : 'border-slate-300'
                          }`}
                        >
                          {deliverMethod === 'pickup' && (
                            <span className="h-2.5 w-2.5 rounded-full bg-[#8BAF03]" />
                          )}
                        </span>
                        <Store className="h-5 w-5 text-[#1A1E2A]" />
                        <span className="font-bold text-sm text-[#1A1E2A]">
                          Recogida en punto
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeliverMethod('delivery')}
                        className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all cursor-pointer ${
                          deliverMethod === 'delivery'
                            ? 'border-[#8BAF03] bg-[#F3F8DE]'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                            deliverMethod === 'delivery'
                              ? 'border-[#8BAF03]'
                              : 'border-slate-300'
                          }`}
                        >
                          {deliverMethod === 'delivery' && (
                            <span className="h-2.5 w-2.5 rounded-full bg-[#8BAF03]" />
                          )}
                        </span>
                        <Truck className="h-5 w-5 text-[#1A1E2A]" />
                        <span className="font-bold text-sm text-[#1A1E2A]">
                          Entrega a domicilio
                        </span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1A1E2A] mb-1.5">
                        Folio de confirmación
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={deliverFolio}
                          onChange={(e) => setDeliverFolio(e.target.value)}
                          placeholder="Ej. KXR-1042"
                          className="flex-1 min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 font-mono text-sm uppercase text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setScannerTarget('delivery')}
                          className="min-h-[46px] px-4 rounded-xl border border-[#8BAF03]/30 bg-[#FCF61C]/25 text-[#1A1E2A] hover:bg-[#1A1E2A] hover:text-[#FCF61C] transition-colors cursor-pointer"
                          title="Escanear QR de pedido"
                        >
                          <QrCode className="h-5 w-5" />
                        </button>
                      </div>

                      {readyToDeliverOrders.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-500">Selección rápida:</span>
                          {readyToDeliverOrders.slice(0, 4).map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => {
                                setDeliverFolio(o.folio);
                                setDeliverMethod(o.deliveryMethod);
                              }}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-bold text-[#1A1E2A] hover:border-[#8BAF03] cursor-pointer"
                            >
                              {o.folio}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <input
                        ref={deliverAfterPhotoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleDeliverAfterPhotoFile}
                        className="sr-only"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-[#8BAF03]/40 bg-[#F3F8DE]/40 p-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {deliverAfterPhoto ? (
                            <img
                              src={deliverAfterPhoto}
                              alt="Evidencia final"
                              className="h-12 w-12 rounded-lg object-cover border border-[#8BAF03]/30 shrink-0"
                            />
                          ) : (
                            <Camera className="h-5 w-5 text-[#5E7800] shrink-0" />
                          )}
                          <div className="text-xs">
                            <div className="font-bold text-[#1A1E2A]">
                              Foto del calzado limpio (opcional)
                            </div>
                            <div className="text-slate-500">
                              {deliverAfterPhoto
                                ? 'Evidencia del después lista para adjuntar al cierre'
                                : 'Adjunta el resultado final al marcar entregado'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => deliverAfterPhotoInputRef.current?.click()}
                            className="min-h-[34px] rounded-lg bg-white border border-[#8BAF03]/30 px-3 text-xs font-bold text-[#5E7800] hover:bg-[#F3F8DE] cursor-pointer"
                          >
                            {deliverAfterPhoto ? 'Cambiar' : 'Subir foto'}
                          </button>
                          {deliverAfterPhoto && (
                            <button
                              type="button"
                              onClick={() => setDeliverAfterPhoto(undefined)}
                              className="min-h-[34px] rounded-lg border border-red-200 bg-white px-2.5 text-red-600 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deliverMarkPaid}
                        onChange={(e) => setDeliverMarkPaid(e.target.checked)}
                        className="h-4 w-4 rounded accent-[#8BAF03]"
                      />
                      <span>Confirmar liquidación de pago (marcar como Pagado)</span>
                    </label>

                    <button
                      type="submit"
                      className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#8BAF03] px-6 text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] transition-colors cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      <span>Marcar como entregado</span>
                    </button>
                  </form>
                </section>
              </div>
            </div>
          )}

          {/* MODULE: REPORTES Y CORTE DE CAJA */}
          {activeTab === 'reports' && (
            <AdminReportsModule
              orders={orders}
              campuses={config?.campuses || []}
              onOpenOrderDetail={(o) => setDetailOrderModal(o)}
            />
          )}

          {/* MODULE 5: INCIDENCIAS */}
          {activeTab === 'incidents' && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-[#1A1E2A] px-5 py-4 text-[#FCF61C] flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 shrink-0" />
                <div>
                  <h1 className="font-display text-lg font-extrabold">
                    Incidencias: bolsa faltante, sin pedido o código duplicado
                  </h1>
                  <p className="text-xs text-white/80">
                    Registra excepciones operativas y gestiona su resolución con aviso automático al cliente.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <form
                  onSubmit={handleCreateIncident}
                  className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4"
                >
                  <h2 className="font-display text-base font-bold text-[#1A1E2A]">
                    Registrar nueva incidencia
                  </h2>

                  <div>
                    <label className="block text-xs font-bold text-[#1A1E2A] mb-1.5">
                      Tipo de incidencia
                    </label>
                    <select
                      value={incType}
                      onChange={(e) => setIncType(e.target.value as IncidentType)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-[#1A1E2A]"
                    >
                      {INCIDENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#1A1E2A] mb-1.5">
                        Código de bolsa
                      </label>
                      <input
                        type="text"
                        required
                        value={incBagCode}
                        onChange={(e) => setIncBagCode(e.target.value)}
                        placeholder="B-029"
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm uppercase text-[#1A1E2A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#1A1E2A] mb-1.5">
                        Folio (opcional)
                      </label>
                      <input
                        type="text"
                        value={incFolio}
                        onChange={(e) => setIncFolio(e.target.value)}
                        placeholder="KXR-1043"
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm uppercase text-[#1A1E2A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1A1E2A] mb-1.5">
                      Sede / Punto
                    </label>
                    <select
                      value={incCampusId}
                      onChange={(e) => setIncCampusId(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#1A1E2A]"
                    >
                      {config?.campuses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1A1E2A] mb-1.5">
                      Descripción operativa
                    </label>
                    <textarea
                      rows={3}
                      value={incDesc}
                      onChange={(e) => setIncDesc(e.target.value)}
                      placeholder="Detalla qué ocurrió en locker, punto o taller..."
                      className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[48px] rounded-xl bg-[#1A1E2A] px-5 text-sm font-bold text-[#FCF61C] hover:bg-[#11141D] transition-colors cursor-pointer"
                  >
                    Registrar incidencia
                  </button>
                </form>

                <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-display text-base font-bold text-[#1A1E2A]">
                      Bandeja de resolución ({visibleIncidents.length})
                    </h2>
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
                      {(['all', 'Abierta', 'En revisión', 'Resuelta'] as const).map(
                        (st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setIncFilter(st)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                              incFilter === st
                                ? 'bg-white text-[#1A1E2A] shadow-xs'
                                : 'text-slate-600'
                            }`}
                          >
                            {st === 'all' ? 'Todas' : st}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  {visibleIncidents.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-500">
                      Sin incidencias en esta categoría.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleIncidents.map((inc) => (
                        <div
                          key={inc.id}
                          className="rounded-xl border border-slate-200 p-4 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[#1A1E2A]">
                                {inc.type}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono text-sm font-bold text-[#1A1E2A]">
                                Bolsa {inc.bagCode}
                              </span>
                              {inc.folio && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="font-mono text-xs text-slate-600">
                                    {inc.folio}
                                  </span>
                                </>
                              )}
                            </div>
                            <span
                              className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                                inc.status === 'Resuelta'
                                  ? 'bg-[#F3F8DE] text-[#8BAF03]'
                                  : 'bg-[#FCF61C] text-[#1A1E2A]'
                              }`}
                            >
                              {inc.status}
                            </span>
                          </div>

                          <p className="text-sm text-slate-700">{inc.description}</p>
                          <div className="text-xs text-slate-500">
                            {inc.campusName} ·{' '}
                            {new Date(inc.createdAt).toLocaleString('es-MX')}
                          </div>

                          {inc.status !== 'Resuelta' && (
                            <div className="flex flex-wrap gap-2 pt-2">
                              {inc.status === 'Abierta' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleResolveIncident(inc.id, 'En revisión')
                                  }
                                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-[#1A1E2A] hover:bg-slate-50 cursor-pointer"
                                >
                                  Pasar a revisión
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  handleResolveIncident(
                                    inc.id,
                                    'Resuelta',
                                    'Resuelta por equipo operativo Homeli.',
                                  )
                                }
                                className="min-h-[38px] rounded-lg bg-[#8BAF03] px-3.5 text-xs font-bold text-[#1A1E2A] hover:bg-[#749402] cursor-pointer"
                              >
                                Marcar resuelta
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODULE: USUARIOS Y CREDENCIALES */}
          {activeTab === 'users' && (
            <AdminUsersModule
              currentAdminId={user.id}
              onPushAlert={onPushAlert}
            />
          )}

          {/* MODULE: NOTIFICACIONES */}
          {activeTab === 'notifications' && (
            <NotificationsCenter
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllRead}
              onPushAlert={onPushAlert}
              onOpenFolio={(folio) => {
                const match = orders.find(
                  (o) => o.folio.toUpperCase() === folio.toUpperCase(),
                );
                if (match) setSelectedOrderId(match.id);
                setActiveTab('orders');
              }}
            />
          )}

          {/* MODULE: SERVICIOS Y PRECIOS */}
          {activeTab === 'services' && config && (
            <AdminServicesModule
              config={config}
              onRefresh={fetchOverview}
              onPushAlert={onPushAlert}
            />
          )}

          {/* MODULE: MERCADO PAGO */}
          {activeTab === 'mercadopago' && (
            <AdminMercadoPagoModule
              onRefreshOverview={fetchOverview}
              onPushAlert={onPushAlert}
            />
          )}

          {/* MODULE 6: CONFIGURACIÓN */}
          {activeTab === 'config' && config && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl font-extrabold text-[#1A1E2A]">
                    Configuración operativa
                  </h1>
                  <p className="text-sm text-slate-600">
                    Administra sedes, servicios, precios, lockers y conexión con Supabase.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={checkSupabaseHealth}
                  disabled={checkingSb}
                  className="inline-flex items-center gap-2 min-h-[42px] rounded-xl border border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-[#1A1E2A] hover:bg-slate-50 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-4 w-4 text-[#8BAF03] ${checkingSb ? 'animate-spin' : ''}`}
                  />
                  <span>Verificar tablas Supabase</span>
                </button>
              </div>

              {/* Supabase Table Status Card */}
              {sbHealth && (
                <div
                  className={`rounded-2xl border p-5 space-y-3 ${
                    sbHealth.connected
                      ? 'border-[#8BAF03]/30 bg-[#F3F8DE]/50'
                      : 'border-amber-200 bg-amber-50/70'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-display text-sm font-extrabold text-[#1A1E2A]">
                      <Database className="h-4 w-4 text-[#5E7800]" />
                      <span>
                        {sbHealth.connected
                          ? 'Supabase conectado y las 10 tablas están operativas'
                          : sbHealth.configured
                            ? 'Claves de Supabase detectadas — ejecuta el SQL actualizado en Supabase'
                            : 'Claves de Supabase no detectadas en el servidor'}
                      </span>
                    </div>
                  </div>
                  {sbHealth.error && (
                    <p className="text-xs text-amber-800">{sbHealth.error}</p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {Object.entries(sbHealth.tables).map(([table, ok]) => (
                      <div
                        key={table}
                        className="rounded-lg bg-white border border-slate-200 px-2.5 py-2 flex items-center justify-between gap-1.5 text-xs"
                      >
                        <span className="font-mono text-[11px] text-[#1A1E2A] truncate">
                          {table.replace('kicksxr_', '')}
                        </span>
                        <span
                          className={`font-bold shrink-0 ${
                            ok ? 'text-[#8BAF03]' : 'text-amber-600'
                          }`}
                        >
                          {ok ? 'OK' : 'Pend.'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2 font-display text-base font-bold text-[#1A1E2A]">
                    <Building2 className="h-5 w-5 text-[#5E7800]" />
                    <span>Sedes y puntos Homeli</span>
                  </div>

                  <div className="space-y-2.5">
                    {config.campuses.map((c) => {
                      const isEditing = editingCampusId === c.id;
                      return (
                        <div
                          key={c.id}
                          className="rounded-xl border border-slate-200 p-3.5 space-y-2.5"
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={editCampusName}
                                  onChange={(e) => setEditCampusName(e.target.value)}
                                  placeholder="Nombre de sede"
                                  className="min-h-[38px] rounded-lg border border-slate-300 px-2.5 text-xs font-semibold text-[#1A1E2A]"
                                />
                                <select
                                  value={editCampusType}
                                  onChange={(e) =>
                                    setEditCampusType(
                                      e.target.value as 'university' | 'point',
                                    )
                                  }
                                  className="min-h-[38px] rounded-lg border border-slate-300 px-2.5 text-xs text-[#1A1E2A]"
                                >
                                  <option value="point">Punto físico Homeli</option>
                                  <option value="university">Sede universitaria</option>
                                </select>
                              </div>
                              <input
                                type="text"
                                value={editCampusAddress}
                                onChange={(e) => setEditCampusAddress(e.target.value)}
                                placeholder="Dirección"
                                className="w-full min-h-[38px] rounded-lg border border-slate-300 px-2.5 text-xs text-[#1A1E2A]"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingCampusId(null)}
                                  className="min-h-[32px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-600 cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveCampusEdit(c.id)}
                                  className="min-h-[32px] rounded-lg bg-[#8BAF03] px-3 text-xs font-bold text-[#1A1E2A] cursor-pointer"
                                >
                                  Guardar sede
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-bold text-sm text-[#1A1E2A]">
                                  {c.name}{' '}
                                  <span className="font-mono text-xs font-normal text-slate-500">
                                    ({c.code})
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  {c.address}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCampusId(c.id);
                                    setEditCampusName(c.name);
                                    setEditCampusAddress(c.address);
                                    setEditCampusType(c.type);
                                  }}
                                  title="Editar sede"
                                  className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-[#1A1E2A] hover:border-[#8BAF03] hover:text-[#5E7800] cursor-pointer"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setQrCampusModal(c)}
                                  className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[#FCF61C]/25 px-2.5 text-xs font-bold text-[#1A1E2A] hover:bg-[#1A1E2A] hover:text-[#FCF61C] transition-colors cursor-pointer"
                                >
                                  <QrCode className="h-3.5 w-3.5" />
                                  <span>QR</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await api.updateCampus(c.id, {active: !c.active});
                                    fetchOverview();
                                  }}
                                  className={`min-h-[34px] rounded-lg px-2.5 text-xs font-bold cursor-pointer ${
                                    c.active
                                      ? 'bg-[#F3F8DE] text-[#8BAF03]'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {c.active ? 'Activa' : 'Inactiva'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={handleAddCampus}
                    className="pt-3 border-t border-slate-100 space-y-2.5"
                  >
                    <div className="text-xs font-bold text-[#1A1E2A]">
                      Agregar nueva sede
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        required
                        value={newCampusName}
                        onChange={(e) => setNewCampusName(e.target.value)}
                        placeholder="Ej. Punto Condesa"
                        className="min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm"
                      />
                      <select
                        value={newCampusType}
                        onChange={(e) =>
                          setNewCampusType(e.target.value as 'university' | 'point')
                        }
                        className="min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm"
                      >
                        <option value="point">Punto físico Homeli</option>
                        <option value="university">Sede universitaria</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCampusAddress}
                        onChange={(e) => setNewCampusAddress(e.target.value)}
                        placeholder="Dirección de la sede"
                        className="flex-1 min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm"
                      />
                      <button
                        type="submit"
                        className="min-h-[42px] inline-flex items-center gap-1 rounded-xl bg-[#8BAF03] px-4 text-xs font-bold text-[#1A1E2A] hover:bg-[#749402] cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Agregar</span>
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-display text-base font-bold text-[#1A1E2A]">
                      <Banknote className="h-5 w-5 text-[#5E7800]" />
                      <span>Servicios y precios</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Envío domicilio $</span>
                      <input
                        type="number"
                        min={0}
                        value={shippingFeeInput}
                        onChange={(e) => setShippingFeeInput(e.target.value)}
                        className="w-20 min-h-[36px] rounded-lg border border-slate-300 px-2 font-mono text-xs font-bold text-[#1A1E2A]"
                      />
                      <button
                        type="button"
                        onClick={handleSaveShipping}
                        className="min-h-[36px] rounded-lg bg-[#1A1E2A] px-2.5 text-xs font-bold text-white cursor-pointer"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {config.services.map((svc) => {
                      const isEditing = editingServiceId === svc.id;
                      return (
                        <div
                          key={svc.id}
                          className="rounded-xl border border-slate-200 p-3.5"
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input
                                  type="text"
                                  value={editServiceName}
                                  onChange={(e) => setEditServiceName(e.target.value)}
                                  placeholder="Nombre del servicio"
                                  className="sm:col-span-2 min-h-[38px] rounded-lg border border-slate-300 px-2.5 text-xs font-semibold text-[#1A1E2A]"
                                />
                                <input
                                  type="number"
                                  min={1}
                                  value={editServicePrice}
                                  onChange={(e) => setEditServicePrice(e.target.value)}
                                  placeholder="Precio $"
                                  className="min-h-[38px] rounded-lg border border-slate-300 px-2.5 font-mono text-xs font-bold text-[#1A1E2A]"
                                />
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editServiceDesc}
                                  onChange={(e) => setEditServiceDesc(e.target.value)}
                                  placeholder="Descripción"
                                  className="flex-1 min-h-[38px] rounded-lg border border-slate-300 px-2.5 text-xs text-[#1A1E2A]"
                                />
                                <input
                                  type="number"
                                  min={1}
                                  value={editServiceHours}
                                  onChange={(e) => setEditServiceHours(e.target.value)}
                                  title="Horas estimadas"
                                  className="w-20 min-h-[38px] rounded-lg border border-slate-300 px-2 font-mono text-xs text-[#1A1E2A]"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingServiceId(null)}
                                  className="min-h-[32px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-600 cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveServiceEdit(svc.id)}
                                  className="min-h-[32px] rounded-lg bg-[#8BAF03] px-3 text-xs font-bold text-[#1A1E2A] cursor-pointer"
                                >
                                  Guardar servicio
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-bold text-sm text-[#1A1E2A]">
                                  {svc.name}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  {svc.description} · {svc.turnaroundHours}h
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-mono text-sm font-extrabold text-[#5E7800] tabular-nums mr-1">
                                  ${svc.price}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingServiceId(svc.id);
                                    setEditServiceName(svc.name);
                                    setEditServiceDesc(svc.description);
                                    setEditServicePrice(String(svc.price));
                                    setEditServiceHours(String(svc.turnaroundHours));
                                  }}
                                  title="Editar servicio y precio"
                                  className="min-h-[34px] inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-[#1A1E2A] hover:border-[#8BAF03] hover:text-[#5E7800] cursor-pointer"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await api.updateService(svc.id, {
                                      active: !svc.active,
                                    });
                                    fetchOverview();
                                  }}
                                  className={`min-h-[34px] rounded-lg px-2.5 text-xs font-bold cursor-pointer ${
                                    svc.active
                                      ? 'bg-[#F3F8DE] text-[#8BAF03]'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {svc.active ? 'Activo' : 'Pausado'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={handleAddService}
                    className="pt-3 border-t border-slate-100 space-y-2.5"
                  >
                    <div className="text-xs font-bold text-[#1A1E2A]">
                      Nuevo servicio
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        placeholder="Nombre"
                        className="sm:col-span-2 min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm"
                      />
                      <input
                        type="number"
                        required
                        min={1}
                        value={newServicePrice}
                        onChange={(e) => setNewServicePrice(e.target.value)}
                        placeholder="Precio $"
                        className="min-h-[42px] rounded-xl border border-slate-300 px-3 font-mono text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newServiceDesc}
                        onChange={(e) => setNewServiceDesc(e.target.value)}
                        placeholder="Descripción breve"
                        className="flex-1 min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm"
                      />
                      <input
                        type="number"
                        min={1}
                        value={newServiceHours}
                        onChange={(e) => setNewServiceHours(e.target.value)}
                        title="Horas estimadas"
                        className="w-20 min-h-[42px] rounded-xl border border-slate-300 px-2 font-mono text-sm"
                      />
                      <button
                        type="submit"
                        className="min-h-[42px] rounded-xl bg-[#8BAF03] px-4 text-xs font-bold text-[#1A1E2A] hover:bg-[#749402] cursor-pointer"
                      >
                        Agregar
                      </button>
                    </div>
                  </form>
                </div>

                {/* Cupones y promociones */}
                <div className="xl:col-span-2 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-display text-base font-bold text-[#1A1E2A]">
                      <Tag className="h-5 w-5 text-[#5E7800]" />
                      <span>Cupones y promociones</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      Aplicables por clientes en el paso de pago y en mostrador
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(config.coupons || []).map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-extrabold text-[#1A1E2A]">
                              {c.code}
                            </span>
                            <span className="rounded-md bg-[#F3F8DE] px-2 py-0.5 font-mono text-xs font-bold text-[#5E7800]">
                              {c.discountType === 'percent'
                                ? `${c.value}% OFF`
                                : `-$${c.value}`}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500 truncate">
                            {c.description || 'Promoción Homeli'} · {c.usageCount}{' '}
                            {c.usageCount === 1 ? 'uso' : 'usos'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              await api.updateCoupon(c.id, {active: !c.active});
                              fetchOverview();
                            }}
                            className={`min-h-[32px] rounded-lg px-2.5 text-xs font-bold cursor-pointer ${
                              c.active
                                ? 'bg-[#F3F8DE] text-[#8BAF03]'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {c.active ? 'Activo' : 'Pausado'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCoupon(c.id, c.code)}
                            title="Eliminar cupón"
                            className="min-h-[32px] rounded-lg border border-red-200 bg-white px-2 text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={handleAddCoupon}
                    className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-2.5"
                  >
                    <input
                      type="text"
                      required
                      value={newCouponCode}
                      onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                      placeholder="Código (ej. VERANO15)"
                      className="sm:col-span-3 min-h-[42px] rounded-xl border border-slate-300 px-3 font-mono text-sm uppercase"
                    />
                    <select
                      value={newCouponType}
                      onChange={(e) =>
                        setNewCouponType(e.target.value as 'percent' | 'fixed')
                      }
                      className="sm:col-span-2 min-h-[42px] rounded-xl border border-slate-300 px-2.5 text-sm"
                    >
                      <option value="percent">% Porcentaje</option>
                      <option value="fixed">$ Monto fijo</option>
                    </select>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newCouponValue}
                      onChange={(e) => setNewCouponValue(e.target.value)}
                      placeholder="Valor"
                      className="sm:col-span-2 min-h-[42px] rounded-xl border border-slate-300 px-3 font-mono text-sm"
                    />
                    <input
                      type="text"
                      value={newCouponDesc}
                      onChange={(e) => setNewCouponDesc(e.target.value)}
                      placeholder="Descripción promocional"
                      className="sm:col-span-3 min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm"
                    />
                    <button
                      type="submit"
                      className="sm:col-span-2 min-h-[42px] rounded-xl bg-[#8BAF03] px-4 text-xs font-bold text-[#1A1E2A] hover:bg-[#749402] cursor-pointer"
                    >
                      Crear cupón
                    </button>
                  </form>
                </div>

                <div className="xl:col-span-2 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-display text-base font-bold text-[#1A1E2A]">
                      <Layers className="h-5 w-5 text-[#1A1E2A]" />
                      <span>Lockers autoservicio y numeración de folios / bolsas</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <label className="inline-flex items-center gap-1.5 text-slate-600">
                        <span>Próx. folio KXR-</span>
                        <input
                          type="number"
                          min={1}
                          value={nextOrderSeqInput}
                          onChange={(e) => setNextOrderSeqInput(e.target.value)}
                          className="w-20 min-h-[34px] rounded-lg border border-slate-300 px-2 font-mono text-xs font-bold text-[#1A1E2A]"
                        />
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-slate-600">
                        <span>Próx. bolsa B-</span>
                        <input
                          type="number"
                          min={1}
                          value={nextBagSeqInput}
                          onChange={(e) => setNextBagSeqInput(e.target.value)}
                          className="w-16 min-h-[34px] rounded-lg border border-slate-300 px-2 font-mono text-xs font-bold text-[#1A1E2A]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleSaveSequences}
                        className="min-h-[34px] rounded-lg bg-[#1A1E2A] px-3 text-xs font-bold text-white hover:bg-[#11141D] cursor-pointer"
                      >
                        Guardar numeración
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    {config.lockers.map((lk) => {
                      const campus = config.campuses.find((c) => c.id === lk.campusId);
                      return (
                        <button
                          key={lk.id}
                          type="button"
                          onClick={async () => {
                            const next =
                              lk.status === 'disponible'
                                ? 'mantenimiento'
                                : 'disponible';
                            await api.updateLocker(lk.id, {status: next});
                            fetchOverview();
                          }}
                          className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                            lk.status === 'disponible'
                              ? 'border-[#8BAF03]/30 bg-[#F3F8DE]'
                              : lk.status === 'ocupado'
                                ? 'border-[#1A1E2A]/30 bg-[#FCF61C]'
                                : 'border-slate-300 bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-extrabold text-[#1A1E2A]">
                              {lk.code}
                            </span>
                            <Lock className="h-3.5 w-3.5 text-slate-500" />
                          </div>
                          <div className="mt-1 text-[11px] text-slate-600 truncate">
                            {campus?.name}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-[#1A1E2A]">
                            {lk.status === 'ocupado' && lk.currentBagCode
                              ? `Bolsa ${lk.currentBagCode}`
                              : lk.status}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={handleAddLocker}
                    className="pt-3 border-t border-slate-100 flex flex-wrap gap-2.5"
                  >
                    <input
                      type="text"
                      required
                      value={newLockerCode}
                      onChange={(e) => setNewLockerCode(e.target.value)}
                      placeholder="Código (ej. L-09)"
                      className="w-40 min-h-[42px] rounded-xl border border-slate-300 px-3 font-mono text-sm uppercase"
                    />
                    <select
                      value={newLockerCampus}
                      onChange={(e) => setNewLockerCampus(e.target.value)}
                      className="flex-1 min-w-[200px] min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm"
                    >
                      {config.campuses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="min-h-[42px] rounded-xl bg-[#8BAF03] px-5 text-xs font-bold text-[#1A1E2A] hover:bg-[#749402] cursor-pointer"
                    >
                      Agregar locker
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* QR Scanner Modal */}
      <QRScannerModal
        open={scannerTarget !== null}
        title={
          scannerTarget === 'quick'
            ? 'Lector rápido de código QR'
            : scannerTarget === 'bag'
              ? 'Escanear código de bolsa'
              : 'Escanear folio de devolución'
        }
        subtitle={
          scannerTarget === 'quick'
            ? 'Escanea el código QR del cliente o pedido para ver al instante sus datos, INE/Pasaporte, edad, ubicación y servicio'
            : scannerTarget === 'bag'
              ? 'Escanea la etiqueta de la bolsa o el QR de pedido del cliente'
              : 'Escanea el QR de pedido para cerrar la entrega'
        }
        placeholder={
          scannerTarget === 'quick'
            ? 'KXR-1042 o QR completo'
            : scannerTarget === 'bag'
              ? 'B-028'
              : 'KXR-1042'
        }
        quickOptions={orders.slice(0, 4).map((o) => ({
          label:
            scannerTarget === 'bag' ? `Bolsa ${o.bagCode}` : `Folio ${o.folio}`,
          sublabel: `${o.bagCode} · ${o.clientName} · ${o.serviceName}`,
          value:
            scannerTarget === 'quick'
              ? o.orderQrPayload || o.folio
              : scannerTarget === 'bag'
                ? o.bagCode
                : o.folio,
        }))}
        onScan={(val) => {
          const target = scannerTarget;
          setScannerTarget(null);
          if (target === 'quick') {
            handleQuickQrScan(val);
          } else if (target === 'bag') {
            handleScanOrAddBag(val);
          } else if (target === 'delivery') {
            const parsed = parseOrderQrPayload(val);
            setDeliverFolio(parsed.folio || parsed.bagCode || val);
          }
        }}
        onClose={() => setScannerTarget(null)}
      />

      {/* Quick QR Scan Result Modal (Client + Service Data) */}
      {scannedQrResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1E2A]/75 p-4 backdrop-blur-xs"
          onClick={() => setScannedQrResult(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Ficha de escaneo QR"
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1A1E2A] px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FCF61C] text-[#1A1E2A] shrink-0">
                  <QrCode className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#FCF61C]">
                    Lectura QR confirmada
                  </div>
                  <h3 className="font-display text-lg font-extrabold text-white truncate">
                    {scannedQrResult.matchedOrder?.folio ||
                      scannedQrResult.decoded.folio ||
                      'Código escaneado'}
                    {(scannedQrResult.matchedOrder?.bagCode ||
                      scannedQrResult.decoded.bagCode) && (
                      <span className="ml-2 font-mono text-sm font-bold text-[#8BAF03]">
                        ·{' '}
                        {scannedQrResult.matchedOrder?.bagCode ||
                          scannedQrResult.decoded.bagCode}
                      </span>
                    )}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScannedQrResult(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 cursor-pointer shrink-0"
                aria-label="Cerrar ficha QR"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Client section */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#1A1E2A]">
                  <IdCard className="h-4 w-4 text-[#5E7800]" />
                  <span>Datos del cliente</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      Nombre completo
                    </div>
                    <div className="font-bold text-[#1A1E2A]">
                      {scannedQrResult.matchedOrder?.clientName ||
                        scannedQrResult.decoded.clientName ||
                        'No especificado'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      Edad
                    </div>
                    <div className="font-bold text-[#1A1E2A]">
                      {scannedQrResult.matchedOrder?.clientAge ||
                      scannedQrResult.decoded.clientAge
                        ? `${
                            scannedQrResult.matchedOrder?.clientAge ||
                            scannedQrResult.decoded.clientAge
                          } años`
                        : 'No registrada'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      Número de INE o Pasaporte
                    </div>
                    <div className="font-mono font-bold text-[#1A1E2A] break-all">
                      {scannedQrResult.matchedOrder?.clientIdDocument ||
                        scannedQrResult.decoded.clientIdDocument ||
                        'No registrado'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      WhatsApp
                    </div>
                    <div className="font-mono font-bold text-[#5E7800]">
                      {scannedQrResult.matchedOrder?.clientWhatsapp || '—'}
                    </div>
                  </div>
                </div>

                {(scannedQrResult.matchedOrder?.clientAddress ||
                  scannedQrResult.matchedOrder?.deliveryAddress ||
                  scannedQrResult.decoded.clientAddress) && (
                  <div className="pt-2 border-t border-slate-200 text-xs text-[#1A1E2A]">
                    <span className="font-bold text-slate-500 block mb-0.5">
                      Dirección registrada
                    </span>
                    <span>
                      {scannedQrResult.matchedOrder?.clientAddress ||
                        scannedQrResult.matchedOrder?.deliveryAddress ||
                        scannedQrResult.decoded.clientAddress}
                    </span>
                  </div>
                )}

                {(() => {
                  const mapsLink =
                    scannedQrResult.matchedOrder?.clientMapsUrl ||
                    scannedQrResult.decoded.clientMapsUrl;
                  if (!isSafeGoogleMapsUrl(mapsLink)) return null;
                  return (
                    <a
                      href={mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#8BAF03] px-4 text-xs sm:text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] transition-colors"
                    >
                      <MapPin className="h-4 w-4" />
                      <span>Abrir ubicación del cliente en Google Maps</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  );
                })()}
              </div>

              {/* Service & Order section */}
              <div className="rounded-xl border border-[#8BAF03]/30 bg-[#F3F8DE]/55 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#1A1E2A]">
                    Servicio y pedido
                  </span>
                  {scannedQrResult.matchedOrder && (
                    <span className="rounded-lg bg-[#1A1E2A] px-2.5 py-0.5 text-[11px] font-bold text-[#FCF61C]">
                      {scannedQrResult.matchedOrder.status}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      Servicio solicitado
                    </span>
                    <span className="font-bold text-[#1A1E2A]">
                      {scannedQrResult.matchedOrder?.serviceName ||
                        scannedQrResult.decoded.serviceName ||
                        '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      Total / Pago
                    </span>
                    <span className="font-mono font-extrabold text-[#5E7800]">
                      $
                      {scannedQrResult.matchedOrder?.totalAmount ??
                        scannedQrResult.decoded.totalAmount ??
                        0}{' '}
                      MXN
                    </span>
                    {scannedQrResult.matchedOrder && (
                      <span className="block text-[11px] font-semibold text-slate-600">
                        {formatPaymentMethodLabel(
                          scannedQrResult.matchedOrder.paymentMethod,
                          scannedQrResult.matchedOrder.cardLast4,
                        )}{' '}
                        · {scannedQrResult.matchedOrder.paymentStatus}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Admin Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {scannedQrResult.matchedOrder ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const ord = scannedQrResult.matchedOrder!;
                        setScannedQrResult(null);
                        setSelectedOrderId(ord.id);
                        setActiveTab('orders');
                      }}
                      className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#1A1E2A] px-4 text-xs sm:text-sm font-bold text-white hover:bg-[#11141D] cursor-pointer"
                    >
                      <Pencil className="h-4 w-4 text-[#FCF61C]" />
                      <span>Gestionar pedido</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ord = scannedQrResult.matchedOrder!;
                        setScannedQrResult(null);
                        setDetailOrderModal(ord);
                      }}
                      className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-[#1A1E2A] hover:border-[#8BAF03] cursor-pointer"
                    >
                      <Eye className="h-4 w-4 text-[#5E7800]" />
                      <span>Ver ficha completa</span>
                    </button>
                    {scannedQrResult.matchedOrder.collectionStatus ===
                      'Pendiente' && (
                      <button
                        type="button"
                        onClick={async () => {
                          const ord = scannedQrResult.matchedOrder!;
                          try {
                            await api.confirmCollectionBags([ord.bagCode]);
                            onPushAlert({
                              title: `Bolsa ${ord.bagCode} recibida`,
                              message: `Pedido ${ord.folio} marcado como Recibido por KicksXR.`,
                              tone: 'success',
                            });
                            setScannedQrResult(null);
                            fetchOverview();
                          } catch (err) {
                            onPushAlert({
                              title: 'Error en recepción',
                              message:
                                err instanceof Error
                                  ? err.message
                                  : 'No se pudo confirmar la recepción.',
                              tone: 'error',
                            });
                          }
                        }}
                        className="sm:col-span-2 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#8BAF03] px-4 text-xs sm:text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] cursor-pointer"
                      >
                        <Check className="h-4 w-4" />
                        <span>Confirmar recepción en taller</span>
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setScannedQrResult(null);
                      setScannerTarget('quick');
                    }}
                    className="sm:col-span-2 min-h-[44px] rounded-xl bg-[#8BAF03] px-4 text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] cursor-pointer"
                  >
                    Escanear otro código QR
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sede QR Modal */}
      {qrCampusModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1E2A]/65 p-4 backdrop-blur-xs"
          onClick={() => setQrCampusModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-extrabold text-[#1A1E2A]">
              QR de Sede Homeli
            </h3>
            <p className="mt-1 text-sm text-slate-600">{qrCampusModal.name}</p>
            <div className="mt-5 inline-flex flex-col items-center rounded-2xl bg-[#FCF61C]/25 p-5 border border-[#8BAF03]/20">
              <div className="rounded-xl bg-white p-3">
                <QRCodeSVG value={qrCampusModal.code} size={180} fgColor="#1A1E2A" />
              </div>
              <span className="mt-3 font-mono text-sm font-extrabold text-[#1A1E2A]">
                {qrCampusModal.code}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setQrCampusModal(null)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-[#8BAF03] text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Order & Service Complete Detail Modal */}
      <AdminOrderDetailModal
        order={detailOrderModal}
        onClose={() => setDetailOrderModal(null)}
        onZoomPhoto={(payload) => {
          setLightboxZoomed(false);
          setLightboxPhoto(payload);
        }}
        onOpenReceipt={(order) => setReceiptOrder(order)}
        onManageOrder={
          activeTab !== 'orders'
            ? (order) => {
                setSelectedOrderId(order.id);
                setActiveTab('orders');
              }
            : undefined
        }
      />

      {/* Printable / Downloadable Order Receipt Modal */}
      <OrderReceiptModal
        order={receiptOrder}
        onClose={() => setReceiptOrder(null)}
      />

      {/* Walk-In Counter Order Creation Modal */}
      <AdminWalkInOrderModal
        open={walkInModalOpen}
        config={config}
        onClose={() => setWalkInModalOpen(false)}
        onPushAlert={onPushAlert}
        onCreated={(order, whatsappUrl) => {
          setSelectedOrderId(order.id);
          setActiveTab('orders');
          onPushAlert({
            title: `Pedido en mostrador ${order.folio}`,
            message: `Bolsa ${order.bagCode} registrada para ${order.clientName}.`,
            tone: 'success',
            whatsappUrl,
          });
          fetchOverview();
        }}
      />

      {/* Enhanced Full-Screen Sneaker Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/92 backdrop-blur-xs"
          onClick={() => {
            setLightboxPhoto(null);
            setLightboxZoomed(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={lightboxPhoto.title}
        >
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 bg-black/70 border-b border-white/10 text-white shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <div className="font-display text-sm sm:text-base font-extrabold truncate">
                {lightboxPhoto.title}
              </div>
              {lightboxPhoto.subtitle && (
                <div className="text-xs text-white/75 truncate">
                  {lightboxPhoto.subtitle}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setLightboxZoomed((z) => !z)}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 px-3 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                {lightboxZoomed ? (
                  <>
                    <ZoomOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Ajustar</span>
                  </>
                ) : (
                  <>
                    <ZoomIn className="h-4 w-4" />
                    <span className="hidden sm:inline">Acercar</span>
                  </>
                )}
              </button>
              <a
                href={lightboxPhoto.url}
                download={lightboxPhoto.filename}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#8BAF03] hover:bg-[#749402] px-3 text-xs font-bold text-[#1A1E2A] transition-colors"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Descargar</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setLightboxPhoto(null);
                  setLightboxZoomed(false);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                aria-label="Cerrar visor de fotografía"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 overflow-auto flex items-center justify-center p-4"
            onClick={() => {
              setLightboxPhoto(null);
              setLightboxZoomed(false);
            }}
          >
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.title}
              onClick={(e) => {
                e.stopPropagation();
                setLightboxZoomed((z) => !z);
              }}
              className={`rounded-xl shadow-2xl transition-all duration-200 ${
                lightboxZoomed
                  ? 'max-w-none w-[140%] sm:w-auto sm:max-h-none sm:scale-150 cursor-zoom-out'
                  : 'max-h-[82vh] max-w-full object-contain cursor-zoom-in'
              }`}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
};
