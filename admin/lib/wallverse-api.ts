const API_BASE = process.env.NEXT_PUBLIC_WALLVERSE_API_URL || 'http://localhost:5000/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('wv_token');
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    // Only treat as session expiry if we had a token — login failures return 401 too
    localStorage.removeItem('wv_token');
    if (typeof window !== 'undefined') {
      window.location.href = '/wallverse/login';
    }
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  setup: (email: string, password: string, name: string) =>
    request('/auth/setup', { method: 'POST', body: JSON.stringify({ email, password, name }) }),

  me: () => request('/auth/me'),
};

// ── Wallpapers ────────────────────────────────────────────────────────────────
export const wallpaperApi = {
  list: (params?: Record<string, string | number>) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request(`/wallpapers${qs}`);
  },

  get: (id: string) => request(`/wallpapers/${id}`),

  stats: () => request('/wallpapers/admin/stats'),

  upload: (formData: FormData) =>
    request('/wallpapers', { method: 'POST', body: formData }),

  update: (id: string, data: object) =>
    request(`/wallpapers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request(`/wallpapers/${id}`, { method: 'DELETE' }),
};

// ── Categories ────────────────────────────────────────────────────────────────
export const categoryApi = {
  list: () => request('/categories'),

  create: (data: object) =>
    request('/categories', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: object) =>
    request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request(`/categories/${id}`, { method: 'DELETE' }),
};
