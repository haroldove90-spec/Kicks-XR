import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  Banknote,
  Bell,
  Building2,
  Camera,
  Check,
  CreditCard,
  ExternalLink,
  Image as ImageIcon,
  ListChecks,
  Lock,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  PlusCircle,
  QrCode,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Truck,
  User,
  UserCheck,
} from 'lucide-react';
import {QRCodeSVG} from 'qrcode.react';
import {api, subscribeToRealtimeUpdates} from '../lib/api';
import type {
  AuthUser,
  DeliveryMethod,
  DropoffMethod,
  NotificationLog,
  Order,
  PaymentMethod,
  PopupAlert,
  PublicConfig,
  PublicOrderTrack,
} from '../types';
import {AppShell, type NavModuleItem} from './AppShell';
import {CameraCaptureModal} from './CameraCaptureModal';
import {NotificationsCenter} from './NotificationsCenter';
import {OrderTimeline} from './OrderTimeline';
import {QRScannerModal} from './QRScannerModal';

interface ClientAppProps {
  user: AuthUser;
  config: PublicConfig;
  onUserUpdated: (user: AuthUser) => void;
  onLogout: () => void;
  onPushAlert: (alert: Omit<PopupAlert, 'id'>) => void;
  onSwitchToAdmin?: () => void;
}

