import type {IncomingMessage, ServerResponse} from 'http';
import {getApiApp} from '../src/server/app.ts';

type VercelIncomingMessage = IncomingMessage & {
  body?: unknown;
  _body?: boolean;
};

function prepareRequestForExpress(req: VercelIncomingMessage): void {
  const desc = Object.getOwnPropertyDescriptor(req, 'body');
  if (desc && typeof desc.get === 'function') {
    let parsedBody: unknown;
    try {
      parsedBody = req.body;
    } catch {
      parsedBody = undefined;
    }
    if (
      typeof parsedBody === 'string' &&
      (req.headers['content-type'] || '').includes('application/json')
    ) {
      try {
        parsedBody = JSON.parse(parsedBody);
      } catch {
        // Keep raw string if JSON parsing fails; route validation will handle it
      }
    }
    if (parsedBody !== undefined) {
      Object.defineProperty(req, 'body', {
        value: parsedBody,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      req._body = true;
    }
    return;
  }

  if (desc && 'value' in desc && desc.value !== undefined && req.readableEnded) {
    if (
      typeof desc.value === 'string' &&
      (req.headers['content-type'] || '').includes('application/json')
    ) {
      try {
        req.body = JSON.parse(desc.value);
      } catch {
        // Leave body as-is
      }
    }
    req._body = true;
  }
}

export default async function handler(
  req: VercelIncomingMessage,
  res: ServerResponse,
): Promise<void> {
  prepareRequestForExpress(req);
  const app = await getApiApp();

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    res.once('finish', done);
    res.once('close', done);
    res.once('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
    app(req as never, res as never);
  });
}
