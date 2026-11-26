import React, {useEffect} from 'react';
import {
  Calendar,
  Camera,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  ImageOff,
  Lock,
  MapPin,
  MessageSquare,
  Package,
  Pencil,
  QrCode,
  Receipt,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Truck,
  User,
  X,
  ZoomIn,
} from 'lucide-react';
import {QRCodeSVG} from 'qrcode.react';
import {
  formatPaymentMethodLabel,
  isSafeGoogleMapsUrl,
} from '../lib/qrPayload';
import type {Order} from '../types';
import {OrderTimeline} from './OrderTimeline';

export const SAFE_IMAGE_DATA_URL_RE =
  /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function isSafePhotoDataUrl(url?: string | null): url is string {
  return typeof url === 'string' && SAFE_IMAGE_DATA_URL_RE.test(url);
}

interface AdminOrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onZoomPhoto: (payload: {
    url: string;
    title: string;
    subtitle: string;
    filename: string;
  }) => void;
  onManageOrder?: (order: Order) => void;
  onOpenReceipt?: (order: Order) => void;
}

export const AdminOrderDetailModal: React.FC<AdminOrderDetailModalProps> = ({
  order,
  onClose,
  onZoomPhoto,
  onManageOrder,
  onOpenReceipt,
}) => {
  useEffect(() => {
    if (!order) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [order, onClose]);

  if (!order) return null;

  const hasBeforePhoto = isSafePhotoDataUrl(order.photoDataUrl);
  const hasAfterPhoto = isSafePhotoDataUrl(order.afterPhotoDataUrl);
  const subtotal = order.unitPrice * order.pairs;
  const discount = order.discountAmount || 0;
  const whatsappDigits = (order.clientWhatsapp || '').replace(/\D/g, '');
  const waPhone = whatsappDigits.length === 10 ? `52${whatsappDigits}` : whatsappDigits;
  const statusMessage = `¡Hola ${order.clientName}! Homeli te informa sobre tu pedido ${order.folio} (Bolsa ${order.bagCode} · ${order.serviceName}): su estatus actual es "${order.status}". Total: $${order.totalAmount} MXN (${order.paymentStatus}).`;
  const waStatusUrl = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(statusMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(statusMessage)}`;

  const dropoffLabel =
    order.dropoffMethod === 'locker'
      ? `Locker autoservicio${order.assignedLockerCode ? ` (${order.assignedLockerCode})` : ''}`
      : order.dropoffMethod === 'staff'
        ? 'Entregado con personal en punto'
        : 'Aún no reportado por el cliente';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1E2A]/70 p-3 sm:p-5 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle del pedido ${order.folio}`}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 bg-[#1A1E2A] px-5 py-4 text-white shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg sm:text-xl font-extrabold tracking-tight">
                {order.folio}
              </span>
              <span className="rounded-lg bg-white/15 px-2.5 py-0.5 font-mono text-xs font-bold text-[#FCF61C]">
                Bolsa {order.bagCode}
              </span>
              <span
                className={`rounded-lg px-2.5 py-0.5 text-xs font-bold text-white ${
                  order.status === 'Cancelado' ? 'bg-red-600' : 'bg-[#8BAF03]'
                }`}
              >
                {order.status}
              </span>
              {order.rating && (
                <span className="rounded-lg bg-amber-400/20 text-amber-300 px-2 py-0.5 font-mono text-xs font-bold">
                  {order.rating}★
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-white/75 truncate">
              {order.clientName} · {order.serviceName} ({order.pairs}{' '}
              {order.pairs === 1 ? 'par' : 'pares'})
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors shrink-0 cursor-pointer"
            aria-label="Cerrar detalle del pedido"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Before / After Sneaker Photos */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#1A1E2A]">
                <Camera className="h-4 w-4 text-[#5E7800]" />
                <span>Evidencia fotográfica · Antes y Después</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                {hasBeforePhoto && hasAfterPhoto
                  ? 'Comparativa completa'
                  : hasBeforePhoto
                    ? 'Solo foto inicial (Antes)'
                    : hasAfterPhoto
                      ? 'Solo resultado final (Después)'
                      : 'Sin fotografías'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BEFORE */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 flex flex-col">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#1A1E2A]">
                    Antes (enviada por cliente)
                  </span>
                </div>
                {hasBeforePhoto ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        onZoomPhoto({
                          url: order.photoDataUrl!,
                          title: `Antes · ${order.folio} (${order.bagCode})`,
                          subtitle: `${order.clientName} · ${order.serviceName}`,
                          filename: `${order.folio}-antes.jpg`,
                        })
                      }
                      className="group relative flex-1 min-h-[190px] max-h-[240px] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer"
                    >
                      <img
                        src={order.photoDataUrl}
                        alt={`Antes ${order.folio}`}
                        className="max-h-[236px] w-full object-contain group-hover:scale-[1.03] transition-transform"
                      />
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-[#1A1E2A]/85 px-2.5 py-1 text-[11px] font-bold text-white">
                        <ZoomIn className="h-3.5 w-3.5" />
                        <span>Ampliar</span>
                      </span>
                    </button>
                    <a
                      href={order.photoDataUrl}
                      download={`${order.folio}-antes.jpg`}
                      className="min-h-[34px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-[#1A1E2A] hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5 text-[#5E7800]" />
                      <span>Descargar foto Antes</span>
                    </a>
                  </>
                ) : (
                  <div className="flex-1 min-h-[190px] rounded-lg border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-4 text-center text-xs text-slate-500">
                    <ImageOff className="h-6 w-6 text-slate-300 mb-1.5" />
                    <span>Sin foto inicial adjunta</span>
                  </div>
                )}
              </div>

              {/* AFTER */}
              <div className="rounded-xl border border-[#8BAF03]/30 bg-white p-3 space-y-2.5 flex flex-col">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#5E7800] inline-flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Después (resultado limpio)</span>
                  </span>
                </div>
                {hasAfterPhoto ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        onZoomPhoto({
                          url: order.afterPhotoDataUrl!,
                          title: `Después · ${order.folio} (${order.bagCode})`,
                          subtitle: `${order.clientName} · ${order.serviceName}`,
                          filename: `${order.folio}-despues.jpg`,
                        })
                      }
                      className="group relative flex-1 min-h-[190px] max-h-[240px] w-full overflow-hidden rounded-lg border border-[#8BAF03]/25 bg-[#F3F8DE]/25 flex items-center justify-center cursor-pointer"
                    >
                      <img
                        src={order.afterPhotoDataUrl}
                        alt={`Después ${order.folio}`}
                        className="max-h-[236px] w-full object-contain group-hover:scale-[1.03] transition-transform"
                      />
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-[#8BAF03] px-2.5 py-1 text-[11px] font-extrabold text-[#1A1E2A]">
                        <ZoomIn className="h-3.5 w-3.5" />
                        <span>Ampliar</span>
                      </span>
                    </button>
                    <a
                      href={order.afterPhotoDataUrl}
                      download={`${order.folio}-despues.jpg`}
                      className="min-h-[34px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#8BAF03]/30 bg-[#F3F8DE] px-3 text-xs font-bold text-[#5E7800] hover:bg-[#8BAF03] hover:text-[#1A1E2A] transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Descargar foto Después</span>
                    </a>
                  </>
                ) : (
                  <div className="flex-1 min-h-[190px] rounded-lg border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-4 text-center text-xs text-slate-500">
                    <Sparkles className="h-6 w-6 text-slate-300 mb-1.5" />
                    <span>Aún no se carga foto del resultado final</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes + Rating Row (when present) */}
          {(order.shoeNotes || order.adminNotes || order.rating) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {order.shoeNotes && (
                <div className="rounded-xl border border-[#8BAF03]/25 bg-[#F3F8DE]/40 p-4 text-xs space-y-1">
                  <div className="font-extrabold uppercase tracking-wider text-[#1A1E2A] flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#5E7800]" />
                    <span>Notas del cliente sobre el calzado</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{order.shoeNotes}</p>
                </div>
              )}
              {order.adminNotes && (
                <div className="rounded-xl border border-[#8BAF03]/25 bg-[#FCF61C]/15 p-4 text-xs space-y-1">
                  <div className="font-extrabold uppercase tracking-wider text-[#1A1E2A] flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Notas internas de taller</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{order.adminNotes}</p>
                </div>
              )}
              {order.rating && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs space-y-1 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                      <span>Calificación del cliente</span>
                    </span>
                    <span className="font-mono text-sm font-extrabold text-amber-600">
                      {'★'.repeat(order.rating)}
                      {'☆'.repeat(5 - order.rating)} ({order.rating}/5)
                    </span>
                  </div>
                  {order.ratingComment && (
                    <p className="text-slate-700 italic">"{order.ratingComment}"</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Billing + Client Info */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#1A1E2A]">
                <Package className="h-4 w-4 text-[#5E7800]" />
                <span>Detalles del servicio y cobro</span>
              </div>

              <div className="rounded-xl bg-[#F3F8DE]/70 border border-[#8BAF03]/20 p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-600">
                    Servicio contratado
                  </div>
                  <div className="font-display text-base font-extrabold text-[#1A1E2A]">
                    {order.serviceName}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-extrabold text-[#5E7800]">
                    {order.pairs} {order.pairs === 1 ? 'par' : 'pares'}
                  </div>
                  <div className="font-mono text-xs text-slate-600 tabular-nums">
                    ${order.unitPrice} c/u
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm pt-1">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">
                    Subtotal ({order.pairs} × ${order.unitPrice})
                  </span>
                  <span className="font-mono font-semibold text-[#1A1E2A] tabular-nums">
                    ${subtotal} MXN
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between gap-2 text-[#5E7800]">
                    <span>Cupón ({order.discountCode || 'Descuento'})</span>
                    <span className="font-mono font-bold tabular-nums">
                      -${discount} MXN
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Envío a domicilio</span>
                  <span className="font-mono font-semibold text-[#1A1E2A] tabular-nums">
                    {order.shippingFee > 0 ? `$${order.shippingFee} MXN` : 'Sin costo'}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t border-slate-100 pt-2">
                  <span className="font-bold text-[#1A1E2A]">Total del pedido</span>
                  <span className="font-mono text-lg font-extrabold text-[#5E7800] tabular-nums">
                    ${order.totalAmount} MXN
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <div className="text-slate-500 font-medium">Método de pago</div>
                  <div className="mt-0.5 font-bold text-[#1A1E2A] flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-[#5E7800]" />
                    <span>
                      {formatPaymentMethodLabel(
                        order.paymentMethod,
                        order.cardLast4,
                      )}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <div className="text-slate-500 font-medium">Estado de pago</div>
                  <div
                    className={`mt-0.5 font-bold flex items-center gap-1.5 ${
                      order.paymentStatus === 'Pagado'
                        ? 'text-[#5E7800]'
                        : 'text-[#1A1E2A]'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{order.paymentStatus}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 text-sm">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#1A1E2A]">
                  <User className="h-4 w-4 text-[#5E7800]" />
                  <span>Datos del cliente</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Nombre</span>
                  <span className="font-bold text-[#1A1E2A] text-right">
                    {order.clientName}
                    {order.clientAge ? ` · ${order.clientAge} años` : ''}
                  </span>
                </div>
                {order.clientIdDocument && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">INE / Pasaporte</span>
                    <span className="font-mono font-bold text-[#5E7800] text-right">
                      {order.clientIdDocument}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">WhatsApp</span>
                  {whatsappDigits ? (
                    <a
                      href={`https://wa.me/${waPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono font-bold text-[#5E7800] hover:underline"
                    >
                      <span>{order.clientWhatsapp}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="font-mono text-slate-600">—</span>
                  )}
                </div>
                {(order.deliveryAddress || order.clientAddress) && (
                  <div className="pt-1 border-t border-slate-100">
                    <div className="text-xs text-slate-500 mb-0.5">
                      Dirección registrada
                    </div>
                    <div className="text-xs font-semibold text-[#1A1E2A] flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[#5E7800] shrink-0 mt-0.5" />
                      <span>{order.deliveryAddress || order.clientAddress}</span>
                    </div>
                  </div>
                )}
                {isSafeGoogleMapsUrl(order.clientMapsUrl) && (
                  <div className="pt-1">
                    <a
                      href={order.clientMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#F3F8DE] border border-[#8BAF03]/40 px-3 text-xs font-bold text-[#1A1E2A] hover:bg-[#8BAF03] transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5 text-[#5E7800]" />
                      <span>Abrir ubicación del cliente en Google Maps</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5 text-xs">
                <div className="flex items-center gap-2 font-extrabold uppercase tracking-wider text-[#1A1E2A]">
                  <ShoppingBag className="h-4 w-4 text-[#5E7800]" />
                  <span>Logística</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-white border border-slate-200 p-2.5">
                    <div className="text-slate-500">Sede / Punto</div>
                    <div className="mt-0.5 font-bold text-[#1A1E2A] flex items-center gap-1">
                      <Store className="h-3.5 w-3.5 text-[#5E7800] shrink-0" />
                      <span>{order.campusName}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white border border-slate-200 p-2.5">
                    <div className="text-slate-500">Entrega de bolsa</div>
                    <div className="mt-0.5 font-bold text-[#1A1E2A] flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5 text-[#1A1E2A] shrink-0" />
                      <span>{dropoffLabel}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white border border-slate-200 p-2.5">
                    <div className="text-slate-500">Devolución</div>
                    <div className="mt-0.5 font-bold text-[#1A1E2A] flex items-center gap-1">
                      {order.deliveryMethod === 'delivery' ? (
                        <Truck className="h-3.5 w-3.5 text-[#5E7800] shrink-0" />
                      ) : (
                        <Store className="h-3.5 w-3.5 text-[#5E7800] shrink-0" />
                      )}
                      <span>
                        {order.deliveryMethod === 'delivery'
                          ? 'Entrega a domicilio'
                          : `Recoger en ${order.campusName}`}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white border border-slate-200 p-2.5">
                    <div className="text-slate-500">Recolección</div>
                    <div className="mt-0.5 font-bold text-[#1A1E2A]">
                      {order.collectionStatus} ·{' '}
                      <span
                        className={
                          order.bagVerified ? 'text-[#8BAF03]' : 'text-[#1A1E2A]'
                        }
                      >
                        {order.bagVerified ? 'Verificada' : 'Sin verificar'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    Creado:{' '}
                    <strong className="font-mono text-[#1A1E2A]">
                      {new Date(order.createdAt).toLocaleString('es-MX')}
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    Act.:{' '}
                    <strong className="font-mono text-[#1A1E2A]">
                      {new Date(order.updatedAt).toLocaleString('es-MX')}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline + QR */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#1A1E2A] mb-3">
                Historial de estatus del servicio
              </div>
              <OrderTimeline
                currentStatus={order.status}
                history={order.history}
              />
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 flex flex-col items-center justify-center text-center">
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#1A1E2A]">
                <QrCode className="h-4 w-4" />
                <span>Código QR del pedido</span>
              </div>
              <div className="mt-4 rounded-2xl bg-[#FCF61C]/25 border border-[#8BAF03]/20 p-4">
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG
                    value={order.orderQrPayload || order.folio}
                    size={144}
                    fgColor="#1A1E2A"
                  />
                </div>
              </div>
              <div className="mt-3 font-mono text-sm font-extrabold text-[#1A1E2A]">
                {order.folio} · {order.bagCode}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={waStatusUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#1FB858] px-3.5 text-xs font-bold text-white transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Notificar WhatsApp</span>
            </a>
            {onOpenReceipt && (
              <button
                type="button"
                onClick={() => onOpenReceipt(order)}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 px-3.5 text-xs font-bold text-[#1A1E2A] transition-colors cursor-pointer"
              >
                <Receipt className="h-4 w-4 text-[#5E7800]" />
                <span>Comprobante / Ticket</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-[#1A1E2A] hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            {onManageOrder && (
              <button
                type="button"
                onClick={() => {
                  onManageOrder(order);
                  onClose();
                }}
                className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-[#8BAF03] px-4 text-xs sm:text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] transition-colors cursor-pointer"
              >
                <Pencil className="h-4 w-4" />
                <span>Gestionar pedido</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
