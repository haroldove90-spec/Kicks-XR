import type {PaymentMethod} from '../types';

const ALLOWED_MAPS_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'maps.google.com',
  'www.google.com',
  'google.com',
  'www.google.com.mx',
  'google.com.mx',
  'maps.google.com.mx',
]);

export function isSafeGoogleMapsUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_MAPS_HOSTS.has(host)) return false;
    if (
      host === 'www.google.com' ||
      host === 'google.com' ||
      host === 'www.google.com.mx' ||
      host === 'google.com.mx'
    ) {
      return parsed.pathname.startsWith('/maps');
    }
    if (host === 'goo.gl') {
      return parsed.pathname.startsWith('/maps');
    }
    return true;
  } catch {
    return false;
  }
}

export function normalizeGoogleMapsUrl(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return isSafeGoogleMapsUrl(trimmed) ? trimmed : undefined;
}

export function isSafeMercadoPagoUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'www.mercadopago.com.mx' ||
      host === 'www.mercadopago.com' ||
      host === 'sandbox.mercadopago.com.mx' ||
      host === 'sandbox.mercadopago.com' ||
      host.endsWith('.mercadopago.com.mx') ||
      host.endsWith('.mercadopago.com') ||
      host.endsWith('.mercadopago.com.ar') ||
      host.endsWith('.mercadopago.com.co') ||
      host.endsWith('.mercadopago.cl') ||
      host.endsWith('.mercadopago.com.pe')
    );
  } catch {
    return false;
  }
}

export interface ParsedOrderQrData {
  raw: string;
  folio?: string;
  bagCode?: string;
  serviceName?: string;
  totalAmount?: number;
  clientName?: string;
  clientAge?: number;
  clientIdDocument?: string;
  clientAddress?: string;
  clientMapsUrl?: string;
}

export function buildOrderQrPayload(params: {
  folio: string;
  bagCode: string;
  serviceName?: string;
  totalAmount?: number;
  clientName?: string;
  clientAge?: number;
  clientIdDocument?: string;
  clientAddress?: string;
  clientMapsUrl?: string;
}): string {
  const compact: Record<string, string | number> = {
    t: 'KXR',
    f: params.folio,
    b: params.bagCode,
  };
  if (params.serviceName) compact.s = params.serviceName.slice(0, 60);
  if (typeof params.totalAmount === 'number') compact.m = params.totalAmount;
  if (params.clientName) compact.n = params.clientName.slice(0, 80);
  if (typeof params.clientAge === 'number' && params.clientAge > 0) {
    compact.e = params.clientAge;
  }
  if (params.clientIdDocument) compact.id = params.clientIdDocument.slice(0, 40);
  if (params.clientAddress) compact.d = params.clientAddress.slice(0, 140);
  const safeMaps = normalizeGoogleMapsUrl(params.clientMapsUrl);
  if (safeMaps) compact.g = safeMaps;
  return JSON.stringify(compact);
}

export function parseOrderQrPayload(raw: string): ParsedOrderQrData {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return {raw: ''};

  // New structured JSON QR payload
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (obj && (obj.t === 'KXR' || obj.f || obj.b)) {
        const ageNum =
          typeof obj.e === 'number'
            ? obj.e
            : typeof obj.e === 'string' && obj.e.trim()
              ? Number(obj.e)
              : undefined;
        const amountNum =
          typeof obj.m === 'number'
            ? obj.m
            : typeof obj.m === 'string' && obj.m.trim()
              ? Number(obj.m)
              : undefined;
        return {
          raw: trimmed,
          folio: typeof obj.f === 'string' ? obj.f.trim().toUpperCase() : undefined,
          bagCode: typeof obj.b === 'string' ? obj.b.trim().toUpperCase() : undefined,
          serviceName: typeof obj.s === 'string' ? obj.s.trim() : undefined,
          totalAmount:
            typeof amountNum === 'number' && Number.isFinite(amountNum)
              ? amountNum
              : undefined,
          clientName: typeof obj.n === 'string' ? obj.n.trim() : undefined,
          clientAge:
            typeof ageNum === 'number' && Number.isFinite(ageNum) && ageNum > 0
              ? ageNum
              : undefined,
          clientIdDocument: typeof obj.id === 'string' ? obj.id.trim() : undefined,
          clientAddress: typeof obj.d === 'string' ? obj.d.trim() : undefined,
          clientMapsUrl:
            typeof obj.g === 'string' ? normalizeGoogleMapsUrl(obj.g) : undefined,
        };
      }
    } catch {
      // fall through to legacy parsers
    }
  }

  // Legacy pipe format: KICKSXR|FOLIO|BAG|CAMPUS
  if (trimmed.toUpperCase().startsWith('KICKSXR|')) {
    const parts = trimmed.split('|');
    return {
      raw: trimmed,
      folio: parts[1]?.trim().toUpperCase() || undefined,
      bagCode: parts[2]?.trim().toUpperCase() || undefined,
    };
  }

  // Plain folio or bag code
  const upper = trimmed.toUpperCase();
  if (upper.startsWith('B-')) {
    return {raw: trimmed, bagCode: upper};
  }
  return {raw: trimmed, folio: upper};
}

export function formatPaymentMethodLabel(
  method: PaymentMethod,
  cardLast4?: string,
): string {
  if (method === 'mercadopago') return 'Mercado Pago';
  if (method === 'card') {
    return `Tarjeta${cardLast4 ? ` •••• ${cardLast4}` : ''}`;
  }
  return 'Efectivo';
}
