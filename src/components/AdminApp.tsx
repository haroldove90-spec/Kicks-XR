import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  AlertTriangle,
  Banknote,
  Bell,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  Database,
  ExternalLink,
  Home,
  Layers,
  Lock,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Users,
} from 'lucide-react';
import {QRCodeSVG} from 'qrcode.react';
import {api, subscribeToRealtimeUpdates} from '../lib/api';
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
import {AdminUsersModule} from './AdminUsersModule';
import {AppShell, type NavModuleItem} from './AppShell';
import {NotificationsCenter} from './NotificationsCenter';
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
  const [scannerTarget, setScannerTarget] = useState<'bag' | 'delivery' | null>(null);

  // Module 3: Gestionar pedido
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<OrderStatus>('En limpieza');
  const [editPayment, setEditPayment] = useState<PaymentStatus>('Pago pendiente');
  const [editBagCode, setEditBagCode] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // Module 4: Confirmar devolución
  const [deliverMethod, setDeliverMethod] = useState<DeliveryMethod>('pickup');
  const [deliverFolio, setDeliverFolio] = useState('');
  const [deliverMarkPaid, setDeliverMarkPaid] = useState(true);

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
  const [qrCampusModal, setQrCampusModal] = useState<Campus | null>(null);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('250');
  const [newServiceHours, setNewServiceHours] = useState('24');
  const [newLockerCode, setNewLockerCode] = useState('');
  const [newLockerCampus, setNewLockerCampus] = useState('');
  const [shippingFeeInput, setShippingFeeInput] = useState('75');
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
    setEditBagCode(selectedOrder.bagCode);
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

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.folio.toLowerCase().includes(q) ||
        o.bagCode.toLowerCase().includes(q) ||
        o.clientName.toLowerCase().includes(q) ||
        o.campusName.toLowerCase().includes(q),
    );
  }, [orders, orderSearch]);

  const readyToDeliverOrders = useMemo(
    () => orders.filter((o) => o.status !== 'Entregado'),
    [orders],
  );

  const handleScanOrAddBag = (rawValue: string) => {
    let code = rawValue.trim().toUpperCase();
    if (code.startsWith('KICKSXR|')) {
      code = code.split('|')[2] || code;
    }
    if (!code) return;
    setBagScanInput(code);

    const match = orders.find(
      (o) => o.bagCode.toUpperCase() === code || o.folio.toUpperCase() === code,
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

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;
    try {
      await api.updateAdminOrder(selectedOrder.id, {
        status: editStatus,
        paymentStatus: editPayment,
        bagCode: editBagCode.trim().toUpperCase(),
      });
      onPushAlert({
        title: `Pedido ${selectedOrder.folio} actualizado`,
        message: `Estatus: "${editStatus}" · Pago: ${editPayment}. Notificación enviada al cliente.`,
        tone: 'success',
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

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    let code = deliverFolio.trim().toUpperCase();
    if (code.startsWith('KICKSXR|')) {
      code = code.split('|')[1] || code;
    }
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
      });
      setDeliverFolio('');
      onPushAlert({
        title: `Entrega cerrada · ${res.order.folio}`,
        message: `El pedido ${res.order.folio} fue marcado como Entregado y el cliente fue notificado.`,
        tone: 'success',
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
              <div>
                <h1 className="font-display text-2xl font-extrabold text-[#000000]">
                  Panel Operativo Kicks XR
                </h1>
                <p className="text-sm text-slate-600">
                  Resumen en tiempo real de recolecciones, taller, entregas e incidencias
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('collections')}
                  className="rounded-2xl bg-white border border-slate-200 p-5 text-left hover:border-[#109173] transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-slate-500">
                    Recolecciones pendientes
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-[#000831] tabular-nums">
                    {metrics.pendingCollections}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[#109173]">
                    Abrir lote de bolsas →
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="rounded-2xl bg-white border border-slate-200 p-5 text-left hover:border-[#109173] transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-slate-500">
                    En limpieza / Listos
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-[#109173] tabular-nums">
                    {metrics.inCleaning + metrics.readyForDelivery}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {metrics.inCleaning} limpieza · {metrics.readyForDelivery} listos
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('incidents')}
                  className="rounded-2xl bg-white border border-slate-200 p-5 text-left hover:border-[#5B21B6] transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-slate-500">
                    Incidencias activas
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-[#5B21B6] tabular-nums">
                    {metrics.openIncidents}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Faltantes, sin pedido o duplicados
                  </div>
                </button>

                <div className="rounded-2xl bg-[#000831] text-white p-5">
                  <div className="text-xs font-semibold text-white/70">
                    Ingresos cobrados
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-[#E6F7F3] tabular-nums">
                    ${metrics.revenuePaid}
                  </div>
                  <div className="mt-1 text-xs text-white/70 tabular-nums">
                    Por cobrar: ${metrics.revenuePending} MXN
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-base font-bold text-[#000000]">
                      Pedidos recientes
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="text-xs font-bold text-[#109173] hover:underline cursor-pointer"
                    >
                      Ver todos
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs text-slate-500">
                          <th className="py-2.5 pr-3 font-semibold">Folio</th>
                          <th className="py-2.5 pr-3 font-semibold">Bolsa</th>
                          <th className="py-2.5 pr-3 font-semibold">Cliente</th>
                          <th className="py-2.5 pr-3 font-semibold">Estatus</th>
                          <th className="py-2.5 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.slice(0, 6).map((o) => (
                          <tr
                            key={o.id}
                            onClick={() => {
                              setSelectedOrderId(o.id);
                              setActiveTab('orders');
                            }}
                            className="hover:bg-slate-50 cursor-pointer"
                          >
                            <td className="py-3 pr-3 font-mono font-bold text-[#000831]">
                              {o.folio}
                            </td>
                            <td className="py-3 pr-3 font-mono font-semibold text-[#5B21B6]">
                              {o.bagCode}
                            </td>
                            <td className="py-3 pr-3 truncate max-w-[140px]">
                              {o.clientName}
                            </td>
                            <td className="py-3 pr-3 text-xs font-semibold text-[#109173]">
                              {o.status}
                            </td>
                            <td className="py-3 text-right font-mono font-bold tabular-nums">
                              ${o.totalAmount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-base font-bold text-[#000000]">
                      Alertas recientes
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('notifications')}
                      className="text-xs font-bold text-[#109173] hover:underline cursor-pointer"
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
                            <span className="font-bold text-[#000831]">{n.title}</span>
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
                              className="inline-flex items-center gap-1 font-bold text-[#109173] hover:underline"
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
                <div className="flex items-center gap-3 rounded-xl bg-[#109173] px-4 py-3 text-white">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-display text-base font-extrabold text-[#109173] shrink-0">
                    1
                  </span>
                  <h2 className="font-display text-lg font-extrabold">
                    1. Recolecciones
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#000831] mb-1">
                      Sede / Punto
                    </label>
                    <select
                      value={filterCampus}
                      onChange={(e) => setFilterCampus(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#000831]"
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
                    <label className="block text-xs font-bold text-[#000831] mb-1">
                      Fecha
                    </label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-[#000831]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#000831] mb-1">
                      Estado
                    </label>
                    <select
                      value={filterCollectionState}
                      onChange={(e) =>
                        setFilterCollectionState(
                          e.target.value as 'all' | 'Pendiente' | 'Recolectado',
                        )
                      }
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#000831]"
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
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-[#000831]">
                        <th className="py-2.5 px-3 rounded-l-lg">Bolsa</th>
                        <th className="py-2.5 px-3">Pedido (Folio)</th>
                        <th className="py-2.5 px-3">Sede</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3 text-right rounded-r-lg">Acción</th>
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
                        collectionBatch.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2 font-mono font-bold text-[#000831]">
                                <ShoppingBag className="h-4 w-4 text-[#000831]" />
                                <span>{item.bagCode}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono font-semibold text-[#000831]">
                              {item.folio}
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-600">
                              {item.campusName}
                              {item.assignedLockerCode && (
                                <span className="ml-1 font-mono text-[#5B21B6]">
                                  ({item.assignedLockerCode})
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold ${
                                  item.collectionStatus === 'Recolectado'
                                    ? 'bg-[#E6F7F3] text-[#109173]'
                                    : 'bg-[#EFEAFF] text-[#5B21B6]'
                                }`}
                              >
                                {item.collectionStatus}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setBagScanInput(item.bagCode);
                                  setCheckedBags((prev) => ({
                                    ...prev,
                                    [item.bagCode]: true,
                                  }));
                                }}
                                className="min-h-[38px] rounded-xl bg-[#109173] px-3.5 text-xs font-bold text-white hover:bg-[#0B755C] transition-colors whitespace-nowrap cursor-pointer"
                              >
                                Abrir recolección
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="xl:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-3 rounded-xl bg-[#109173] px-4 py-3 text-white">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-display text-base font-extrabold text-[#109173] shrink-0">
                    2
                  </span>
                  <h2 className="font-display text-lg font-extrabold">
                    2. Verificar bolsas
                  </h2>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#000831] mb-1.5">
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
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-mono uppercase text-[#000831] focus:border-[#109173] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setScannerTarget('bag')}
                      className="min-h-[44px] px-3.5 rounded-xl border border-[#5B21B6]/30 bg-[#EFEAFF] text-[#5B21B6] hover:bg-[#5B21B6] hover:text-white transition-colors cursor-pointer"
                      title="Escanear código de bolsa"
                    >
                      <QrCode className="h-5 w-5" />
                    </button>
                    <button
                      type="submit"
                      className="min-h-[44px] px-4 rounded-xl bg-[#000831] text-xs font-bold text-white hover:bg-[#000000] whitespace-nowrap cursor-pointer"
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
                      return (
                        <label
                          key={item.id}
                          className="flex items-center justify-between gap-3 p-3.5 hover:bg-slate-50 cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                setCheckedBags((prev) => ({
                                  ...prev,
                                  [item.bagCode]: e.target.checked,
                                }))
                              }
                              className="h-5 w-5 rounded accent-[#109173] cursor-pointer"
                            />
                            <ShoppingBag className="h-5 w-5 text-[#000831] shrink-0" />
                            <div className="min-w-0">
                              <div className="font-mono text-sm font-bold text-[#000831]">
                                {item.bagCode}
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {item.folio} · {item.clientName}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`rounded-lg px-3 py-1 text-xs font-bold whitespace-nowrap shrink-0 ${
                              isChecked
                                ? 'bg-[#E6F7F3] text-[#109173]'
                                : 'bg-[#EFEAFF] text-[#5B21B6]'
                            }`}
                          >
                            {isChecked ? 'Bolsa verificada' : 'Bolsa faltante'}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleConfirmReception}
                    className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#109173] px-4 text-sm font-bold text-white hover:bg-[#0B755C] transition-colors cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>Confirmar recepción</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenIncidentFromCollection}
                    className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#5B21B6] bg-white px-4 text-sm font-bold text-[#5B21B6] hover:bg-[#EFEAFF] transition-colors cursor-pointer"
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
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Buscar folio, bolsa o cliente..."
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-[#000831] focus:border-[#109173] focus:outline-none"
                  />
                </div>

                <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                  {filteredOrders.map((o) => {
                    const active = selectedOrder?.id === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setSelectedOrderId(o.id)}
                        className={`w-full rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-[#109173] bg-[#E6F7F3]'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-extrabold text-[#000831]">
                            {o.folio}
                          </span>
                          <span className="font-mono text-xs font-bold text-[#5B21B6]">
                            {o.bagCode}
                          </span>
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-700 truncate">
                          {o.clientName} · {o.serviceName}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px]">
                          <span className="font-bold text-[#109173]">{o.status}</span>
                          <span className="font-mono text-slate-500 tabular-nums">
                            {o.paymentStatus}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="xl:col-span-8 space-y-6">
                <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5">
                  <div className="flex items-center gap-3 rounded-xl bg-[#109173] px-4 py-3 text-white">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-display text-base font-extrabold text-[#109173] shrink-0">
                      3
                    </span>
                    <h2 className="font-display text-lg font-extrabold">
                      3. Gestionar pedido
                    </h2>
                  </div>

                  {selectedOrder ? (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 rounded-2xl border border-slate-200 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                        <div className="p-4 flex items-center gap-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#E6F7F3] text-[#000831] shrink-0">
                            <ShoppingBag className="h-7 w-7" />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-slate-500">
                              Folio
                            </div>
                            <div className="font-mono text-2xl font-extrabold text-[#000831] tabular-nums">
                              {selectedOrder.folio}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-medium text-slate-500">
                              Bolsa (vincular o editar etiqueta)
                            </div>
                            <input
                              type="text"
                              value={editBagCode}
                              onChange={(e) => setEditBagCode(e.target.value)}
                              className="mt-1 w-32 rounded-lg border border-slate-200 px-2.5 py-1 font-mono text-xl font-extrabold uppercase text-[#000831] focus:border-[#109173] focus:outline-none"
                            />
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <div className="font-semibold text-[#000831]">
                              {selectedOrder.pairs}{' '}
                              {selectedOrder.pairs === 1 ? 'par' : 'pares'}
                            </div>
                            <div className="font-mono font-bold text-[#109173] tabular-nums">
                              ${selectedOrder.totalAmount} MXN
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                        <div className="md:col-span-7 rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">Cliente</span>
                            <span className="font-bold text-[#000831]">
                              {selectedOrder.clientName}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">WhatsApp</span>
                            <a
                              href={`https://wa.me/52${selectedOrder.clientWhatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono font-bold text-[#109173] hover:underline"
                            >
                              <span>{selectedOrder.clientWhatsapp}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">Servicio</span>
                            <span className="font-semibold text-[#000831]">
                              {selectedOrder.serviceName}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">Entrega</span>
                            <span className="font-semibold text-[#000831] text-right">
                              {selectedOrder.deliveryMethod === 'delivery'
                                ? `Domicilio: ${selectedOrder.deliveryAddress}`
                                : `Recoger en ${selectedOrder.campusName}`}
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-5">
                          {selectedOrder.photoDataUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxPhoto(selectedOrder.photoDataUrl || null)
                              }
                              className="group relative w-full overflow-hidden rounded-xl border border-slate-200 cursor-pointer"
                            >
                              <img
                                src={selectedOrder.photoDataUrl}
                                alt={`Evidencia ${selectedOrder.folio}`}
                                className="h-36 w-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <span className="absolute bottom-2 right-2 rounded-lg bg-[#000831]/80 px-2 py-1 text-[11px] font-semibold text-white">
                                Ampliar foto
                              </span>
                            </button>
                          ) : (
                            <div className="h-36 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-xs text-slate-500 p-4 text-center">
                              <Sparkles className="h-5 w-5 text-slate-400 mb-1" />
                              <span>Sin foto inicial adjunta en este folio</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-slate-200 p-4">
                          <label className="block text-xs font-bold text-slate-500 mb-2">
                            Estado del pedido
                          </label>
                          <select
                            value={editStatus}
                            onChange={(e) =>
                              setEditStatus(e.target.value as OrderStatus)
                            }
                            className="w-full min-h-[44px] rounded-xl bg-[#E6F7F3] border border-[#109173]/30 px-3 text-sm font-bold text-[#000831] focus:border-[#109173] focus:outline-none"
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
                            Pago ({selectedOrder.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'})
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
                                ? 'bg-[#E6F7F3] text-[#109173] border border-[#109173]/30'
                                : 'bg-[#EFEAFF] text-[#5B21B6] border border-[#5B21B6]/25'
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

                      <button
                        type="button"
                        onClick={handleUpdateOrder}
                        className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#109173] px-6 text-sm font-bold text-white hover:bg-[#0B755C] transition-colors cursor-pointer"
                      >
                        <Pencil className="h-4 w-4" />
                        <span>Actualizar estado</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Selecciona un pedido de la lista para gestionarlo.
                    </p>
                  )}
                </section>

                <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5">
                  <div className="flex items-center gap-3 rounded-xl bg-[#109173] px-4 py-3 text-white">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-display text-base font-extrabold text-[#109173] shrink-0">
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
                            ? 'border-[#109173] bg-[#E6F7F3]'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                            deliverMethod === 'pickup'
                              ? 'border-[#109173]'
                              : 'border-slate-300'
                          }`}
                        >
                          {deliverMethod === 'pickup' && (
                            <span className="h-2.5 w-2.5 rounded-full bg-[#109173]" />
                          )}
                        </span>
                        <Store className="h-5 w-5 text-[#000831]" />
                        <span className="font-bold text-sm text-[#000831]">
                          Recogida en punto
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeliverMethod('delivery')}
                        className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all cursor-pointer ${
                          deliverMethod === 'delivery'
                            ? 'border-[#109173] bg-[#E6F7F3]'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                            deliverMethod === 'delivery'
                              ? 'border-[#109173]'
                              : 'border-slate-300'
                          }`}
                        >
                          {deliverMethod === 'delivery' && (
                            <span className="h-2.5 w-2.5 rounded-full bg-[#109173]" />
                          )}
                        </span>
                        <Truck className="h-5 w-5 text-[#000831]" />
                        <span className="font-bold text-sm text-[#000831]">
                          Entrega a domicilio
                        </span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#000831] mb-1.5">
                        Folio de confirmación
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={deliverFolio}
                          onChange={(e) => setDeliverFolio(e.target.value)}
                          placeholder="Ej. KXR-1042"
                          className="flex-1 min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 font-mono text-sm uppercase text-[#000831] focus:border-[#109173] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setScannerTarget('delivery')}
                          className="min-h-[46px] px-4 rounded-xl border border-[#5B21B6]/30 bg-[#EFEAFF] text-[#5B21B6] hover:bg-[#5B21B6] hover:text-white transition-colors cursor-pointer"
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
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-bold text-[#000831] hover:border-[#109173] cursor-pointer"
                            >
                              {o.folio}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deliverMarkPaid}
                        onChange={(e) => setDeliverMarkPaid(e.target.checked)}
                        className="h-4 w-4 rounded accent-[#109173]"
                      />
                      <span>Confirmar liquidación de pago (marcar como Pagado)</span>
                    </label>

                    <button
                      type="submit"
                      className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#109173] px-6 text-sm font-bold text-white hover:bg-[#0B755C] transition-colors cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      <span>Marcar como entregado</span>
                    </button>
                  </form>
                </section>
              </div>
            </div>
          )}

          {/* MODULE 5: INCIDENCIAS */}
          {activeTab === 'incidents' && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-[#5B21B6] px-5 py-4 text-white flex items-center gap-3">
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
                  <h2 className="font-display text-base font-bold text-[#000000]">
                    Registrar nueva incidencia
                  </h2>

                  <div>
                    <label className="block text-xs font-bold text-[#000831] mb-1.5">
                      Tipo de incidencia
                    </label>
                    <select
                      value={incType}
                      onChange={(e) => setIncType(e.target.value as IncidentType)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-[#000831]"
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
                      <label className="block text-xs font-bold text-[#000831] mb-1.5">
                        Código de bolsa
                      </label>
                      <input
                        type="text"
                        required
                        value={incBagCode}
                        onChange={(e) => setIncBagCode(e.target.value)}
                        placeholder="B-029"
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm uppercase text-[#000831]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#000831] mb-1.5">
                        Folio (opcional)
                      </label>
                      <input
                        type="text"
                        value={incFolio}
                        onChange={(e) => setIncFolio(e.target.value)}
                        placeholder="KXR-1043"
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm uppercase text-[#000831]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#000831] mb-1.5">
                      Sede / Punto
                    </label>
                    <select
                      value={incCampusId}
                      onChange={(e) => setIncCampusId(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#000831]"
                    >
                      {config?.campuses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#000831] mb-1.5">
                      Descripción operativa
                    </label>
                    <textarea
                      rows={3}
                      value={incDesc}
                      onChange={(e) => setIncDesc(e.target.value)}
                      placeholder="Detalla qué ocurrió en locker, punto o taller..."
                      className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-[#000831] focus:border-[#5B21B6] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[48px] rounded-xl bg-[#5B21B6] px-5 text-sm font-bold text-white hover:bg-[#4C1D95] transition-colors cursor-pointer"
                  >
                    Registrar incidencia
                  </button>
                </form>

                <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-display text-base font-bold text-[#000000]">
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
                                ? 'bg-white text-[#000831] shadow-xs'
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
                              <span className="font-bold text-sm text-[#5B21B6]">
                                {inc.type}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono text-sm font-bold text-[#000831]">
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
                                  ? 'bg-[#E6F7F3] text-[#109173]'
                                  : 'bg-[#EFEAFF] text-[#5B21B6]'
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
                                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-[#000831] hover:bg-slate-50 cursor-pointer"
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
                                    'Resuelta por equipo operativo Kicks XR.',
                                  )
                                }
                                className="min-h-[38px] rounded-lg bg-[#109173] px-3.5 text-xs font-bold text-white hover:bg-[#0B755C] cursor-pointer"
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

          {/* MODULE 6: CONFIGURACIÓN */}
          {activeTab === 'config' && config && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl font-extrabold text-[#000000]">
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
                  className="inline-flex items-center gap-2 min-h-[42px] rounded-xl border border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-[#000831] hover:bg-slate-50 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-4 w-4 text-[#109173] ${checkingSb ? 'animate-spin' : ''}`}
                  />
                  <span>Verificar tablas Supabase</span>
                </button>
              </div>

              {/* Supabase Table Status Card */}
              {sbHealth && (
                <div
                  className={`rounded-2xl border p-5 space-y-3 ${
                    sbHealth.connected
                      ? 'border-[#109173]/30 bg-[#E6F7F3]/50'
                      : 'border-amber-200 bg-amber-50/70'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-display text-sm font-extrabold text-[#000831]">
                      <Database className="h-4 w-4 text-[#109173]" />
                      <span>
                        {sbHealth.connected
                          ? 'Supabase conectado y las 9 tablas están operativas'
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
                        <span className="font-mono text-[11px] text-[#000831] truncate">
                          {table.replace('kicksxr_', '')}
                        </span>
                        <span
                          className={`font-bold shrink-0 ${
                            ok ? 'text-[#109173]' : 'text-amber-600'
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
                  <div className="flex items-center gap-2 font-display text-base font-bold text-[#000000]">
                    <Building2 className="h-5 w-5 text-[#109173]" />
                    <span>Sedes y puntos KicksXR</span>
                  </div>

                  <div className="space-y-2.5">
                    {config.campuses.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#000831]">
                            {c.name}{' '}
                            <span className="font-mono text-xs font-normal text-slate-500">
                              ({c.code})
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {c.address}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQrCampusModal(c)}
                            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[#EFEAFF] px-3 text-xs font-bold text-[#5B21B6] hover:bg-[#5B21B6] hover:text-white transition-colors cursor-pointer"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            <span>QR Sede</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await api.updateCampus(c.id, {active: !c.active});
                              fetchOverview();
                            }}
                            className={`min-h-[36px] rounded-lg px-3 text-xs font-bold cursor-pointer ${
                              c.active
                                ? 'bg-[#E6F7F3] text-[#109173]'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {c.active ? 'Activa' : 'Inactiva'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={handleAddCampus}
                    className="pt-3 border-t border-slate-100 space-y-2.5"
                  >
                    <div className="text-xs font-bold text-[#000831]">
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
                        <option value="point">Punto físico KicksXR</option>
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
                        className="min-h-[42px] inline-flex items-center gap-1 rounded-xl bg-[#109173] px-4 text-xs font-bold text-white hover:bg-[#0B755C] cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Agregar</span>
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-display text-base font-bold text-[#000000]">
                      <Banknote className="h-5 w-5 text-[#109173]" />
                      <span>Servicios y precios</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Envío domicilio $</span>
                      <input
                        type="number"
                        min={0}
                        value={shippingFeeInput}
                        onChange={(e) => setShippingFeeInput(e.target.value)}
                        className="w-20 min-h-[36px] rounded-lg border border-slate-300 px-2 font-mono text-xs font-bold text-[#000831]"
                      />
                      <button
                        type="button"
                        onClick={handleSaveShipping}
                        className="min-h-[36px] rounded-lg bg-[#000831] px-2.5 text-xs font-bold text-white cursor-pointer"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {config.services.map((svc) => (
                      <div
                        key={svc.id}
                        className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#000831]">
                            {svc.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {svc.description}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-sm font-extrabold text-[#109173] tabular-nums">
                            ${svc.price}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              await api.updateService(svc.id, {active: !svc.active});
                              fetchOverview();
                            }}
                            className={`min-h-[34px] rounded-lg px-2.5 text-xs font-bold cursor-pointer ${
                              svc.active
                                ? 'bg-[#E6F7F3] text-[#109173]'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {svc.active ? 'Activo' : 'Pausado'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={handleAddService}
                    className="pt-3 border-t border-slate-100 space-y-2.5"
                  >
                    <div className="text-xs font-bold text-[#000831]">
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
                        className="min-h-[42px] rounded-xl bg-[#109173] px-4 text-xs font-bold text-white hover:bg-[#0B755C] cursor-pointer"
                      >
                        Agregar
                      </button>
                    </div>
                  </form>
                </div>

                <div className="xl:col-span-2 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-display text-base font-bold text-[#000000]">
                      <Layers className="h-5 w-5 text-[#5B21B6]" />
                      <span>Lockers autoservicio y asignación de bolsas</span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Próximo folio:{' '}
                      <strong className="font-mono text-[#000831]">
                        KXR-{config.nextOrderSeq}
                      </strong>{' '}
                      · Próxima bolsa:{' '}
                      <strong className="font-mono text-[#5B21B6]">
                        B-{String(config.nextBagSeq).padStart(3, '0')}
                      </strong>
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
                              ? 'border-[#109173]/30 bg-[#E6F7F3]'
                              : lk.status === 'ocupado'
                                ? 'border-[#5B21B6]/30 bg-[#EFEAFF]'
                                : 'border-slate-300 bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-extrabold text-[#000831]">
                              {lk.code}
                            </span>
                            <Lock className="h-3.5 w-3.5 text-slate-500" />
                          </div>
                          <div className="mt-1 text-[11px] text-slate-600 truncate">
                            {campus?.name}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-[#000831]">
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
                      className="min-h-[42px] rounded-xl bg-[#109173] px-5 text-xs font-bold text-white hover:bg-[#0B755C] cursor-pointer"
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
          scannerTarget === 'bag'
            ? 'Escanear código de bolsa'
            : 'Escanear folio de devolución'
        }
        subtitle={
          scannerTarget === 'bag'
            ? 'Escanea la etiqueta de la bolsa o el QR de pedido del cliente'
            : 'Escanea el QR de pedido para cerrar la entrega'
        }
        placeholder={scannerTarget === 'bag' ? 'B-028' : 'KXR-1042'}
        quickOptions={orders.slice(0, 4).map((o) => ({
          label: scannerTarget === 'bag' ? `Bolsa ${o.bagCode}` : `Folio ${o.folio}`,
          sublabel: `${o.folio} · ${o.clientName}`,
          value: scannerTarget === 'bag' ? o.bagCode : o.folio,
        }))}
        onScan={(val) => {
          const target = scannerTarget;
          setScannerTarget(null);
          if (target === 'bag') {
            handleScanOrAddBag(val);
          } else if (target === 'delivery') {
            const parsed = val.startsWith('KICKSXR|') ? val.split('|')[1] || val : val;
            setDeliverFolio(parsed);
          }
        }}
        onClose={() => setScannerTarget(null)}
      />

      {/* Sede QR Modal */}
      {qrCampusModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#000831]/65 p-4 backdrop-blur-xs"
          onClick={() => setQrCampusModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-extrabold text-[#000000]">
              QR de Sede Kicks XR
            </h3>
            <p className="mt-1 text-sm text-slate-600">{qrCampusModal.name}</p>
            <div className="mt-5 inline-flex flex-col items-center rounded-2xl bg-[#EFEAFF] p-5 border border-[#5B21B6]/20">
              <div className="rounded-xl bg-white p-3">
                <QRCodeSVG value={qrCampusModal.code} size={180} fgColor="#000831" />
              </div>
              <span className="mt-3 font-mono text-sm font-extrabold text-[#5B21B6]">
                {qrCampusModal.code}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setQrCampusModal(null)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-[#109173] text-sm font-bold text-white hover:bg-[#0B755C] cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <img
            src={lightboxPhoto}
            alt="Evidencia fotográfica ampliada"
            className="max-h-[85vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      )}
    </AppShell>
  );
};
