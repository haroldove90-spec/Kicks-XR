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

  const getStepInfo = (step: OrderStatus) => {
    const match = [...history].reverse().find((h) => h.status === step);
    return match;
  };

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
                    ? 'border-[#109173] bg-[#109173] text-white'
                    : isCurrent
                      ? 'border-[#109173] bg-[#E6F7F3] text-[#109173]'
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
                    isCompleted ? 'bg-[#109173]' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>

            <div
              className={`flex-1 rounded-xl px-3.5 py-2 -mt-0.5 transition-colors ${
                isCurrent
                  ? 'bg-[#E6F7F3] text-[#000831]'
                  : isCompleted
                    ? 'text-[#000831]'
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
