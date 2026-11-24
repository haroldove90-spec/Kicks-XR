import React, {useMemo, useState} from 'react';
import {
  Banknote,
  BarChart3,
  Building2,
  Calendar,
  CreditCard,
  Download,
  Package,
  Star,
  TrendingUp,
} from 'lucide-react';
import type {Campus, Order} from '../types';

interface AdminReportsModuleProps {
  orders: Order[];
  campuses: Campus[];
  onOpenOrderDetail: (order: Order) => void;
}

type DatePreset = 'today' | '7d' | 'month' | 'all' | 'custom';

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escapeCsvCell(val: unknown): string {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const AdminReportsModule: React.FC<AdminReportsModuleProps> = ({
  orders,
  campuses,
  onOpenOrderDetail,
}) => {
  const [preset, setPreset] = useState<DatePreset>('all');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return toLocalYmd(d);
  });
  const [toDate, setToDate] = useState(() => toLocalYmd(new Date()));
  const [campusId, setCampusId] = useState('all');

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = toLocalYmd(now);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    const sevenDaysStr = toLocalYmd(sevenDaysAgo);
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    return orders.filter((o) => {
      if (campusId !== 'all' && o.campusId !== campusId) return false;
      const orderYmd = toLocalYmd(new Date(o.createdAt));
      if (preset === 'today') return orderYmd === todayStr;
      if (preset === '7d') return orderYmd >= sevenDaysStr && orderYmd <= todayStr;
      if (preset === 'month') return orderYmd >= monthStartStr && orderYmd <= todayStr;
      if (preset === 'custom') {
        if (fromDate && orderYmd < fromDate) return false;
        if (toDate && orderYmd > toDate) return false;
      }
      return true;
    });
  }, [orders, campusId, preset, fromDate, toDate]);

  const summary = useMemo(() => {
    const active = filteredOrders.filter((o) => o.status !== 'Cancelado');
    const cancelled = filteredOrders.filter((o) => o.status === 'Cancelado');
    const paidOrders = active.filter((o) => o.paymentStatus === 'Pagado');
    const pendingOrders = active.filter((o) => o.paymentStatus === 'Pago pendiente');

    const totalPaid = paidOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const cashPaid = paidOrders
      .filter((o) => o.paymentMethod === 'cash')
      .reduce((acc, o) => acc + o.totalAmount, 0);
    const cardPaid = paidOrders
      .filter((o) => o.paymentMethod === 'card')
      .reduce((acc, o) => acc + o.totalAmount, 0);
    const totalPending = pendingOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const totalDiscounts = active.reduce((acc, o) => acc + (o.discountAmount || 0), 0);
    const totalPairs = active.reduce((acc, o) => acc + o.pairs, 0);

    const rated = active.filter((o) => typeof o.rating === 'number');
    const avgRating =
      rated.length > 0
        ? Math.round(
            (rated.reduce((acc, o) => acc + (o.rating || 0), 0) / rated.length) * 10,
          ) / 10
        : 0;

    // Breakdown by service
    const byServiceMap = new Map<
      string,
      {name: string; orders: number; pairs: number; revenue: number}
    >();
    for (const o of active) {
      const cur = byServiceMap.get(o.serviceName) || {
        name: o.serviceName,
        orders: 0,
        pairs: 0,
        revenue: 0,
      };
      cur.orders += 1;
      cur.pairs += o.pairs;
      cur.revenue += o.totalAmount;
      byServiceMap.set(o.serviceName, cur);
    }

    // Breakdown by campus
    const byCampusMap = new Map<
      string,
      {name: string; orders: number; paid: number; pending: number}
    >();
    for (const o of active) {
      const cur = byCampusMap.get(o.campusName) || {
        name: o.campusName,
        orders: 0,
        paid: 0,
        pending: 0,
      };
      cur.orders += 1;
      if (o.paymentStatus === 'Pagado') cur.paid += o.totalAmount;
      else cur.pending += o.totalAmount;
      byCampusMap.set(o.campusName, cur);
    }

    return {
      activeCount: active.length,
      deliveredCount: active.filter((o) => o.status === 'Entregado').length,
      cancelledCount: cancelled.length,
      totalPairs,
      totalPaid,
      cashPaid,
      cardPaid,
      totalPending,
      totalDiscounts,
      avgRating,
      ratedOrders: rated,
      byService: Array.from(byServiceMap.values()).sort(
        (a, b) => b.revenue - a.revenue,
      ),
      byCampus: Array.from(byCampusMap.values()).sort(
        (a, b) => b.paid + b.pending - (a.paid + a.pending),
      ),
    };
  }, [filteredOrders]);

  const handleExportCsv = () => {
    const headers = [
      'Folio',
      'Bolsa',
      'Fecha',
      'Cliente',
      'WhatsApp',
      'Sede',
      'Servicio',
      'Pares',
      'Precio Unitario',
      'Cupón',
      'Descuento',
      'Envío',
      'Total MXN',
      'Método Pago',
      'Estado Pago',
      'Estatus Pedido',
      'Calificación',
      'Comentario',
      'Notas Calzado',
      'Notas Taller',
    ];
    const rows = filteredOrders.map((o) => [
      o.folio,
      o.bagCode,
      new Date(o.createdAt).toLocaleString('es-MX'),
      o.clientName,
      o.clientWhatsapp,
      o.campusName,
      o.serviceName,
      o.pairs,
      o.unitPrice,
      o.discountCode || '',
      o.discountAmount || 0,
      o.shippingFee,
      o.totalAmount,
      o.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo',
      o.paymentStatus,
      o.status,
      o.rating ?? '',
      o.ratingComment || '',
      o.shoeNotes || '',
      o.adminNotes || '',
    ]);

    const csvLines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((r) => r.map(escapeCsvCell).join(',')),
    ];
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvLines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KicksXR-Corte-Pedidos-${toLocalYmd(new Date())}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#000000]">
            Reportes y Corte de Caja
          </h1>
          <p className="text-sm text-slate-600">
            Ingresos por método de pago, rendimiento por sede/servicio, satisfacción y
            exportación a Excel/CSV.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#109173] px-4 text-xs sm:text-sm font-bold text-white hover:bg-[#0B755C] transition-colors cursor-pointer"
        >
          <Download className="h-4 w-4" />
          <span>Exportar Excel / CSV ({filteredOrders.length})</span>
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['today', 'Hoy'],
                ['7d', 'Últimos 7 días'],
                ['month', 'Este mes'],
                ['all', 'Todo el historial'],
                ['custom', 'Rango personalizado'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                className={`min-h-[36px] rounded-xl px-3 text-xs font-bold transition-colors cursor-pointer ${
                  preset === key
                    ? 'bg-[#000831] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            <select
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              className="min-h-[38px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-[#000831]"
            >
              <option value="all">Todas las sedes</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-[#000831] mb-1">
                Desde
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 pl-9 pr-3 text-xs text-[#000831]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#000831] mb-1">
                Hasta
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 pl-9 pr-3 text-xs text-[#000831]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cash Register Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#000831] text-white p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-white/75">
            <span>Ingresos cobrados (Caja)</span>
            <TrendingUp className="h-4 w-4 text-[#109173]" />
          </div>
          <div className="mt-2 font-mono text-3xl font-extrabold text-[#E6F7F3] tabular-nums">
            ${summary.totalPaid}
          </div>
          <div className="mt-1.5 text-xs text-white/75 tabular-nums">
            Por cobrar: ${summary.totalPending} MXN
            {summary.totalDiscounts > 0 && ` · Desc: -$${summary.totalDiscounts}`}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Corte Efectivo vs. Tarjeta</span>
            <Banknote className="h-4 w-4 text-[#109173]" />
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <Banknote className="h-4 w-4 text-[#109173]" />
                Efectivo
              </span>
              <span className="font-mono font-extrabold text-[#000831] tabular-nums">
                ${summary.cashPaid} MXN
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <CreditCard className="h-4 w-4 text-[#5B21B6]" />
                Tarjeta
              </span>
              <span className="font-mono font-extrabold text-[#000831] tabular-nums">
                ${summary.cardPaid} MXN
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Volumen operativo</span>
            <Package className="h-4 w-4 text-[#109173]" />
          </div>
          <div className="mt-2 font-mono text-3xl font-extrabold text-[#000831] tabular-nums">
            {summary.activeCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {summary.totalPairs} pares · {summary.deliveredCount} entregados ·{' '}
            {summary.cancelledCount} cancelados
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Satisfacción de clientes</span>
            <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
          </div>
          <div className="mt-2 font-mono text-3xl font-extrabold text-[#000831] tabular-nums">
            {summary.ratedOrders.length > 0 ? `${summary.avgRating} / 5` : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {summary.ratedOrders.length}{' '}
            {summary.ratedOrders.length === 1 ? 'calificación' : 'calificaciones'}{' '}
            recibidas
          </div>
        </div>
      </div>

      {/* Breakdown by Service & Campus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 font-display text-base font-bold text-[#000000]">
            <BarChart3 className="h-5 w-5 text-[#109173]" />
            <span>Servicios más solicitados</span>
          </div>
          {summary.byService.length === 0 ? (
            <p className="text-sm text-slate-500">Sin pedidos en este rango.</p>
          ) : (
            <div className="space-y-2.5">
              {summary.byService.map((svc) => (
                <div
                  key={svc.name}
                  className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-sm text-[#000831]">{svc.name}</div>
                    <div className="text-xs text-slate-500">
                      {svc.orders} pedidos · {svc.pairs}{' '}
                      {svc.pairs === 1 ? 'par' : 'pares'}
                    </div>
                  </div>
                  <div className="font-mono text-sm font-extrabold text-[#109173] tabular-nums">
                    ${svc.revenue} MXN
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 font-display text-base font-bold text-[#000000]">
            <Building2 className="h-5 w-5 text-[#5B21B6]" />
            <span>Desempeño por sede / punto</span>
          </div>
          {summary.byCampus.length === 0 ? (
            <p className="text-sm text-slate-500">Sin pedidos en este rango.</p>
          ) : (
            <div className="space-y-2.5">
              {summary.byCampus.map((c) => (
                <div
                  key={c.name}
                  className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-sm text-[#000831]">{c.name}</div>
                    <div className="text-xs text-slate-500">
                      {c.orders} pedidos · Por cobrar:{' '}
                      <span className="font-mono font-semibold">${c.pending}</span>
                    </div>
                  </div>
                  <div className="font-mono text-sm font-extrabold text-[#000831] tabular-nums">
                    ${c.paid} cobrados
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Customer Ratings Feed */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-display text-base font-bold text-[#000000]">
            <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
            <span>Calificaciones y reseñas de clientes</span>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {summary.ratedOrders.length} reseñas
          </span>
        </div>

        {summary.ratedOrders.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aún no hay calificaciones en este periodo. Cuando un pedido se marque como
            Entregado, el cliente podrá calificar su experiencia desde la app.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {summary.ratedOrders.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onOpenOrderDetail(o)}
                className="rounded-xl border border-slate-200 bg-slate-50/70 hover:border-[#109173] p-4 text-left transition-colors cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-[#000831]">
                    {o.clientName}{' '}
                    <span className="font-mono text-xs font-normal text-slate-500">
                      · {o.folio}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-amber-500 font-mono text-xs font-extrabold">
                    {'★'.repeat(o.rating || 0)}
                    {'☆'.repeat(5 - (o.rating || 0))}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  {o.serviceName} · {o.campusName}
                </div>
                {o.ratingComment && (
                  <p className="text-xs text-slate-700 italic">"{o.ratingComment}"</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