type ClientTab = 'register' | 'track' | 'orders' | 'notifications' | 'profile';
type WizardStep = 1 | 2 | 3 | 4 | 5;

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen no soportado.'));
      img.onload = () => {
        const maxSide = 960;
        let {width, height} = img;
        if (width > maxSide || height > maxSide) {
          if (width > height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la fotografía.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const ClientApp: React.FC<ClientAppProps> = ({
  user,
  config,
  onUserUpdated,
  onLogout,
  onPushAlert,
  onSwitchToAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<ClientTab>('register');
  const [step, setStep] = useState<WizardStep>(1);

  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Integrated Folio Tracker inside Client Role
  const [folioQuery, setFolioQuery] = useState('');
  const [searchedTrack, setSearchedTrack] = useState<PublicOrderTrack | null>(null);
  const [trackSearchError, setTrackSearchError] = useState<string | null>(null);
  const [trackScannerOpen, setTrackScannerOpen] = useState(false);

  // Camera capture modal + gallery file input
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Step 1: Registra tus tenis
  const [clientName, setClientName] = useState(user.name || '');
  const [clientWhatsapp, setClientWhatsapp] = useState(user.whatsapp || '');
  const [pairs, setPairs] = useState(1);
  const [serviceId, setServiceId] = useState(
    config.services.find((s) => s.name.toLowerCase().includes('premium'))?.id ||
      config.services[0]?.id ||
      '',
  );
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);

  // Step 2: Elige la devolución
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup');
  const [campusId, setCampusId] = useState(
    user.campusId || config.campuses[0]?.id || '',
  );
  const [deliveryAddress, setDeliveryAddress] = useState(user.address || '');

  // Step 3: Forma de pago
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cardHolder, setCardHolder] = useState(user.name || '');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Step 4: Entrega tu bolsa
  const [dropoffMethod, setDropoffMethod] = useState<DropoffMethod>('locker');

  // Profile editing
  const [profileName, setProfileName] = useState(user.name || '');
  const [profileWhatsapp, setProfileWhatsapp] = useState(user.whatsapp || '');
  const [profileAddress, setProfileAddress] = useState(user.address || '');
  const [profileSaved, setProfileSaved] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedService = useMemo(
    () => config.services.find((s) => s.id === serviceId) || config.services[0],
    [config.services, serviceId],
  );

  const selectedCampus = useMemo(
    () => config.campuses.find((c) => c.id === campusId) || config.campuses[0],
    [config.campuses, campusId],
  );

  const shippingCost = deliveryMethod === 'delivery' ? config.shippingFee : 0;
  const estimatedTotal = (selectedService?.price || 0) * pairs + shippingCost;

  const fetchMyOrders = useCallback(async () => {
    try {
      const res = await api.getMyOrders();
      setOrders(res.orders);
      setNotifications(res.notifications);
      setActiveOrderId((prev) => prev || res.orders[0]?.id || null);
    } catch {
      // keep existing state on transient error
    }
  }, []);

  useEffect(() => {
    fetchMyOrders();
  }, [fetchMyOrders]);

  // Real-time SSE sync + Global Popups on service & delivery status updates
  useEffect(() => {
    return subscribeToRealtimeUpdates((ev) => {
      if (ev.type === 'orders' || ev.type === 'notifications') {
        fetchMyOrders();
        if (ev.title) {
          onPushAlert({
            title: ev.title,
            message:
              ev.message ||
              (ev.folio
                ? `Tu pedido ${ev.folio} tiene una nueva actualización.`
                : 'Hay una nueva actualización en tus servicios.'),
            tone: 'info',
            actionLabel: 'Rastrear pedido',
            onAction: () => {
              if (ev.folio) setFolioQuery(ev.folio);
              setActiveTab('track');
            },
          });
        }
      }
    });
  }, [fetchMyOrders, onPushAlert]);

  const activeOrder = useMemo(
    () => orders.find((o) => o.id === activeOrderId) || orders[0] || null,
    [orders, activeOrderId],
  );

  const handleTrackSearch = async (rawCode: string) => {
    const cleaned = rawCode.trim();
    if (!cleaned) return;
    const normalized = cleaned.startsWith('KICKSXR|')
      ? cleaned.split('|')[1] || cleaned
      : cleaned;
    setFolioQuery(normalized);
    setTrackSearchError(null);

    // Check own orders first
    const localMatch = orders.find(
      (o) =>
        o.folio.toUpperCase() === normalized.toUpperCase() ||
        o.bagCode.toUpperCase() === normalized.toUpperCase(),
    );
    if (localMatch) {
      setActiveOrderId(localMatch.id);
      setSearchedTrack(null);
      onPushAlert({
        title: `Pedido ${localMatch.folio} encontrado`,
        message: `Estatus actual: ${localMatch.status} · Bolsa ${localMatch.bagCode}`,
        tone: 'success',
      });
      return;
    }

    try {
      const data = await api.trackOrder(normalized);
      setSearchedTrack(data);
      onPushAlert({
        title: `Seguimiento ${data.folio}`,
        message: `Estatus actual: ${data.status} · Bolsa ${data.bagCode}`,
        tone: 'info',
      });
    } catch (err) {
      setSearchedTrack(null);
      setTrackSearchError(
        err instanceof Error
          ? err.message
          : 'No se encontró ese folio o código de bolsa.',
      );
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImageFile(file);
      setPhotoDataUrl(compressed);
      onPushAlert({
        title: 'Fotografía adjuntada',
        message: 'Evidencia inicial del calzado lista para tu registro.',
        tone: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar imagen.');
    }
    e.target.value = '';
  };

  const handleStep1Next = () => {
    setError(null);
    if (clientName.trim().length < 2) {
      setError('Ingresa tu nombre para continuar.');
      return;
    }
    if (clientWhatsapp.replace(/\D/g, '').length < 10) {
      setError('Ingresa un número de WhatsApp válido (10 dígitos).');
      return;
    }
    setStep(2);
  };

  const handleStep2Next = () => {
    setError(null);
    if (deliveryMethod === 'delivery' && deliveryAddress.trim().length < 5) {
      setError('Ingresa la dirección completa para la entrega a domicilio.');
      return;
    }
    setStep(3);
  };

  const handleConfirmOrder = async () => {
    setError(null);
    if (paymentMethod === 'card') {
      const digits = cardNumber.replace(/\D/g, '');
      if (digits.length < 12 || !cardExpiry.trim() || cardCvv.trim().length < 3) {
        setError('Completa los datos de tu tarjeta para procesar el pago en línea.');
        return;
      }
    }

    if (!selectedService || !selectedCampus) {
      setError('Selecciona un servicio y una sede válida antes de confirmar.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createOrder({
        clientName: clientName.trim(),
        clientWhatsapp: clientWhatsapp.trim(),
        pairs,
        serviceId: selectedService.id,
        campusId: selectedCampus.id,
        deliveryMethod,
        deliveryAddress:
          deliveryMethod === 'delivery' ? deliveryAddress.trim() : undefined,
        paymentMethod,
        cardLast4:
          paymentMethod === 'card'
            ? cardNumber.replace(/\D/g, '').slice(-4) || '4242'
            : undefined,
        photoDataUrl,
      });

      setOrders((prev) => [res.order, ...prev]);
      setActiveOrderId(res.order.id);
      setStep(4);
      onPushAlert({
        title: `Pedido ${res.order.folio} confirmado`,
        message: `Bolsa asignada: ${res.order.bagCode}. Ahora selecciona cómo entregarás tu bolsa.`,
        tone: 'success',
      });
      fetchMyOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportDeposit = async () => {
    if (!activeOrder) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.reportDeposit(activeOrder.id, dropoffMethod);
      setOrders((prev) =>
        prev.map((o) => (o.id === res.order.id ? res.order : o)),
      );
      setStep(5);
      onPushAlert({
        title: `Depósito reportado · ${res.order.folio}`,
        message: `Tu bolsa ${res.order.bagCode} fue registrada. Te notificaremos en cada etapa del servicio.`,
        tone: 'success',
      });
      fetchMyOrders();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo reportar el depósito.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const startNewOrder = () => {
    setPairs(1);
    setPhotoDataUrl(undefined);
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setError(null);
    setStep(1);
    setActiveTab('register');
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaved(false);
    setError(null);
    try {
      const res = await api.updateClientProfile({
        name: profileName,
        whatsapp: profileWhatsapp,
        address: profileAddress,
      });
      onUserUpdated(res.user);
      setClientName(res.user.name);
      setClientWhatsapp(res.user.whatsapp || '');
      setDeliveryAddress(res.user.address || '');
      setProfileSaved(true);
      onPushAlert({
        title: 'Perfil actualizado',
        message: 'Tus datos de contacto y entrega fueron guardados.',
        tone: 'success',
      });
      window.setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar tu perfil.');
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
      title: 'Notificaciones al día',
      message: 'Todas tus alertas se marcaron como leídas.',
      tone: 'info',
    });
  };

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const navItems: NavModuleItem[] = [
    {
      id: 'register',
      label: 'Registrar tenis',
      shortLabel: 'Registrar',
      icon: PlusCircle,
    },
    {
      id: 'track',
      label: 'Rastrear pedido',
      shortLabel: 'Rastrear',
      icon: ListChecks,
      badgeCount: orders.filter((o) => o.status !== 'Entregado').length,
    },
    {
      id: 'orders',
      label: 'Mis pedidos',
      shortLabel: 'Pedidos',
      icon: ShoppingBag,
    },
    {
      id: 'notifications',
      label: 'Notificaciones',
      shortLabel: 'Alertas',
      icon: Bell,
      badgeCount: unreadNotifications,
    },
    {
      id: 'profile',
      label: 'Mi perfil',
      shortLabel: 'Perfil',
      icon: User,
    },
  ];

  const orderNotifications = activeOrder
    ? notifications.filter((n) => n.orderId === activeOrder.id)
    : [];

  return (
    <AppShell
      roleLabel={onSwitchToAdmin ? 'Vista Cliente (Admin)' : 'Cliente'}
      userName={user.name}
      navItems={navItems}
      activeNav={activeTab}
      onSelectNav={(id) => {
        setActiveTab(id as ClientTab);
        setError(null);
      }}
      onOpenNotifications={() => setActiveTab('notifications')}
      onLogout={onLogout}
      notifications={notifications}
      switchRoleAction={
        onSwitchToAdmin
          ? {
              label: 'Panel Admin',
              shortLabel: 'Admin',
              onSwitch: onSwitchToAdmin,
            }
          : undefined
      }
    >
      {/* Hidden gallery picker */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="sr-only"
      />

      {/* MODULE: REGISTRAR TENIS (5-Step Flow) */}
      {activeTab === 'register' && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3.5 sm:px-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              {step > 1 && step < 4 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as WizardStep)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-[#000831] hover:bg-slate-50 cursor-pointer"
                  aria-label="Paso anterior"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div>
                <h1 className="font-display text-lg sm:text-xl font-extrabold text-[#000000]">
                  {step === 1 && 'Registra tus tenis'}
                  {step === 2 && 'Elige la devolución'}
                  {step === 3 && 'Forma de pago'}
                  {step === 4 && 'Entrega tu bolsa'}
                  {step === 5 && 'Sigue tu pedido'}
                </h1>
                <p className="text-xs text-slate-500">
                  Paso {step} de 5 · Servicio Kicks XR
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all ${
                    s === step
                      ? 'w-8 bg-[#109173]'
                      : s < step
                        ? 'w-3 bg-[#109173]/50'
                        : 'w-3 bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 xl:col-span-8 rounded-2xl bg-white border border-slate-200 p-5 sm:p-7">
              {/* STEP 1 */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-[#000831] mb-1.5">
                        Nombre
                      </label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="Tu nombre"
                          className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-[#000831] mb-1.5">
                        WhatsApp
                      </label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="tel"
                          value={clientWhatsapp}
                          onChange={(e) => setClientWhatsapp(e.target.value)}
                          placeholder="55 1234 5678"
                          className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-[#000831] mb-1.5">
                        Pares
                      </label>
                      <select
                        value={pairs}
                        onChange={(e) => setPairs(Number(e.target.value))}
                        className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                      >
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            {n} {n === 1 ? 'par' : 'pares'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-[#000831] mb-1.5">
                        Servicio
                      </label>
                      <select
                        value={serviceId}
                        onChange={(e) => setServiceId(e.target.value)}
                        className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                      >
                        {config.services.map((svc) => (
                          <option key={svc.id} value={svc.id}>
                            {svc.name} — ${svc.price} MXN
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedService && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-start gap-3">
                      <Sparkles className="h-4 w-4 text-[#109173] mt-0.5 shrink-0" />
                      <div className="text-xs text-slate-600">
                        <span className="font-bold text-[#000831]">
                          {selectedService.name}
                        </span>{' '}
                        · {selectedService.description} (Entrega estimada:{' '}
                        {selectedService.turnaroundHours} h)
                      </div>
                    </div>
                  )}

                  {/* Evidencia fotográfica con permiso de cámara del dispositivo + galería */}
                  <div>
                    <label className="block text-sm font-bold text-[#000831] mb-1.5">
                      Evidencia fotográfica del estado inicial
                    </label>
                    {photoDataUrl ? (
                      <div className="relative overflow-hidden rounded-2xl border border-[#5B21B6]/25 bg-[#EFEAFF]/40 p-3">
                        <img
                          src={photoDataUrl}
                          alt="Evidencia inicial del calzado"
                          className="h-52 w-full rounded-xl object-cover"
                        />
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#000831]">
                            Foto cargada correctamente
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setCameraModalOpen(true)}
                              className="inline-flex items-center gap-1.5 min-h-[38px] rounded-lg border border-[#109173]/30 bg-white px-3 text-xs font-semibold text-[#109173] hover:bg-[#E6F7F3] cursor-pointer"
                            >
                              <Camera className="h-3.5 w-3.5" />
                              <span>Nueva foto</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPhotoDataUrl(undefined)}
                              className="inline-flex items-center gap-1.5 min-h-[38px] rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Quitar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border-2 border-dashed border-[#5B21B6]/35 bg-[#EFEAFF]/65 p-5 text-center space-y-3">
                        <Camera className="h-8 w-8 text-[#5B21B6] mx-auto" />
                        <div>
                          <div className="font-display text-sm font-bold text-[#5B21B6]">
                            Agregar foto de tus tenis
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600">
                            Activa la cámara de tu dispositivo para tomar la foto o selecciona una de tu galería
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setCameraModalOpen(true)}
                            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#5B21B6] px-4 text-xs sm:text-sm font-bold text-white hover:bg-[#4C1D95] transition-colors cursor-pointer"
                          >
                            <Camera className="h-4 w-4" />
                            <span>Tomar foto con cámara</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#5B21B6]/30 bg-white px-4 text-xs sm:text-sm font-bold text-[#000831] hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <ImageIcon className="h-4 w-4 text-[#5B21B6]" />
                            <span>Subir desde galería</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleStep1Next}
                    className="w-full min-h-[50px] rounded-xl bg-[#109173] px-6 text-base font-bold text-white hover:bg-[#0B755C] transition-colors cursor-pointer"
                  >
                    Continuar
                  </button>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('pickup')}
                    className={`w-full flex items-center gap-4 rounded-2xl p-5 text-left border-2 transition-all cursor-pointer ${
                      deliveryMethod === 'pickup'
                        ? 'border-[#109173] bg-[#E6F7F3]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        deliveryMethod === 'pickup'
                          ? 'border-[#109173]'
                          : 'border-slate-300'
                      }`}
                    >
                      {deliveryMethod === 'pickup' && (
                        <span className="h-3 w-3 rounded-full bg-[#109173]" />
                      )}
                    </span>
                    <Store className="h-7 w-7 text-[#5B21B6] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-base font-extrabold text-[#000000]">
                        Recoger en el punto
                      </div>
                      <div className="text-sm text-slate-600">
                        En el punto o sede KicksXR (Sin costo de envío)
                      </div>
                    </div>
                  </button>

                  {deliveryMethod === 'pickup' && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                      <label className="block text-sm font-bold text-[#000831] mb-1.5">
                        Selecciona el punto KicksXR
                      </label>
                      <select
                        value={campusId}
                        onChange={(e) => setCampusId(e.target.value)}
                        className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-[#000831] focus:border-[#109173] focus:outline-none"
                      >
                        {config.campuses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {c.address}
                          </option>
                        ))}
                      </select>
                      {selectedCampus && (
                        <p className="mt-2 text-xs text-slate-600">
                          Lockers autoservicio disponibles en esta sede:{' '}
                          <strong className="font-mono text-[#109173]">
                            {config.availableLockersByCampus[selectedCampus.id] ?? 0}
                          </strong>
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('delivery')}
                    className={`w-full flex items-center gap-4 rounded-2xl p-5 text-left border-2 transition-all cursor-pointer ${
                      deliveryMethod === 'delivery'
                        ? 'border-[#109173] bg-[#E6F7F3]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        deliveryMethod === 'delivery'
                          ? 'border-[#109173]'
                          : 'border-slate-300'
                      }`}
                    >
                      {deliveryMethod === 'delivery' && (
                        <span className="h-3 w-3 rounded-full bg-[#109173]" />
                      )}
                    </span>
                    <Truck className="h-7 w-7 text-[#5B21B6] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-base font-extrabold text-[#000000]">
                          Entrega a domicilio
                        </span>
                        <span className="font-mono text-xs font-bold text-[#109173] tabular-nums">
                          +${config.shippingFee} MXN
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        En tu dirección registrada
                      </div>
                    </div>
                  </button>

                  {deliveryMethod === 'delivery' && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                      <div>
                        <label className="block text-sm font-bold text-[#000831] mb-1.5">
                          Dirección de entrega
                        </label>
                        <div className="relative">
                          <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Calle, número exterior/interior, colonia, CP"
                            className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Sede de depósito inicial de la bolsa
                        </label>
                        <select
                          value={campusId}
                          onChange={(e) => setCampusId(e.target.value)}
                          className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#000831]"
                        >
                          {config.campuses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleStep2Next}
                    className="w-full min-h-[50px] rounded-xl bg-[#109173] px-6 text-base font-bold text-white hover:bg-[#0B755C] transition-colors cursor-pointer"
                  >
                    Continuar
                  </button>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`w-full flex items-center gap-4 rounded-2xl p-5 text-left border-2 transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'border-[#109173] bg-[#E6F7F3]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        paymentMethod === 'cash'
                          ? 'border-[#109173]'
                          : 'border-slate-300'
                      }`}
                    >
                      {paymentMethod === 'cash' && (
                        <span className="h-3 w-3 rounded-full bg-[#109173]" />
                      )}
                    </span>
                    <Banknote className="h-7 w-7 text-[#5B21B6] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-lg font-extrabold text-[#000000]">
                        Efectivo
                      </div>
                      <div className="text-sm text-slate-600">
                        Queda como Pago pendiente para liquidar en entrega o recolección
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`w-full flex items-center gap-4 rounded-2xl p-5 text-left border-2 transition-all cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'border-[#109173] bg-[#E6F7F3]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        paymentMethod === 'card'
                          ? 'border-[#109173]'
                          : 'border-slate-300'
                      }`}
                    >
                      {paymentMethod === 'card' && (
                        <span className="h-3 w-3 rounded-full bg-[#109173]" />
                      )}
                    </span>
                    <CreditCard className="h-7 w-7 text-[#5B21B6] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-lg font-extrabold text-[#000000]">
                        Tarjeta
                      </div>
                      <div className="text-sm text-slate-600">
                        Cobro en línea inmediato con tarjeta de crédito o débito
                      </div>
                    </div>
                  </button>

                  {paymentMethod === 'card' && (
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 sm:p-5 space-y-3.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5 text-[#109173]" />
                          Pasarela de pago en línea
                        </span>
                        <span>Visa · Mastercard · AMEX</span>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#000831] mb-1">
                          Titular de la tarjeta
                        </label>
                        <input
                          type="text"
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)}
                          placeholder="Nombre como aparece en la tarjeta"
                          className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#000831]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#000831] mb-1">
                          Número de tarjeta
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={19}
                          value={cardNumber}
                          onChange={(e) =>
                            setCardNumber(
                              e.target.value
                                .replace(/\D/g, '')
                                .replace(/(.{4})/g, '$1 ')
                                .trim(),
                            )
                          }
                          placeholder="4242 4242 4242 4242"
                          className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-mono text-[#000831]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#000831] mb-1">
                            Vencimiento
                          </label>
                          <input
                            type="text"
                            maxLength={5}
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="12/28"
                            className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-mono text-[#000831]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#000831] mb-1">
                            CVV
                          </label>
                          <input
                            type="password"
                            maxLength={4}
                            value={cardCvv}
                            onChange={(e) =>
                              setCardCvv(e.target.value.replace(/\D/g, ''))
                            }
                            placeholder="123"
                            className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-mono text-[#000831]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleConfirmOrder}
                    className="w-full min-h-[50px] rounded-xl bg-[#109173] px-6 text-base font-bold text-white hover:bg-[#0B755C] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {submitting
                      ? 'Confirmando pedido...'
                      : `Confirmar pedido · $${estimatedTotal} MXN`}
                  </button>
                </div>
              )}

              {/* STEP 4 */}
              {step === 4 && activeOrder && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setDropoffMethod('staff')}
                      className={`flex items-start gap-3.5 rounded-2xl p-5 text-left border-2 transition-all cursor-pointer ${
                        dropoffMethod === 'staff'
                          ? 'border-[#109173] bg-[#E6F7F3]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <UserCheck className="h-7 w-7 text-[#5B21B6] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-display text-base font-extrabold text-[#000000]">
                          Con personal
                        </div>
                        <p className="mt-1 text-sm text-slate-600 leading-snug">
                          Entrega tu bolsa directamente al equipo de KicksXR en el punto.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDropoffMethod('locker')}
                      className={`flex items-start gap-3.5 rounded-2xl p-5 text-left border-2 transition-all cursor-pointer ${
                        dropoffMethod === 'locker'
                          ? 'border-[#109173] bg-[#E6F7F3]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <Package className="h-7 w-7 text-[#5B21B6] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-display text-base font-extrabold text-[#000000]">
                          Autoservicio
                        </div>
                        <p className="mt-1 text-sm text-slate-600 leading-snug">
                          Deposita tu bolsa en el locker de KicksXR con tu código de bolsa.
                        </p>
                        {activeOrder.assignedLockerCode && (
                          <p className="mt-2 font-mono text-xs font-bold text-[#109173]">
                            Locker sugerido: {activeOrder.assignedLockerCode}
                          </p>
                        )}
                      </div>
                    </button>
                  </div>

                  <div className="rounded-2xl bg-[#EFEAFF] border border-[#5B21B6]/20 p-5 flex flex-col sm:flex-row items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#5B21B6] shrink-0">
                        <ShoppingBag className="h-7 w-7" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-600">
                          Código de bolsa asignado
                        </div>
                        <div className="font-mono text-3xl font-extrabold text-[#000831] tabular-nums">
                          {activeOrder.bagCode}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          Folio:{' '}
                          <strong className="font-mono text-[#000831]">
                            {activeOrder.folio}
                          </strong>{' '}
                          · {activeOrder.campusName}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center rounded-xl bg-white p-3 border border-slate-200">
                      <QRCodeSVG
                        value={activeOrder.orderQrPayload}
                        size={112}
                        fgColor="#000831"
                        level="M"
                      />
                      <span className="mt-1.5 font-mono text-[11px] font-bold text-[#5B21B6]">
                        QR de pedido
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleReportDeposit}
                    className="w-full min-h-[50px] rounded-xl bg-[#109173] px-6 text-base font-bold text-white hover:bg-[#0B755C] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {submitting
                      ? 'Registrando depósito...'
                      : 'Ya entregué / deposité mi bolsa'}
                  </button>
                </div>
              )}

              {/* STEP 5 */}
              {step === 5 && activeOrder && (
                <div className="space-y-6">
                  <div className="rounded-2xl bg-[#EFEAFF] p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#5B21B6]">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-600">
                          Folio
                        </div>
                        <div className="font-mono text-2xl font-extrabold text-[#000831] tabular-nums">
                          {activeOrder.folio}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-600">Código de bolsa</div>
                      <div className="font-mono text-lg font-bold text-[#5B21B6]">
                        {activeOrder.bagCode}
                      </div>
                    </div>
                  </div>

                  <OrderTimeline
                    currentStatus={activeOrder.status}
                    history={activeOrder.history}
                  />

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="button"
                      onClick={startNewOrder}
                      className="min-h-[46px] flex-1 rounded-xl bg-[#109173] px-5 text-sm font-bold text-white hover:bg-[#0B755C] transition-colors cursor-pointer"
                    >
                      Registrar otro par
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="min-h-[46px] rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-[#000831] hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Ver mis pedidos
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Live Summary */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-4">
              <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
                <h2 className="font-display text-base font-bold text-[#000000]">
                  Resumen del servicio
                </h2>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Servicio</span>
                    <span className="font-semibold text-[#000831] text-right">
                      {selectedService?.name}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Cantidad</span>
                    <span className="font-semibold text-[#000831] tabular-nums">
                      {pairs} {pairs === 1 ? 'par' : 'pares'} × $
                      {selectedService?.price || 0}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Devolución</span>
                    <span className="font-semibold text-[#000831] text-right">
                      {deliveryMethod === 'delivery'
                        ? `Domicilio (+$${config.shippingFee})`
                        : selectedCampus?.name || 'Punto KicksXR'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Pago</span>
                    <span className="font-semibold text-[#000831]">
                      {paymentMethod === 'card' ? 'Tarjeta en línea' : 'Efectivo'}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                    <span className="font-bold text-[#000831]">Total</span>
                    <span className="font-mono text-2xl font-extrabold text-[#109173] tabular-nums">
                      ${estimatedTotal} MXN
                    </span>
                  </div>
                </div>
              </div>

              {selectedCampus && (
                <div className="rounded-2xl bg-[#000831] text-white p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#E6F7F3]">
                    <Building2 className="h-4 w-4 text-[#109173]" />
                    <span>Punto seleccionado</span>
                  </div>
                  <div className="mt-1.5 font-display text-base font-bold">
                    {selectedCampus.name}
                  </div>
                  <p className="mt-1 text-xs text-white/75">
                    {selectedCampus.address}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODULE: RASTREAR PEDIDO (Active inside Cliente Role with Folio Search + QR Scanner + Own Orders) */}
      {activeTab === 'track' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-[#000000]">
                Rastrear pedido
              </h1>
              <p className="text-sm text-slate-600">
                Consulta tus pedidos en tiempo real o busca cualquier folio / código de bolsa
              </p>
            </div>
            {orders.length > 0 && (
              <select
                value={searchedTrack ? '' : activeOrder?.id || ''}
                onChange={(e) => {
                  setSearchedTrack(null);
                  setActiveOrderId(e.target.value);
                }}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-mono font-bold text-[#000831]"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.folio} · Bolsa {o.bagCode} ({o.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Search & QR Scan Bar inside Client Role */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTrackSearch(folioQuery);
            }}
            className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col sm:flex-row gap-2.5"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={folioQuery}
                onChange={(e) => setFolioQuery(e.target.value)}
                placeholder="Buscar por Folio (ej. KXR-1042) o Bolsa (B-028)"
                className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm font-mono uppercase text-[#000831] focus:border-[#109173] focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTrackScannerOpen(true)}
                className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#5B21B6]/30 bg-[#EFEAFF] px-4 text-sm font-bold text-[#5B21B6] hover:bg-[#5B21B6] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <QrCode className="h-4 w-4" />
                <span>Escanear QR</span>
              </button>
              <button
                type="submit"
                className="min-h-[46px] flex-1 sm:flex-none rounded-xl bg-[#109173] px-6 text-sm font-bold text-white hover:bg-[#0B755C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Rastrear
              </button>
            </div>
          </form>

          {trackSearchError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {trackSearchError}
            </div>
          )}

          {searchedTrack ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl bg-[#EFEAFF] p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#5B21B6]">
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-600">
                        Folio consultado
                      </div>
                      <div className="font-mono text-2xl font-extrabold text-[#000831] tabular-nums">
                        {searchedTrack.folio}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-bold text-[#5B21B6]">
                    {searchedTrack.bagCode}
                  </span>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sede</span>
                    <span className="font-semibold text-[#000831]">
                      {searchedTrack.campusName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Servicio</span>
                    <span className="font-semibold text-[#000831]">
                      {searchedTrack.serviceName} ({searchedTrack.pairs}{' '}
                      {searchedTrack.pairs === 1 ? 'par' : 'pares'})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pago</span>
                    <span className="font-bold text-[#109173]">
                      {searchedTrack.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
                <h2 className="font-display text-base font-bold text-[#000000] mb-4">
                  Progreso en tiempo real
                </h2>
                <OrderTimeline
                  currentStatus={searchedTrack.status}
                  history={searchedTrack.history}
                />
              </div>
            </div>
          ) : !activeOrder ? (
            <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center">
              <ShoppingBag className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h2 className="font-display text-lg font-bold text-[#000831]">
                Aún no tienes pedidos registrados
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Registra tus tenis o ingresa arriba un folio como KXR-1042 para ver el rastreo en vivo.
              </p>
              <button
                type="button"
                onClick={startNewOrder}
                className="mt-5 min-h-[46px] rounded-xl bg-[#109173] px-6 text-sm font-bold text-white hover:bg-[#0B755C] cursor-pointer"
              >
                Registrar mis tenis
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl bg-[#EFEAFF] p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#5B21B6]">
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-600">
                        Folio
                      </div>
                      <div className="font-mono text-2xl font-extrabold text-[#000831] tabular-nums">
                        {activeOrder.folio}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white p-2 border border-slate-200">
                    <QRCodeSVG
                      value={activeOrder.orderQrPayload}
                      size={72}
                      fgColor="#000831"
                    />
                  </div>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Código de bolsa</span>
                    <span className="font-mono font-bold text-[#5B21B6]">
                      {activeOrder.bagCode}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Servicio</span>
                    <span className="font-semibold text-[#000831]">
                      {activeOrder.serviceName} ({activeOrder.pairs}{' '}
                      {activeOrder.pairs === 1 ? 'par' : 'pares'})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sede</span>
                    <span className="font-semibold text-[#000831]">
                      {activeOrder.campusName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total y Pago</span>
                    <span className="font-mono font-bold text-[#000831] tabular-nums">
                      ${activeOrder.totalAmount} · {activeOrder.paymentStatus}
                    </span>
                  </div>

                  {activeOrder.status === 'Pendiente de depósito' && (
                    <button
                      type="button"
                      onClick={() => {
                        setStep(4);
                        setActiveTab('register');
                      }}
                      className="mt-2 w-full min-h-[44px] rounded-xl bg-[#109173] text-sm font-bold text-white hover:bg-[#0B755C] cursor-pointer"
                    >
                      Reportar depósito de bolsa
                    </button>
                  )}

                  {activeOrder.photoDataUrl && (
                    <div className="pt-2">
                      <div className="text-xs font-semibold text-slate-500 mb-1.5">
                        Evidencia fotográfica inicial
                      </div>
                      <img
                        src={activeOrder.photoDataUrl}
                        alt={`Calzado ${activeOrder.folio}`}
                        className="h-40 w-full rounded-xl object-cover border border-slate-200"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
                  <h2 className="font-display text-base font-bold text-[#000000] mb-4">
                    Progreso en tiempo real
                  </h2>
                  <OrderTimeline
                    currentStatus={activeOrder.status}
                    history={activeOrder.history}
                  />
                </div>

                {orderNotifications.length > 0 && (
                  <div className="rounded-2xl bg-white border border-slate-200 p-5">
                    <h3 className="font-display text-sm font-bold text-[#000000] mb-3">
                      Alertas WhatsApp del pedido
                    </h3>
                    <div className="space-y-2.5">
                      {orderNotifications.slice(0, 4).map((n) => (
                        <div
                          key={n.id}
                          className="rounded-xl bg-slate-50 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-bold text-[#000831]">{n.title}</div>
                            <p className="text-slate-600 mt-0.5">{n.message}</p>
                          </div>
                          {n.whatsappUrl && (
                            <a
                              href={n.whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#109173] font-bold shrink-0 hover:underline"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>WhatsApp</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODULE: MIS PEDIDOS */}
      {activeTab === 'orders' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-extrabold text-[#000000]">
              Mis pedidos
            </h1>
            <button
              type="button"
              onClick={startNewOrder}
              className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-[#109173] px-4 text-sm font-bold text-white hover:bg-[#0B755C] cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Nuevo pedido</span>
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-500">
              No tienes pedidos aún.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-lg font-extrabold text-[#000831] tabular-nums">
                          {order.folio}
                        </div>
                        <div className="text-xs text-slate-500">
                          Bolsa{' '}
                          <span className="font-mono font-bold text-[#5B21B6]">
                            {order.bagCode}
                          </span>{' '}
                          · {order.campusName}
                        </div>
                      </div>
                      <span
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                          order.status === 'Entregado'
                            ? 'bg-[#E6F7F3] text-[#109173]'
                            : order.status === 'En limpieza'
                              ? 'bg-[#E6F7F3] text-[#000831]'
                              : 'bg-[#EFEAFF] text-[#5B21B6]'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="mt-4 space-y-1.5 text-sm text-slate-700">
                      <div>
                        <strong>{order.serviceName}</strong> · {order.pairs}{' '}
                        {order.pairs === 1 ? 'par' : 'pares'}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {order.deliveryMethod === 'delivery'
                            ? 'Entrega a domicilio'
                            : 'Recoger en punto'}
                        </span>
                        <span className="font-mono font-bold text-[#000831] tabular-nums">
                          ${order.totalAmount} · {order.paymentStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchedTrack(null);
                        setActiveOrderId(order.id);
                        setActiveTab('track');
                      }}
                      className="flex-1 min-h-[42px] rounded-xl bg-[#109173] text-xs font-bold text-white hover:bg-[#0B755C] cursor-pointer"
                    >
                      Rastrear pedido
                    </button>
                    {order.status === 'Pendiente de depósito' && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveOrderId(order.id);
                          setStep(4);
                          setActiveTab('register');
                        }}
                        className="min-h-[42px] rounded-xl border border-[#5B21B6]/30 bg-[#EFEAFF] px-3 text-xs font-bold text-[#5B21B6] cursor-pointer"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODULE: NOTIFICACIONES */}
      {activeTab === 'notifications' && (
        <NotificationsCenter
          notifications={notifications}
          onMarkRead={handleMarkNotificationRead}
          onMarkAllRead={handleMarkAllRead}
          onPushAlert={onPushAlert}
          onOpenFolio={(folio) => {
            setActiveTab('track');
            handleTrackSearch(folio);
          }}
        />
      )}

      {/* MODULE: MI PERFIL */}
      {activeTab === 'profile' && (
        <div className="max-w-2xl rounded-2xl bg-white border border-slate-200 p-6 sm:p-8">
          <h1 className="font-display text-2xl font-extrabold text-[#000000]">
            Mi perfil
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Tus datos se autocompletan al registrar nuevos tenis y recibir avisos por WhatsApp.
          </p>

          {profileSaved && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#E6F7F3] px-4 py-3 text-sm font-semibold text-[#109173]">
              <Check className="h-4 w-4" />
              <span>Perfil actualizado correctamente.</span>
            </div>
          )}

          <form onSubmit={handleProfileSave} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#000831] mb-1.5">
                Nombre completo
              </label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#000831] mb-1.5">
                WhatsApp
              </label>
              <input
                type="tel"
                required
                value={profileWhatsapp}
                onChange={(e) => setProfileWhatsapp(e.target.value)}
                className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#000831] mb-1.5">
                Dirección de entrega predeterminada
              </label>
              <input
                type="text"
                value={profileAddress}
                onChange={(e) => setProfileAddress(e.target.value)}
                placeholder="Calle, número, colonia, CP"
                className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="min-h-[48px] rounded-xl bg-[#109173] px-6 text-sm font-bold text-white hover:bg-[#0B755C] transition-colors cursor-pointer"
            >
              Guardar cambios
            </button>
          </form>
        </div>
      )}

      {/* Camera Permission & Capture Modal */}
      <CameraCaptureModal
        open={cameraModalOpen}
        onCapture={(dataUrl) => {
          setPhotoDataUrl(dataUrl);
          onPushAlert({
            title: 'Fotografía capturada',
            message: 'Tu foto de evidencia inicial se cargó correctamente.',
            tone: 'success',
          });
        }}
        onFallbackGallery={() => galleryInputRef.current?.click()}
        onClose={() => setCameraModalOpen(false)}
      />

      {/* QR Scanner for Tracking inside Cliente */}
      <QRScannerModal
        open={trackScannerOpen}
        title="Escanear QR de pedido"
        subtitle="Escanea el código QR de tu pedido para ver su estatus en vivo"
        placeholder="KXR-1042"
        quickOptions={[
          {label: 'Folio KXR-1042', sublabel: 'Bolsa B-028', value: 'KXR-1042'},
          {label: 'Folio KXR-1043', sublabel: 'Bolsa B-029', value: 'KXR-1043'},
          {label: 'Folio KXR-1041', sublabel: 'Bolsa B-027', value: 'KXR-1041'},
        ]}
        onScan={(val) => {
          setTrackScannerOpen(false);
          handleTrackSearch(val);
        }}
        onClose={() => setTrackScannerOpen(false)}
      />
    </AppShell>
  );
};
