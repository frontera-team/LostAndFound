(function () {
  const ACCESS = 'lf_access_token';
  const REFRESH = 'lf_refresh_token';

  function getOrigin() {
    const m = document.querySelector('meta[name="api-origin"]');
    const v = m && m.getAttribute('content');
    return (v && v.trim()) || '';
  }

  function buildUrl(path) {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${getOrigin()}${p}`;
  }

  function getAccess() {
    return localStorage.getItem(ACCESS);
  }

  function getRefresh() {
    return localStorage.getItem(REFRESH);
  }

  function setTokens(access, refresh) {
    if (access) localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  }

  function clearTokens() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  }

  async function tryRefresh() {
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
      localStorage.setItem(ACCESS, data.access_token);
      return true;
    }
    return false;
  }

  /**
   * @param {string} path absolute path starting with /api/...
   * @param {RequestInit & { json?: unknown, skipAuth?: boolean }} options
   */
  async function request(path, options = {}) {
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

  window.LF_API = {
    getOrigin,
    buildUrl,
    request,
    getAccess,
    getRefresh,
    setTokens,
    clearTokens,
  };
})();
