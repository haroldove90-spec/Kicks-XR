import React, {useEffect} from 'react';
import {Download, Printer, X} from 'lucide-react';
import {QRCodeSVG} from 'qrcode.react';
import type {Order} from '../types';
import {isSafePhotoDataUrl} from './AdminOrderDetailModal';

const LOGO_URL = 'https://daloocomercializadora.com.mx/xrlogo.png';

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface OrderReceiptModalProps {
  order: Order | null;
  onClose: () => void;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  order,
  onClose,
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

  const subtotal = order.unitPrice * order.pairs;
  const discount = order.discountAmount || 0;
  const hasBeforePhoto = isSafePhotoDataUrl(order.photoDataUrl);
  const hasAfterPhoto = isSafePhotoDataUrl(order.afterPhotoDataUrl);

  const handleDownloadHtmlReceipt = () => {
    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Comprobante Kicks XR · ${escapeHtml(order.folio)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #000831; margin: 0; padding: 24px; }
  .card { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
  .header { background: #000831; color: #fff; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { margin: 0; font-size: 20px; }
  .badge { background: #109173; color: #fff; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; }
  .body { padding: 24px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; gap: 12px; }
  .label { color: #64748b; }
  .val { font-weight: 700; text-align: right; }
  .total { font-size: 18px; color: #109173; font-weight: 800; border-bottom: none; padding-top: 12px; }
  .note { margin-top: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 13px; }
  .footer { text-align: center; padding: 14px 24px 20px; color: #64748b; font-size: 12px; border-top: 1px solid #f1f5f9; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <h1>Kicks XR · Nota de Servicio</h1>
        <div style="font-size:12px;opacity:.8;margin-top:4px;">Folio ${escapeHtml(order.folio)} · Bolsa ${escapeHtml(order.bagCode)}</div>
      </div>
      <span class="badge">${escapeHtml(order.status)}</span>
    </div>
    <div class="body">
      <div class="row"><span class="label">Fecha</span><span class="val">${escapeHtml(new Date(order.createdAt).toLocaleString('es-MX'))}</span></div>
      <div class="row"><span class="label">Cliente</span><span class="val">${escapeHtml(order.clientName)}</span></div>
      <div class="row"><span class="label">WhatsApp</span><span class="val">${escapeHtml(order.clientWhatsapp)}</span></div>
      <div class="row"><span class="label">Sede / Punto</span><span class="val">${escapeHtml(order.campusName)}</span></div>
      <div class="row"><span class="label">Servicio</span><span class="val">${escapeHtml(order.serviceName)} (${order.pairs} ${order.pairs === 1 ? 'par' : 'pares'})</span></div>
      <div class="row"><span class="label">Devolución</span><span class="val">${order.deliveryMethod === 'delivery' ? `Domicilio: ${escapeHtml(order.deliveryAddress || '')}` : `Recoger en ${escapeHtml(order.campusName)}`}</span></div>
      <div class="row"><span class="label">Subtotal</span><span class="val">$${subtotal} MXN</span></div>
      ${discount > 0 ? `<div class="row"><span class="label">Descuento (${escapeHtml(order.discountCode || 'Cupón')})</span><span class="val" style="color:#109173;">-$${discount} MXN</span></div>` : ''}
      <div class="row"><span class="label">Envío</span><span class="val">${order.shippingFee > 0 ? `$${order.shippingFee} MXN` : 'Sin costo'}</span></div>
      <div class="row"><span class="label">Pago</span><span class="val">${order.paymentMethod === 'card' ? `Tarjeta${order.cardLast4 ? ` •••• ${escapeHtml(order.cardLast4)}` : ''}` : 'Efectivo'} · ${escapeHtml(order.paymentStatus)}</span></div>
      <div class="row total"><span>Total</span><span>$${order.totalAmount} MXN</span></div>
      ${order.shoeNotes ? `<div class="note"><strong>Notas del calzado:</strong> ${escapeHtml(order.shoeNotes)}</div>` : ''}
    </div>
    <div class="footer">Gracias por confiar en Kicks XR · Conserva tu folio ${escapeHtml(order.folio)} para recoger tu pedido.</div>
  </div>
</body>
</html>`;
    const blob = new Blob([html], {type: 'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Comprobante-${order.folio}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-[#000831]/75 p-3 sm:p-5 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Comprobante ${order.folio}`}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Actions Bar */}
        <div className="flex items-center justify-between gap-2 bg-[#000831] px-4 py-3 text-white shrink-0 print:hidden">
          <div className="font-display text-sm font-extrabold">
            Comprobante · {order.folio}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleDownloadHtmlReceipt}
              className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[#109173] hover:bg-[#0B755C] px-3 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Descargar</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              aria-label="Cerrar comprobante"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-dashed border-slate-300 pb-4">
            <div>
              <img
                src={LOGO_URL}
                alt="Kicks XR"
                className="h-8 w-auto object-contain"
              />
              <div className="mt-1 text-xs text-slate-500">
                Nota de servicio y comprobante de entrega
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-extrabold text-[#000831]">
                {order.folio}
              </div>
              <div className="font-mono text-xs font-bold text-[#5B21B6]">
                Bolsa {order.bagCode}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 rounded-xl p-3.5 border border-slate-200">
            <div>
              <div className="text-slate-500">Cliente</div>
              <div className="font-bold text-[#000831] mt-0.5">{order.clientName}</div>
              <div className="font-mono text-[11px] text-slate-600">
                {order.clientWhatsapp}
              </div>
            </div>
            <div className="text-right">
              <div className="text-slate-500">Fecha de registro</div>
              <div className="font-mono font-bold text-[#000831] mt-0.5">
                {new Date(order.createdAt).toLocaleDateString('es-MX')}
              </div>
              <div className="font-mono text-[11px] text-slate-600">
                {new Date(order.createdAt).toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Sede / Punto</div>
              <div className="font-bold text-[#000831] mt-0.5">{order.campusName}</div>
            </div>
            <div className="text-right">
              <div className="text-slate-500">Estatus</div>
              <div className="font-bold text-[#109173] mt-0.5">{order.status}</div>
            </div>
          </div>

          <div className="space-y-2 text-sm border-b border-dashed border-slate-300 pb-4">
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">
                {order.serviceName} ({order.pairs} × ${order.unitPrice})
              </span>
              <span className="font-mono font-bold text-[#000831] tabular-nums">
                ${subtotal} MXN
              </span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between gap-2 text-[#109173]">
                <span>Cupón {order.discountCode || 'Descuento'}</span>
                <span className="font-mono font-bold tabular-nums">
                  -${discount} MXN
                </span>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">
                {order.deliveryMethod === 'delivery'
                  ? 'Envío a domicilio'
                  : 'Recoger en punto'}
              </span>
              <span className="font-mono font-semibold text-[#000831] tabular-nums">
                {order.shippingFee > 0 ? `$${order.shippingFee} MXN` : '$0 MXN'}
              </span>
            </div>
            <div className="flex justify-between gap-2 pt-2 border-t border-slate-100">
              <span className="font-display font-extrabold text-[#000831]">
                Total
              </span>
              <span className="font-mono text-xl font-extrabold text-[#109173] tabular-nums">
                ${order.totalAmount} MXN
              </span>
            </div>
            <div className="flex justify-between gap-2 text-xs text-slate-600">
              <span>Forma y estado de pago</span>
              <span className="font-bold text-[#000831]">
                {order.paymentMethod === 'card'
                  ? `Tarjeta${order.cardLast4 ? ` •••• ${order.cardLast4}` : ''}`
                  : 'Efectivo'}{' '}
                · {order.paymentStatus}
              </span>
            </div>
          </div>

          {order.deliveryMethod === 'delivery' && order.deliveryAddress && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
              <span className="font-bold text-[#000831]">Dirección de entrega: </span>
              <span className="text-slate-700">{order.deliveryAddress}</span>
            </div>
          )}

          {order.shoeNotes && (
            <div className="rounded-xl bg-[#E6F7F3]/50 border border-[#109173]/20 p-3 text-xs">
              <span className="font-bold text-[#000831]">Notas del calzado: </span>
              <span className="text-slate-700">{order.shoeNotes}</span>
            </div>
          )}

          {(hasBeforePhoto || hasAfterPhoto) && (
            <div className="grid grid-cols-2 gap-3">
              {hasBeforePhoto && (
                <div className="rounded-xl border border-slate-200 p-2 text-center">
                  <img
                    src={order.photoDataUrl}
                    alt="Foto inicial"
                    className="h-24 w-full object-contain rounded-lg bg-slate-50"
                  />
                  <div className="mt-1 text-[11px] font-bold text-slate-600">
                    Antes
                  </div>
                </div>
              )}
              {hasAfterPhoto && (
                <div className="rounded-xl border border-[#109173]/30 p-2 text-center bg-[#E6F7F3]/30">
                  <img
                    src={order.afterPhotoDataUrl}
                    alt="Foto terminada"
                    className="h-24 w-full object-contain rounded-lg bg-white"
                  />
                  <div className="mt-1 text-[11px] font-bold text-[#109173]">
                    Después
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col items-center pt-1">
            <div className="rounded-xl border border-slate-200 bg-white p-2.5">
              <QRCodeSVG
                value={order.orderQrPayload || order.folio}
                size={112}
                fgColor="#000831"
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500 text-center">
              Presenta este folio o QR al recoger tus tenis en Kicks XR.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
