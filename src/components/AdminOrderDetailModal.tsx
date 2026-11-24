import React, {useEffect} from 'react';
import {
  Calendar,
  Camera,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  ImageOff,
  Lock,
  MapPin,
  Package,
  Pencil,
  QrCode,
  ShoppingBag,
  Store,
  Truck,
  User,
  X,
  ZoomIn,
} from 'lucide-react';
import {QRCodeSVG} from 'qrcode.react';
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
}

export const AdminOrderDetailModal: React.FC<AdminOrderDetailModalProps> = ({
  order,
  onClose,
  onZoomPhoto,
  onManageOrder,
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

  const hasValidPhoto = isSafePhotoDataUrl(order.photoDataUrl);
  const subtotal = order.unitPrice * order.pairs;
  const whatsappDigits = (order.clientWhatsapp || '').replace(/\D/g, '');
  const dropoffLabel =
    order.dropoffMethod === 'locker'
      ? `Locker autoservicio${order.assignedLockerCode ? ` (${order.assignedLockerCode})` : ''}`
      : order.dropoffMethod === 'staff'
        ? 'Entregado con personal en punto'
        : 'Aún no reportado por el cliente';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#000831]/70 p-3 sm:p-5 backdrop-blur-xs"
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
        <div className="flex items-center justify-between gap-3 bg-[#000831] px-5 py-4 text-white shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg sm:text-xl font-extrabold tracking-tight">
                {order.folio}
              </span>
              <span className="rounded-lg bg-white/15 px-2.5 py-0.5 font-mono text-xs font-bold text-[#E6F7F3]">
                Bolsa {order.bagCode}
              </span>
              <span className="rounded-lg bg-[#109173] px-2.5 py-0.5 text-xs font-bold text-white">
                {order.status}
              </span>
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
          {/* Top Grid: Sneaker Photo + Service & Pricing Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Sneaker Photo Evidence */}
            <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#000831]">
                  <Camera className="h-4 w-4 text-[#109173]" />
                  <span>Fotografía de los tenis</span>
                </div>
                {hasValidPhoto && (
                  <span className="text-[11px] font-bold text-[#109173]">
                    Evidencia adjunta
                  </span>
                )}
              </div>

              {hasValidPhoto ? (
                <div className="space-y-3 flex-1 flex flex-col">
                  <button
                    type="button"
                    onClick={() =>
                      onZoomPhoto({
                        url: order.photoDataUrl!,
                        title: `Tenis · ${order.folio} (${order.bagCode})`,
                        subtitle: `${order.clientName} · ${order.serviceName} · ${order.pairs} ${order.pairs === 1 ? 'par' : 'pares'}`,
                        filename: `${order.folio}-${order.bagCode}-tenis.jpg`,
                      })
                    }
                    className="group relative flex-1 min-h-[220px] max-h-[300px] w-full overflow-hidden rounded-xl border border-slate-200 bg-[#000831]/5 flex items-center justify-center cursor-pointer"
                  >
                    <img
                      src={order.photoDataUrl}
                      alt={`Fotografía de tenis del pedido ${order.folio}`}
                      className="max-h-[296px] w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                    <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#000831]/85 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                      <ZoomIn className="h-3.5 w-3.5" />
                      <span>Ver en grande</span>
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onZoomPhoto({
                          url: order.photoDataUrl!,
                          title: `Tenis · ${order.folio} (${order.bagCode})`,
                          subtitle: `${order.clientName} · ${order.serviceName} · ${order.pairs} ${order.pairs === 1 ? 'par' : 'pares'}`,
                          filename: `${order.folio}-${order.bagCode}-tenis.jpg`,
                        })
                      }
                      className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#000831] px-3 text-xs font-bold text-white hover:bg-black transition-colors cursor-pointer"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                      <span>Pantalla completa</span>
                    </button>
                    <a
                      href={order.photoDataUrl}
                      download={`${order.folio}-${order.bagCode}-tenis.jpg`}
                      className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-[#000831] hover:bg-slate-50 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5 text-[#109173]" />
                      <span>Descargar foto</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-[220px] rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center p-6 text-center">
                  <ImageOff className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-[#000831]">
                    Sin fotografía adjunta
                  </p>
                  <p className="mt-1 text-xs text-slate-500 max-w-xs">
                    El cliente registró este pedido sin cargar una imagen inicial de
                    sus tenis.
                  </p>
                </div>
              )}
            </div>

            {/* Service & Billing Breakdown */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#000831]">
                  <Package className="h-4 w-4 text-[#109173]" />
                  <span>Detalles del servicio y cobro</span>
                </div>

                <div className="rounded-xl bg-[#E6F7F3]/70 border border-[#109173]/20 p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-600">
                      Servicio contratado
                    </div>
                    <div className="font-display text-base font-extrabold text-[#000831]">
                      {order.serviceName}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-extrabold text-[#109173]">
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
                    <span className="font-mono font-semibold text-[#000831] tabular-nums">
                      ${subtotal} MXN
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Envío a domicilio</span>
                    <span className="font-mono font-semibold text-[#000831] tabular-nums">
                      {order.shippingFee > 0 ? `$${order.shippingFee} MXN` : 'Sin costo'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-slate-100 pt-2">
                    <span className="font-bold text-[#000831]">Total del pedido</span>
                    <span className="font-mono text-lg font-extrabold text-[#109173] tabular-nums">
                      ${order.totalAmount} MXN
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <div className="text-slate-500 font-medium">Método de pago</div>
                    <div className="mt-0.5 font-bold text-[#000831] flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-[#109173]" />
                      <span>
                        {order.paymentMethod === 'card'
                          ? `Tarjeta${order.cardLast4 ? ` •••• ${order.cardLast4}` : ''}`
                          : 'Efectivo'}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <div className="text-slate-500 font-medium">Estado de pago</div>
                    <div
                      className={`mt-0.5 font-bold flex items-center gap-1.5 ${
                        order.paymentStatus === 'Pagado'
                          ? 'text-[#109173]'
                          : 'text-[#5B21B6]'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{order.paymentStatus}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Details */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 text-sm">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#000831]">
                  <User className="h-4 w-4 text-[#109173]" />
                  <span>Datos del cliente</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Nombre</span>
                  <span className="font-bold text-[#000831] text-right">
                    {order.clientName}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">WhatsApp</span>
                  {whatsappDigits ? (
                    <a
                      href={`https://wa.me/52${whatsappDigits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono font-bold text-[#109173] hover:underline"
                    >
                      <span>{order.clientWhatsapp}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="font-mono text-slate-600">—</span>
                  )}
                </div>
                {order.deliveryMethod === 'delivery' && order.deliveryAddress && (
                  <div className="pt-1 border-t border-slate-100">
                    <div className="text-xs text-slate-500 mb-0.5">
                      Dirección de entrega a domicilio
                    </div>
                    <div className="text-xs font-semibold text-[#000831] flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[#109173] shrink-0 mt-0.5" />
                      <span>{order.deliveryAddress}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Logistics + QR + Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5 text-sm">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#000831]">
                  <ShoppingBag className="h-4 w-4 text-[#109173]" />
                  <span>Logística y operación</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-white border border-slate-200 p-3">
                    <div className="text-slate-500">Sede / Punto</div>
                    <div className="mt-0.5 font-bold text-[#000831] flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-[#109173] shrink-0" />
                      <span>{order.campusName}</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-3">
                    <div className="text-slate-500">Entrega de bolsa</div>
                    <div className="mt-0.5 font-bold text-[#000831] flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-[#5B21B6] shrink-0" />
                      <span>{dropoffLabel}</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-3">
                    <div className="text-slate-500">Modalidad de devolución</div>
                    <div className="mt-0.5 font-bold text-[#000831] flex items-center gap-1.5">
                      {order.deliveryMethod === 'delivery' ? (
                        <Truck className="h-3.5 w-3.5 text-[#109173] shrink-0" />
                      ) : (
                        <Store className="h-3.5 w-3.5 text-[#109173] shrink-0" />
                      )}
                      <span>
                        {order.deliveryMethod === 'delivery'
                          ? 'Entrega a domicilio'
                          : `Recoger en ${order.campusName}`}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-3">
                    <div className="text-slate-500">Recolección y bolsa</div>
                    <div className="mt-0.5 font-bold text-[#000831]">
                      {order.collectionStatus} ·{' '}
                      <span
                        className={
                          order.bagVerified ? 'text-[#109173]' : 'text-[#5B21B6]'
                        }
                      >
                        {order.bagVerified ? 'Verificada' : 'Sin verificar'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    Creado:{' '}
                    <strong className="font-mono text-[#000831]">
                      {new Date(order.createdAt).toLocaleString('es-MX')}
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    Actualizado:{' '}
                    <strong className="font-mono text-[#000831]">
                      {new Date(order.updatedAt).toLocaleString('es-MX')}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#000831] mb-3">
                  Historial de estatus del servicio
                </div>
                <OrderTimeline
                  currentStatus={order.status}
                  history={order.history}
                />
              </div>
            </div>

            {/* Order QR Card */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 flex flex-col items-center justify-center text-center">
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#5B21B6]">
                <QrCode className="h-4 w-4" />
                <span>Código QR del pedido</span>
              </div>
              <div className="mt-4 rounded-2xl bg-[#EFEAFF] border border-[#5B21B6]/20 p-4">
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG
                    value={order.orderQrPayload || order.folio}
                    size={152}
                    fgColor="#000831"
                  />
                </div>
              </div>
              <div className="mt-3 font-mono text-sm font-extrabold text-[#000831]">
                {order.folio} · {order.bagCode}
              </div>
              <p className="mt-1 text-xs text-slate-500 max-w-[230px]">
                Escanea este código en taller o punto de entrega para validar bolsa y
                devolución.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-[#000831] hover:bg-slate-100 transition-colors cursor-pointer"
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
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[#109173] px-5 text-xs sm:text-sm font-bold text-white hover:bg-[#0B755C] transition-colors cursor-pointer"
            >
              <Pencil className="h-4 w-4" />
              <span>Gestionar pedido y estatus</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
