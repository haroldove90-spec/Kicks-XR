import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Camera,
  Check,
  Loader2,
  Plus,
  Tag,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {api} from '../lib/api';
import {compressImageFile} from '../lib/image';
import type {
  AdminConfig,
  DeliveryMethod,
  ManagedClientUser,
  Order,
  PaymentMethod,
  PopupAlert,
} from '../types';

interface AdminWalkInOrderModalProps {
  open: boolean;
  config: AdminConfig | null;
  onClose: () => void;
  onCreated: (order: Order, whatsappUrl: string) => void;
  onPushAlert: (alert: Omit<PopupAlert, 'id'>) => void;
}

export const AdminWalkInOrderModal: React.FC<AdminWalkInOrderModalProps> = ({
  open,
  config,
  onClose,
  onCreated,
  onPushAlert,
}) => {
  const [clients, setClients] = useState<ManagedClientUser[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientWhatsapp, setClientWhatsapp] = useState('');
  const [pairs, setPairs] = useState(1);
  const [serviceId, setServiceId] = useState('');
  const [campusId, setCampusId] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [markPaid, setMarkPaid] = useState(true);
  const [shoeNotes, setShoeNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    amount: number;
  } | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const activeServices = useMemo(
    () => (config?.services || []).filter((s) => s.active),
    [config],
  );
  const activeCampuses = useMemo(
    () => (config?.campuses || []).filter((c) => c.active),
    [config],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!serviceId && activeServices[0]) setServiceId(activeServices[0].id);
    if (!campusId && activeCampuses[0]) setCampusId(activeCampuses[0].id);
    api
      .getAdminUsers()
      .then((res) => setClients(res.clients))
      .catch(() => {});
  }, [open, activeServices, activeCampuses, serviceId, campusId]);

  const selectedService = useMemo(
    () => activeServices.find((s) => s.id === serviceId) || activeServices[0],
    [activeServices, serviceId],
  );

  const subtotal = (selectedService?.price || 0) * pairs;
  const shippingFee =
    deliveryMethod === 'delivery' ? config?.shippingFee ?? 75 : 0;
  const discountAmount = appliedDiscount?.amount || 0;
  const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);

  const handleSelectClient = (id: string) => {
    setSelectedClientId(id);
    const found = clients.find((c) => c.id === id);
    if (found) {
      setClientName(found.name);
      setClientWhatsapp(found.whatsapp);
      if (found.address) setDeliveryAddress(found.address);
    }
  };

  const handleApplyCoupon = async () => {
    if (!discountCode.trim()) return;
    setError(null);
    try {
      const res = await api.validateCoupon(discountCode.trim(), subtotal);
      setAppliedDiscount({code: res.coupon.code, amount: res.discountAmount});
    } catch (err) {
      setAppliedDiscount(null);
      setError(err instanceof Error ? err.message : 'Cupón no válido.');
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setPhotoDataUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar imagen.');
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.createAdminOrder({
        clientId: selectedClientId || undefined,
        clientName: clientName.trim(),
        clientWhatsapp: clientWhatsapp.trim(),
        pairs,
        serviceId: selectedService?.id || serviceId,
        campusId: campusId || activeCampuses[0]?.id || '',
        deliveryMethod,
        deliveryAddress:
          deliveryMethod === 'delivery' ? deliveryAddress.trim() : undefined,
        paymentMethod,
        markPaid,
        shoeNotes: shoeNotes.trim() || undefined,
        adminNotes: adminNotes.trim() || undefined,
        discountCode: appliedDiscount?.code || undefined,
        photoDataUrl,
      });

      // Reset form
      setSelectedClientId('');
      setClientName('');
      setClientWhatsapp('');
      setPairs(1);
      setShoeNotes('');
      setAdminNotes('');
      setDiscountCode('');
      setAppliedDiscount(null);
      setPhotoDataUrl(undefined);

      onCreated(res.order, res.whatsappUrl);
      onPushAlert({
        title: `Pedido en mostrador ${res.order.folio}`,
        message: `Bolsa ${res.order.bagCode} registrada para ${res.order.clientName} ($${res.order.totalAmount} MXN).`,
        tone: 'success',
        whatsappUrl: res.whatsappUrl,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo registrar el pedido.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#000831]/70 p-3 sm:p-5 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Registrar pedido rápido en mostrador"
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 bg-[#109173] px-5 py-4 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <UserPlus className="h-5 w-5" />
            <div>
              <h2 className="font-display text-base sm:text-lg font-extrabold">
                Nuevo pedido en mostrador
              </h2>
              <p className="text-xs text-white/85">
                Registra un servicio presencial directamente desde el panel Admin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {clients.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-[#000831] mb-1">
                Cliente registrado (opcional)
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleSelectClient(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#000831]"
              >
                <option value="">— Cliente presencial nuevo —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.whatsapp} {c.username ? `(@${c.username})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#000831] mb-1">
                Nombre del cliente *
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej. Carlos Méndez"
                className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm text-[#000831]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#000831] mb-1">
                WhatsApp (10 dígitos) *
              </label>
              <input
                type="tel"
                required
                value={clientWhatsapp}
                onChange={(e) => setClientWhatsapp(e.target.value)}
                placeholder="55 1234 5678"
                className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 font-mono text-sm text-[#000831]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#000831] mb-1">
                Servicio *
              </label>
              <select
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setAppliedDiscount(null);
                }}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#000831]"
              >
                {activeServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — ${s.price} MXN
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#000831] mb-1">
                Pares
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={pairs}
                onChange={(e) => {
                  setPairs(Math.max(1, Math.min(10, Number(e.target.value) || 1)));
                  setAppliedDiscount(null);
                }}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold text-[#000831]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#000831] mb-1">
                Sede / Punto
              </label>
              <select
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#000831]"
              >
                {activeCampuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#000831] mb-1">
                Devolución
              </label>
              <select
                value={deliveryMethod}
                onChange={(e) =>
                  setDeliveryMethod(e.target.value as DeliveryMethod)
                }
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#000831]"
              >
                <option value="pickup">Recoger en sede (sin costo)</option>
                <option value="delivery">
                  Envío a domicilio (+${config?.shippingFee ?? 75} MXN)
                </option>
              </select>
            </div>
          </div>

          {deliveryMethod === 'delivery' && (
            <div>
              <label className="block text-xs font-bold text-[#000831] mb-1">
                Dirección de entrega *
              </label>
              <input
                type="text"
                required
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Calle, número, colonia y referencias"
                className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm text-[#000831]"
              />
            </div>
          )}

          {/* Shoe photo + notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#000831] mb-1">
                Notas del calzado (opcional)
              </label>
              <textarea
                rows={2}
                value={shoeNotes}
                onChange={(e) => setShoeNotes(e.target.value)}
                placeholder="Modelo, color, material delicado o manchas..."
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-[#000831]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#000831] mb-1">
                Notas internas de taller (opcional)
              </label>
              <textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Indicaciones internas para limpieza..."
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-[#000831]"
              />
            </div>
          </div>

          {/* Photo upload */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {photoDataUrl ? (
                <img
                  src={photoDataUrl}
                  alt="Foto tenis"
                  className="h-14 w-14 rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <div className="h-14 w-14 rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400">
                  <Camera className="h-5 w-5" />
                </div>
              )}
              <div className="text-xs">
                <div className="font-bold text-[#000831]">
                  Fotografía inicial de los tenis
                </div>
                <div className="text-slate-500">
                  {photoDataUrl ? 'Imagen lista para guardar' : 'Opcional — cámara o galería'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[#000831] px-3 text-xs font-bold text-white hover:bg-black cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>{photoDataUrl ? 'Cambiar foto' : 'Tomar / subir foto'}</span>
              </button>
              {photoDataUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(undefined)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Coupon + Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#000831] mb-1">
                Cupón de descuento (opcional)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                  placeholder="Ej. BIENVENIDO10"
                  className="flex-1 min-h-[40px] rounded-xl border border-slate-300 px-3 font-mono text-xs uppercase text-[#000831]"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="min-h-[40px] inline-flex items-center gap-1 rounded-xl bg-[#EFEAFF] px-3 text-xs font-bold text-[#5B21B6] hover:bg-[#5B21B6] hover:text-white transition-colors cursor-pointer"
                >
                  <Tag className="h-3.5 w-3.5" />
                  <span>Aplicar</span>
                </button>
              </div>
              {appliedDiscount && (
                <div className="mt-1 text-[11px] font-bold text-[#109173]">
                  Cupón {appliedDiscount.code} aplicado: -${appliedDiscount.amount} MXN
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#000831]">
                Método de pago
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['cash', 'card'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`min-h-[40px] rounded-xl border text-xs font-bold cursor-pointer ${
                      paymentMethod === m
                        ? 'border-[#109173] bg-[#E6F7F3] text-[#109173]'
                        : 'border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    {m === 'cash' ? 'Efectivo' : 'Tarjeta'}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#000831] cursor-pointer">
                <input
                  type="checkbox"
                  checked={markPaid}
                  onChange={(e) => setMarkPaid(e.target.checked)}
                  className="h-4 w-4 accent-[#109173]"
                />
                <span>Marcar como pagado en mostrador</span>
              </label>
            </div>
          </div>

          {/* Total Summary */}
          <div className="rounded-xl bg-[#000831] text-white p-4 flex items-center justify-between gap-3">
            <div className="text-xs text-white/80">
              <div>
                Subtotal: ${subtotal} MXN
                {discountAmount > 0 ? ` · Desc: -$${discountAmount}` : ''}
                {shippingFee > 0 ? ` · Envío: +$${shippingFee}` : ''}
              </div>
              <div className="mt-0.5 font-semibold text-[#E6F7F3]">
                {markPaid ? 'Pago liquidado' : 'Pago pendiente'} · Se asigna folio y bolsa
                automáticamente
              </div>
            </div>
            <div className="font-mono text-2xl font-extrabold text-[#E6F7F3] tabular-nums shrink-0">
              ${totalAmount}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-[#000831] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#109173] px-5 text-xs sm:text-sm font-bold text-white hover:bg-[#0B755C] disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>Registrar pedido</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
