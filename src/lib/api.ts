// Keep any in-tab Bearer fallback strictly in volatile JavaScript memory (never in localStorage/sessionStorage).
// Reload persistence relies exclusively on HttpOnly, SameSite session cookies sent via credentials: 'include'.
let csrfTokenMemory: string | null = null;
let sessionTokenMemory: string | null = null;
let adminReturnLabelMemory: string | null = null;

function readStoredSessionToken(): string | null {
  return sessionTokenMemory;
}

export function setSessionToken(token: string | null) {
  sessionTokenMemory = token;
}

export function setAdminReturnLabelMemory(label: string | null) {
  adminReturnLabelMemory = label;
}

export function getAdminReturnLabelMemory(): string | null {
  return adminReturnLabelMemory;
}

export function setCsrfToken(token: string | null) {
  csrfTokenMemory = token;
}

export function getCsrfToken(): string | null {
  return csrfTokenMemory;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }

  const activeSessionToken = readStoredSessionToken();
  if (activeSessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${activeSessionToken}`);
  }

  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && csrfTokenMemory) {
    headers.set('X-CSRF-Token', csrfTokenMemory);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(data?.error || 'Request failed.', response.status);
    }
    if (data?.sessionToken) {
      setSessionToken(data.sessionToken);
    }
    if (data?.csrfToken) {
      csrfTokenMemory = data.csrfToken;
    }
    return data as T;
  }

  if (!response.ok) {
    throw new ApiError('Request failed.', response.status);
  }
  return (await response.text()) as unknown as T;
}

export async function apiFetchBlob(url: string): Promise<{ blob: Blob; contentType: string; filename: string }> {
  const headers = new Headers();
  const activeSessionToken = readStoredSessionToken();
  if (activeSessionToken) {
    headers.set('Authorization', `Bearer ${activeSessionToken}`);
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const errData = await response.json().catch(() => ({}));
      throw new ApiError(errData?.error || 'Unable to load document.', response.status);
    }
    throw new ApiError('Unable to load document.', response.status);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || 'document';
  const blob = await response.blob();
  return { blob, contentType, filename };
}

export async function apiDownload(url: string, fallbackFilename: string): Promise<void> {
  const { blob, filename } = await apiFetchBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename || fallbackFilename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}
