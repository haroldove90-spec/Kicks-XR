import React, {useState} from 'react';
import {
  Check,
  Clock,
  DollarSign,
  Pencil,
  Plus,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import {api} from '../lib/api';
import type {AdminConfig, PopupAlert, ServiceItem} from '../types';

interface AdminServicesModuleProps {
  config: AdminConfig;
  onRefresh: () => void;
  onPushAlert: (alert: Omit<PopupAlert, 'id'>) => void;
}

export const AdminServicesModule: React.FC<AdminServicesModuleProps> = ({
  config,
  onRefresh,
  onPushAlert,
}) => {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('250');
  const [newHours, setNewHours] = useState('24');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editHours, setEditHours] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const [shippingFee, setShippingFee] = useState(String(config.shippingFee));
  const [savingShipping, setSavingShipping] = useState(false);

  const activeServicesCount = config.services.filter((s) => s.active).length;
  const avgPrice =
    config.services.length > 0
      ? Math.round(
          config.services.reduce((acc, s) => acc + s.price, 0) /
            config.services.length,
        )
      : 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Number(newPrice);
    const parsedHours = Number(newHours) || 24;
    if (newName.trim().length < 2 || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      onPushAlert({
        title: 'Datos incompletos',
        message: 'Ingresa un nombre válido y un precio mayor a $0 MXN.',
        tone: 'warning',
      });
      return;
    }
    setCreating(true);
    try {
      await api.createService({
        name: newName.trim(),
        description: newDesc.trim() || 'Servicio profesional Homeli.',
        price: Math.round(parsedPrice),
        turnaroundHours: Math.max(1, Math.round(parsedHours)),
      });
      setNewName('');
      setNewDesc('');
      setNewPrice('250');
      setNewHours('24');
      onPushAlert({
        title: 'Servicio dado de alta',
        message: 'El nuevo servicio ya aparece disponible para tus clientes.',
        tone: 'success',
      });
      onRefresh();
    } catch (err) {
      onPushAlert({
        title: 'Error creando servicio',
        message:
          err instanceof Error ? err.message : 'No se pudo dar de alta el servicio.',
        tone: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (svc: ServiceItem) => {
    setEditingId(svc.id);
    setEditName(svc.name);
    setEditDesc(svc.description);
    setEditPrice(String(svc.price));
    setEditHours(String(svc.turnaroundHours));
  };

  const handleSaveEdit = async (id: string) => {
    const parsedPrice = Number(editPrice);
    const parsedHours = Number(editHours) || 24;
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      onPushAlert({
        title: 'Precio inválido',
        message: 'Ingresa un precio mayor a $0 MXN.',
        tone: 'warning',
      });
      return;
    }
    setSavingId(id);
    try {
      await api.updateService(id, {
        name: editName.trim(),
        description: editDesc.trim(),
        price: Math.round(parsedPrice),
        turnaroundHours: Math.max(1, Math.round(parsedHours)),
      });
      setEditingId(null);
      onPushAlert({
        title: 'Servicio y precio actualizados',
        message: 'Los clientes verán el nuevo precio de inmediato.',
        tone: 'success',
      });
      onRefresh();
    } catch (err) {
      onPushAlert({
        title: 'Error actualizando servicio',
        message:
          err instanceof Error ? err.message : 'No se pudo actualizar el servicio.',
        tone: 'error',
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (svc: ServiceItem) => {
    setSavingId(svc.id);
    try {
      await api.updateService(svc.id, {active: !svc.active});
      onPushAlert({
        title: svc.active ? 'Servicio pausado' : 'Servicio reactivado',
        message: `${svc.name} ahora está ${svc.active ? 'oculto en el catálogo del cliente' : 'activo y disponible'}.`,
        tone: 'info',
      });
      onRefresh();
    } catch (err) {
      onPushAlert({
        title: 'Error',
        message:
          err instanceof Error ? err.message : 'No se pudo cambiar el estado.',
        tone: 'error',
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(shippingFee);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setSavingShipping(true);
    try {
      await api.updateSettings({shippingFee: Math.round(parsed)});
      onPushAlert({
        title: 'Tarifa de envío actualizada',
        message: `El envío a domicilio ahora cuesta $${Math.round(parsed)} MXN.`,
        tone: 'success',
      });
      onRefresh();
    } catch (err) {
      onPushAlert({
        title: 'Error',
        message:
          err instanceof Error ? err.message : 'No se pudo guardar la tarifa.',
        tone: 'error',
      });
    } finally {
      setSavingShipping(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#1A1E2A]">
            Catálogo de Servicios y Precios
          </h1>
          <p className="text-sm text-slate-600">
            Da de alta nuevos servicios, actualiza precios en tiempo real y controla qué servicios están visibles para tus clientes.
          </p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500">
            Servicios registrados
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-[#1A1E2A] tabular-nums">
            {config.services.length}
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500">
            Activos en app cliente
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-[#5E7800] tabular-nums">
            {activeServicesCount}
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500">
            Precio promedio
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-[#1A1E2A] tabular-nums">
            ${avgPrice} MXN
          </div>
        </div>
        <div className="rounded-2xl bg-[#1A1E2A] text-white p-4">
          <div className="text-xs font-semibold text-white/70">
            Envío a domicilio
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-[#FCF61C] tabular-nums">
            ${config.shippingFee} MXN
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Create Service + Shipping Fee */}
        <div className="xl:col-span-5 space-y-5">
          <form
            onSubmit={handleCreate}
            className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8BAF03] text-[#1A1E2A] shrink-0">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-extrabold text-[#1A1E2A]">
                  Dar de alta nuevo servicio
                </h2>
                <p className="text-xs text-slate-600">
                  Se sincroniza al instante en el cotizador del cliente
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                Nombre del servicio
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. Limpieza Profunda + Impermeabilizante"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                Descripción (qué incluye)
              </label>
              <textarea
                rows={2}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Ej. Lavado exterior, suela, agujetas, desodorización y protector repelente."
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                  Precio ($ MXN)
                </label>
                <div className="relative">
                  <DollarSign className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="number"
                    required
                    min={1}
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 font-mono text-sm font-bold text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                  Tiempo estimado (hrs)
                </label>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="number"
                    required
                    min={1}
                    value={newHours}
                    onChange={(e) => setNewHours(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 font-mono text-sm font-bold text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#8BAF03] px-5 text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{creating ? 'Guardando...' : 'Agregar servicio al catálogo'}</span>
            </button>
          </form>

          {/* Home Delivery Fee Card */}
          <form
            onSubmit={handleSaveShipping}
            className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3"
          >
            <div className="flex items-center gap-2 font-display text-sm font-extrabold text-[#1A1E2A]">
              <Truck className="h-4 w-4 text-[#5E7800]" />
              <span>Tarifa de entrega a domicilio</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min={0}
                  value={shippingFee}
                  onChange={(e) => setShippingFee(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 font-mono text-sm font-bold text-[#1A1E2A]"
                />
              </div>
              <button
                type="submit"
                disabled={savingShipping}
                className="min-h-[42px] rounded-xl bg-[#1A1E2A] px-4 text-xs font-bold text-white hover:bg-[#11141D] disabled:opacity-60 cursor-pointer"
              >
                {savingShipping ? 'Guardando...' : 'Actualizar envío'}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Services Catalog & Price Editor */}
        <div className="xl:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#5E7800]" />
              <h2 className="font-display text-lg font-extrabold text-[#1A1E2A]">
                Servicios actuales y precios
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Pulsa «Editar precio» en cualquier servicio
            </span>
          </div>

          <div className="space-y-3">
            {config.services.map((svc) => {
              const isEditing = editingId === svc.id;
              return (
                <div
                  key={svc.id}
                  className={`rounded-2xl border p-4 transition-colors ${
                    svc.active
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-200 bg-slate-50/70 opacity-75'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-6">
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Nombre del servicio
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm font-semibold text-[#1A1E2A]"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Precio ($ MXN)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-full min-h-[40px] rounded-xl border border-[#8BAF03] bg-[#F3F8DE]/40 px-3 font-mono text-sm font-extrabold text-[#1A1E2A]"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Horas estimadas
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={editHours}
                            onChange={(e) => setEditHours(e.target.value)}
                            className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold text-[#1A1E2A]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">
                          Descripción
                        </label>
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 text-xs sm:text-sm text-[#1A1E2A]"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Cancelar</span>
                        </button>
                        <button
                          type="button"
                          disabled={savingId === svc.id}
                          onClick={() => handleSaveEdit(svc.id)}
                          className="min-h-[36px] inline-flex items-center gap-1 rounded-xl bg-[#8BAF03] px-4 text-xs font-bold text-[#1A1E2A] hover:bg-[#749402] disabled:opacity-60 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>
                            {savingId === svc.id ? 'Guardando...' : 'Guardar cambios'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-base font-extrabold text-[#1A1E2A]">
                            {svc.name}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              svc.active
                                ? 'bg-[#F3F8DE] text-[#5E7800]'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {svc.active ? 'Activo' : 'Pausado'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {svc.description}
                        </p>
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                          <Clock className="h-3 w-3" />
                          <span>Entrega estimada: {svc.turnaroundHours} horas</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                        <div className="rounded-xl bg-[#FCF61C]/35 border border-[#8BAF03]/30 px-3 py-1.5 text-right">
                          <div className="font-mono text-lg font-extrabold text-[#1A1E2A] tabular-nums">
                            ${svc.price}
                          </div>
                          <div className="text-[10px] font-bold text-[#5E7800]">
                            MXN / par
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(svc)}
                            className="min-h-[36px] inline-flex items-center justify-center gap-1 rounded-xl border border-[#8BAF03]/40 bg-[#F3F8DE] px-3 text-xs font-bold text-[#1A1E2A] hover:bg-[#8BAF03] transition-colors cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Editar precio</span>
                          </button>
                          <button
                            type="button"
                            disabled={savingId === svc.id}
                            onClick={() => handleToggleActive(svc)}
                            className="min-h-[36px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:text-[#1A1E2A] cursor-pointer disabled:opacity-50"
                          >
                            {svc.active ? 'Pausar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
