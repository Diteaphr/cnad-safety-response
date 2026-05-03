import type { NotificationRecord, NotificationSummary } from '../types';

const CONTACT_KEY_PREFIX = 'cnad-contacted-need-help:v1:';
const CONTACT_LEGACY_SS = CONTACT_KEY_PREFIX; // formerly sessionStorage — migrate once
const REMINDER_AUDIT_KEY = 'cnad-reminder-audit:v1';

function readLsJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 從舊版 sessionStorage 遷移聯繫狀態到 localStorage（跨重新整理保留）。 */
function migrateContactsFromSessionIfNeeded(eventId: string): void {
  try {
    const key = CONTACT_LEGACY_SS + eventId;
    const legacy = sessionStorage.getItem(key);
    if (!legacy) return;
    const lsKey = CONTACT_KEY_PREFIX + eventId;
    if (!window.localStorage.getItem(lsKey)) {
      window.localStorage.setItem(lsKey, legacy);
    }
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadContactedMap(eventId: string): Record<string, boolean> {
  migrateContactsFromSessionIfNeeded(eventId);
  try {
    const raw = window.localStorage.getItem(CONTACT_KEY_PREFIX + eventId);
    const j = readLsJson<unknown>(raw);
    if (!j || typeof j !== 'object') return {};
    return j as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function saveContactedMap(eventId: string, map: Record<string, boolean>): void {
  try {
    window.localStorage.setItem(CONTACT_KEY_PREFIX + eventId, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

export type ReminderAuditEntry = {
  id: string;
  eventId: string;
  sentAt: string;
  sent: number;
  alreadySafe: number;
  totalTeam: number;
};

function readReminderAuditEntries(): ReminderAuditEntry[] {
  try {
    const raw = window.localStorage.getItem(REMINDER_AUDIT_KEY);
    const legacySs = typeof window.sessionStorage !== 'undefined' ? window.sessionStorage.getItem(REMINDER_AUDIT_KEY) : null;
    if (!raw && legacySs) {
      window.localStorage.setItem(REMINDER_AUDIT_KEY, legacySs);
      window.sessionStorage.removeItem(REMINDER_AUDIT_KEY);
    }
    const j = readLsJson<unknown>(window.localStorage.getItem(REMINDER_AUDIT_KEY));
    if (!Array.isArray(j)) return [];
    return j as ReminderAuditEntry[];
  } catch {
    return [];
  }
}

export function appendReminderAudit(entry: ReminderAuditEntry): void {
  const prev = readReminderAuditEntries();
  const next = [entry, ...prev].slice(0, 120);
  try {
    window.localStorage.setItem(REMINDER_AUDIT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function reminderHistoryForEvent(eventId: string): NotificationRecord[] {
  return readReminderAuditEntries()
    .filter((e) => e.eventId === eventId)
    .map((e) => ({
      id: e.id,
      eventId: e.eventId,
      sentAt: e.sentAt,
      sentByRole: 'supervisor',
      note: `Reminders dispatched: sent ${e.sent} / team ${e.totalTeam} (skipped already safe: ${e.alreadySafe})`,
    }));
}

export function buildNotificationPageSummary(input: {
  reminderHistory: NotificationRecord[];
  apiRowsSameUser: Array<{ channel: string; status: string }>;
  targetedEmployeeCountForEvent: number;
  responsesCountForEvent: number;
}): NotificationSummary {
  const reminders = input.apiRowsSameUser.filter(
    (r) => String(r.channel).includes('reminder') || String(r.channel).toLowerCase().includes('fcm'),
  );
  const pushSent = reminders.filter((r) => r.status === 'sent').length;
  const derivedPending = Math.max(0, input.targetedEmployeeCountForEvent - input.responsesCountForEvent);
  const pushFailed = reminders.filter((r) => r.status === 'failed').length || (pushSent === 0 ? derivedPending : 0);
  const smsFallbackSent = reminders.filter((r) => String(r.channel).toLowerCase().includes('sms')).length;

  return {
    pushSent: pushSent || Math.min(input.targetedEmployeeCountForEvent, input.responsesCountForEvent),
    pushFailed,
    smsFallbackSent,
    reminderHistory: input.reminderHistory,
  };
}
