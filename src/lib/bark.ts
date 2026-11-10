export interface BarkOptions {
  baseUrl: string;
  deviceKey: string;
  group: string;
  sound: string;
  level: string;
  icon: string;
}

export interface BarkDetail {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    bodyPreview: string;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    bodySnippet: string;
  };
  error?: { name: string; message: string; stack?: string };
  timings: { startedAt: string; elapsedMs: number };
}

export interface BarkResult {
  ok: boolean;
  httpStatus: number | null;
  elapsedMs: number;
  error: string | null;
  detail: BarkDetail;
}

const MAX_TEXT = 2000;

function clip(text: string, limit = MAX_TEXT): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export function maskDeviceKey(url: string): string {
  return url.replace(/\/[^/]+\/?$/, '/••••••/');
}

/**
 * 发送一条 Bark 推送。调用内不重试，重试由调用方控制。
 */
export async function sendBark(
  options: BarkOptions,
  payload: { title: string; body: string },
): Promise<BarkResult> {
  const url = `${options.baseUrl.replace(/\/+$/, '')}/${options.deviceKey}`;
  const body = {
    title: payload.title,
    body: payload.body,
    ...(options.group ? { group: options.group } : {}),
    ...(options.sound ? { sound: options.sound } : {}),
    ...(options.level ? { level: options.level } : {}),
    ...(options.icon ? { icon: options.icon } : {}),
  };

  const detail: BarkDetail = {
    request: {
      method: 'POST',
      url: maskDeviceKey(url),
      headers: { 'content-type': 'application/json' },
      bodyPreview: clip(JSON.stringify(body)),
    },
    timings: { startedAt: new Date().toISOString(), elapsedMs: 0 },
  };

  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const elapsedMs = Date.now() - started;
    const text = await response.text().catch(() => '');

    detail.response = {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'content-type': response.headers.get('content-type') ?? '',
        'cf-ray': response.headers.get('cf-ray') ?? '',
      },
      bodySnippet: clip(text),
    };
    detail.timings.elapsedMs = elapsedMs;

    if (!response.ok) {
      return {
        ok: false,
        httpStatus: response.status,
        elapsedMs,
        error: `Bark responded ${response.status}`,
        detail: {
          ...detail,
          error: { name: 'HttpError', message: `Bark responded ${response.status}` },
        },
      };
    }

    return { ok: true, httpStatus: response.status, elapsedMs, error: null, detail };
  } catch (err) {
    const elapsedMs = Date.now() - started;
    const error = err as Error;
    detail.timings.elapsedMs = elapsedMs;
    return {
      ok: false,
      httpStatus: null,
      elapsedMs,
      error: error.message,
      detail: {
        ...detail,
        error: { name: error.name, message: error.message, stack: clip(error.stack ?? '') },
      },
    };
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
