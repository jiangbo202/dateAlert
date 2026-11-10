export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    issues?: Array<{ code: string; field?: string; message: string }>;
    retryAfter?: number;
    conflict?: [string, string];
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: ApiErrorBody['error'] | null;
  readonly retryAfter: number;

  constructor(status: number, code: string, body: ApiErrorBody['error'] | null) {
    super(body?.message ?? code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
    this.retryAfter = body?.retryAfter ?? 0;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  headers.set('accept', 'application/json');

  const res = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' });
  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const body = (payload as ApiErrorBody | null)?.error ?? null;
    throw new ApiError(res.status, body?.code ?? `HTTP_${res.status}`, body);
  }

  return payload as T;
}
