import type { Department, EventItem, Role, SafetyResponse, User } from './types';

/**
 * 後端 API 路徑皆以 `/api/...` 開頭；基底請填 **服務根網址**（不含 `/api`）。
 * 若誤設成 `http://localhost:8000/api`，會造成 `/api/api/events` → 404，這裡會自動去掉尾端 `/api`。
 */
function normalizeApiBase(raw: string): string {
  let b = raw.trim().replace(/\/+$/, '');
  if (b.toLowerCase().endsWith('/api')) {
    b = b.slice(0, -4).replace(/\/+$/, '');
  }
  return b;
}

const API_BASE = normalizeApiBase((import.meta.env.VITE_API_URL as string | undefined) ?? '');

export type DemoAccount = { id: string; label: string; roles: Role[]; userId: string };

/** 空字串 = 與目前網頁同源（Vite `server.proxy` 或 nginx 的 `/api` 轉發）。有值 = 直連後端，例如 `http://localhost:8000`。 */
function requestUrl(path: string): string {
  if (API_BASE === '') {
    return path;
  }
  return `${API_BASE}${path}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(requestUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    try {
      const j = JSON.parse(text) as { detail?: unknown };
      const d = j?.detail;
      if (typeof d === 'string') throw new Error(d);
      if (Array.isArray(d)) throw new Error(JSON.stringify(d));
    } catch (e) {
      if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
    }
    throw new Error(text || res.statusText);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function getDemoAccounts(): Promise<DemoAccount[]> {
  const data = await apiFetch<{ accounts: DemoAccount[] }>('/api/demo-accounts');
  return data.accounts;
}

export async function getDepartments(): Promise<Department[]> {
  const data = await apiFetch<{ departments: Department[] }>('/api/departments');
  return data.departments;
}

export async function getUsers(): Promise<User[]> {
  const data = await apiFetch<{ users: User[] }>('/api/users');
  return data.users;
}

export async function getEvents(): Promise<EventItem[]> {
  const data = await apiFetch<{ events: EventItem[] }>('/api/events');
  return data.events;
}

export async function getReports(): Promise<SafetyResponse[]> {
  const data = await apiFetch<{ reports: SafetyResponse[] }>('/api/reports');
  return data.reports;
}

export async function createEventApi(
  actorUserId: string,
  body: {
    title: string;
    type: EventItem['type'];
    description: string;
    startAt: string;
    targetDepartmentIds: string[];
  },
): Promise<{ message: string; event: EventItem }> {
  return apiFetch('/api/events', {
    method: 'POST',
    headers: { 'X-User-Id': actorUserId },
    body: JSON.stringify({
      title: body.title,
      type: body.type,
      description: body.description,
      startAt: body.startAt,
      targetDepartmentIds: body.targetDepartmentIds,
    }),
  });
}

export async function activateEventApi(actorUserId: string, eventId: string): Promise<{ message: string; event: EventItem }> {
  return apiFetch(`/api/events/${encodeURIComponent(eventId)}/activate`, {
    method: 'POST',
    headers: { 'X-User-Id': actorUserId },
    body: JSON.stringify({}),
  });
}

export async function closeEventApi(actorUserId: string, eventId: string): Promise<{ message: string; event: EventItem }> {
  return apiFetch(`/api/events/${encodeURIComponent(eventId)}/close`, {
    method: 'POST',
    headers: { 'X-User-Id': actorUserId },
  });
}

export async function registerApi(body: {
  name: string;
  email: string;
  password: string;
  departmentId?: string;
  phone?: string;
  employeeNo?: string;
}): Promise<{ message: string; user: User }> {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function loginWithEmailApi(body: {
  email: string;
  password: string;
}): Promise<{ user: User }> {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function submitReportApi(payload: {
  eventId: string;
  userId: string;
  status: 'safe' | 'need_help';
  location?: string;
  comment?: string;
}): Promise<{ status: string; message: string; data: SafetyResponse }> {
  return apiFetch('/api/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
