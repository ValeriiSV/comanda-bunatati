const API_KEY = 'AIzaSyDu86lUJXgQYTkbNQlLX3bIFd5ht3_PWoY';
const PROJECT_ID = 'comanda-bunatati';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_BASE = `https://identitytoolkit.googleapis.com/v1/accounts`;
const TOKEN_KEY = 'bunatati_admin_session_v3';

type Session = {
  idToken: string;
  refreshToken: string;
  uid: string;
  email: string;
  expiresAt: number;
  provider?: 'password' | 'google';
};

export type RestDocument = { name?: string; fields?: Record<string, FireValue> };
type FireValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  mapValue?: { fields?: Record<string, FireValue> };
  arrayValue?: { values?: FireValue[] };
};

function saveSession(session: Session) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
}

export function saveExternalAdminSession(input: { idToken: string; uid: string; email: string }) {
  const session: Session = {
    idToken: input.idToken,
    refreshToken: '',
    uid: input.uid,
    email: input.email,
    expiresAt: Date.now() + 50 * 60 * 1000,
    provider: 'google',
  };
  saveSession(session);
  return session;
}

export function clearAdminSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('bunatati_admin_session_v1');
  localStorage.removeItem('bunatati_admin_session_v2');
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) as Session : null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw new Error('TIMEOUT_FIREBASE');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function jsonOrThrow(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `HTTP_${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function adminLogin(email: string, password: string): Promise<Session> {
  const response = await fetchWithTimeout(`${AUTH_BASE}:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password, returnSecureToken: true }),
  });
  const data = await jsonOrThrow(response);
  const session: Session = {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    uid: data.localId,
    email: data.email || email.trim(),
    expiresAt: Date.now() + (Number(data.expiresIn || 3600) - 60) * 1000,
    provider: 'password',
  };
  saveSession(session);
  return session;
}

async function refreshSession(session: Session): Promise<Session> {
  if (!session.refreshToken) throw new Error('SESSION_EXPIRED');
  const response = await fetchWithTimeout(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: session.refreshToken }),
  });
  const data = await jsonOrThrow(response);
  const updated: Session = {
    idToken: data.id_token,
    refreshToken: data.refresh_token || session.refreshToken,
    uid: data.user_id || session.uid,
    email: session.email,
    expiresAt: Date.now() + (Number(data.expires_in || 3600) - 60) * 1000,
    provider: session.provider,
  };
  saveSession(updated);
  return updated;
}

export async function getAdminSession(): Promise<Session | null> {
  let session = readSession();
  if (!session) return null;
  try {
    if (Date.now() >= session.expiresAt) session = await refreshSession(session);
    return session;
  } catch {
    clearAdminSession();
    return null;
  }
}

export function toFireValue(value: unknown): FireValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFireValue) } };
  if (typeof value === 'object') {
    const fields: Record<string, FireValue> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => { fields[key] = toFireValue(val); });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

export function fromFireValue(value?: FireValue): any {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return new Date(value.timestampValue || '');
  if ('nullValue' in value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(fromFireValue);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, fromFireValue(v)]));
  return undefined;
}

export function decodeDocument(doc: RestDocument) {
  const data: Record<string, any> = {};
  Object.entries(doc.fields || {}).forEach(([key, value]) => { data[key] = fromFireValue(value); });
  data.id = doc.name?.split('/').pop() || '';
  return data;
}

async function authHeaders() {
  const session = await getAdminSession();
  if (!session) throw new Error('SESSION_EXPIRED');
  return { Authorization: `Bearer ${session.idToken}`, 'Content-Type': 'application/json' };
}

export async function listCollection(path: string) {
  const headers = await authHeaders();
  const response = await fetchWithTimeout(`${FIRESTORE_BASE}/${path}?pageSize=300`, { headers });
  const data = await jsonOrThrow(response);
  return (data.documents || []).map(decodeDocument);
}

export async function getDocument(path: string) {
  const headers = await authHeaders();
  const response = await fetchWithTimeout(`${FIRESTORE_BASE}/${path}`, { headers });
  if (response.status === 404) return null;
  return decodeDocument(await jsonOrThrow(response));
}

export async function setDocument(path: string, data: Record<string, unknown>) {
  const headers = await authHeaders();
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFireValue(value)]));
  const response = await fetchWithTimeout(`${FIRESTORE_BASE}/${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields }),
  });
  return jsonOrThrow(response);
}

export async function updateDocument(path: string, data: Record<string, unknown>) {
  const headers = await authHeaders();
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFireValue(value)]));
  const mask = Object.keys(data).map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join('&');
  const response = await fetchWithTimeout(`${FIRESTORE_BASE}/${path}?${mask}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields }),
  });
  return jsonOrThrow(response);
}

export async function deleteDocument(path: string) {
  const headers = await authHeaders();
  const response = await fetchWithTimeout(`${FIRESTORE_BASE}/${path}`, { method: 'DELETE', headers });
  if (!response.ok && response.status !== 404) await jsonOrThrow(response);
}
