import React from 'react';
import {Check, CircleDot} from 'lucide-react';
import type {OrderStatus, StatusHistoryEntry} from '../types';

const TIMELINE_STEPS: OrderStatus[] = [
  'Depósito reportado',
  'Recibido por KicksXR',
  'En limpieza',
  'Listo para entrega',
  'Entregado',
];

interface OrderTimelineProps {
  currentStatus: OrderStatus;
  history?: StatusHistoryEntry[];
}

export const OrderTimeline: React.FC<OrderTimelineProps> = ({
  currentStatus,
  history = [],
}) => {
  const activeIndex = TIMELINE_STEPS.indexOf(currentStatus);

  const safeHistory = Array.isArray(history) ? history : [];

  const getStepInfo = (step: OrderStatus) => {
    const match = [...safeHistory].reverse().find((h) => h.status === step);
    return match;
  };

  if (currentStatus === 'Cancelado') {
    const cancelEntry = [...safeHistory]
      .reverse()
      .find((h) => h.status === 'Cancelado');
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 space-y-1">
        <div className="font-bold">Pedido cancelado</div>
        {cancelEntry?.note && <p className="text-xs text-red-700">{cancelEntry.note}</p>}
        {cancelEntry?.timestamp && (
          <div className="font-mono text-[11px] text-red-600">
            {new Date(cancelEntry.timestamp).toLocaleString('es-MX')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {TIMELINE_STEPS.map((step, idx) => {
        const isCompleted = activeIndex > idx || currentStatus === 'Entregado';
        const isCurrent = activeIndex === idx && currentStatus !== 'Entregado';
        const isLast = idx === TIMELINE_STEPS.length - 1;
        const entry = getStepInfo(step);

        return (
          <div key={step} className="relative flex items-start gap-3.5">
            <div className="flex flex-col items-center">
              <div
                className={`z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                  isCompleted
                    ? 'border-[#8BAF03] bg-[#8BAF03] text-[#1A1E2A]'
                    : isCurrent
                      ? 'border-[#8BAF03] bg-[#FCF61C]/40 text-[#1A1E2A]'
                      : 'border-slate-200 bg-white text-slate-300'
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 stroke-[2.75]" />
                ) : isCurrent ? (
                  <CircleDot className="h-4 w-4" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-slate-200" />
                )}
              </div>
              {!isLast && (
                <div
                  className={`w-0.5 h-8 my-0.5 ${
                    isCompleted ? 'bg-[#8BAF03]' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>

            <div
              className={`flex-1 rounded-xl px-3.5 py-2 -mt-0.5 transition-colors ${
                isCurrent
                  ? 'bg-[#F3F8DE] text-[#1A1E2A]'
                  : isCompleted
                    ? 'text-[#1A1E2A]'
                    : 'text-slate-400'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`text-sm ${
                    isCurrent || isCompleted ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {step}
                </span>
                {entry?.timestamp && (
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {new Date(entry.timestamp).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
              {entry?.note && (
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                  {entry.note}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
