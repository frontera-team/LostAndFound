const ACCESS_KEY = 'lf_access_token';
const REFRESH_KEY = 'lf_refresh_token';

function getOrigin(): string {
  const meta = document.querySelector('meta[name="api-origin"]');
  const value = meta?.getAttribute('content');
  return (value && value.trim()) || '';
}

function buildUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getOrigin()}${p}`;
}

function getAccess(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

function getRefresh(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

function setTokens(access?: string | null, refresh?: string | null): void {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function tryRefresh(): Promise<boolean> {
  const rt = getRefresh();
  if (!rt) return false;
  const res = await fetch(buildUrl('/api/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: rt }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem(ACCESS_KEY, data.access_token);
    return true;
  }
  return false;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  json?: unknown;
  skipAuth?: boolean;
  body?: BodyInit | null;
}

/** path — абсолютный, начинающийся с /api/... */
async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const { json, skipAuth, headers: hdr, ...rest } = options;
  const headers = new Headers(hdr || {});

  if (!skipAuth) {
    const token = getAccess();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let body = rest.body;
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }

  const url = path.startsWith('http') ? path : buildUrl(path);
  let res = await fetch(url, { ...rest, headers, body });

  if (res.status === 401 && !skipAuth) {
    const rt = getRefresh();
    if (rt) {
      const ok = await tryRefresh();
      if (ok) {
        const retryHeaders = new Headers(headers);
        const t = getAccess();
        if (t) retryHeaders.set('Authorization', `Bearer ${t}`);
        res = await fetch(url, { ...rest, headers: retryHeaders, body });
      }
    } else if (getAccess()) {
      // Просроченный/битый access без refresh — не слать его снова
      clearTokens();
    }
  }

  return res;
}

function formatErrorDetail(detail: unknown): string {
  if (detail == null) return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (d && typeof d === 'object' && 'msg' in d ? (d as { msg: string }).msg : d)).join('; ');
  }
  if (typeof detail === 'object' && detail !== null && 'message' in detail) {
    return String((detail as { message: unknown }).message);
  }
  return typeof detail === 'object' ? JSON.stringify(detail) : String(detail);
}

async function parseError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    if (j.detail) {
      const formatted = formatErrorDetail(j.detail);
      if (formatted) return formatted;
    }
    return j.error || j.message || `Ошибка ${res.status}`;
  } catch {
    return `Ошибка ${res.status}`;
  }
}

export const api = {
  getOrigin,
  buildUrl,
  request,
  getAccess,
  getRefresh,
  setTokens,
  clearTokens,
  formatErrorDetail,
  parseError,
};
