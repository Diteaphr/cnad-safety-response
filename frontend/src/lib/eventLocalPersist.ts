import type { NotificationRecord, NotificationSummary } from '../types';
import { portalLocalStorage, portalSessionStorage } from './browserStorage';

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

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every((v) => typeof v === 'boolean');
}

function isReminderAuditEntry(value: unknown): value is ReminderAuditEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<ReminderAuditEntry>;
  return (
    typeof e.id === 'string' &&
    typeof e.eventId === 'string' &&
    typeof e.sentAt === 'string' &&
    typeof e.sent === 'number' &&
    typeof e.alreadySafe === 'number' &&
    typeof e.totalTeam === 'number'
  );
}

/** 從舊版 sessionStorage 遷移聯繫狀態到 localStorage（跨重新整理保留）。 */
function migrateContactsFromSessionIfNeeded(eventId: string): void {
  const session = portalSessionStorage();
  const storage = portalLocalStorage();
  if (!session || !storage) return;
  try {
    const key = CONTACT_LEGACY_SS + eventId;
    const legacy = session.getItem(key);
    if (!legacy) return;
    const lsKey = CONTACT_KEY_PREFIX + eventId;
    if (!storage.getItem(lsKey)) {
      storage.setItem(lsKey, legacy);
    }
    session.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadContactedMap(eventId: string): Record<string, boolean> {
  migrateContactsFromSessionIfNeeded(eventId);
  const storage = portalLocalStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(CONTACT_KEY_PREFIX + eventId);
    const j = readLsJson<unknown>(raw);
    return isBooleanRecord(j) ? j : {};
  } catch {
    return {};
  }
}

export function saveContactedMap(eventId: string, map: Record<string, boolean>): void {
  const storage = portalLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(CONTACT_KEY_PREFIX + eventId, JSON.stringify(map));
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
  const storage = portalLocalStorage();
  const session = portalSessionStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(REMINDER_AUDIT_KEY);
    const legacySs = session?.getItem(REMINDER_AUDIT_KEY) ?? null;
    if (!raw && legacySs) {
      storage.setItem(REMINDER_AUDIT_KEY, legacySs);
      session?.removeItem(REMINDER_AUDIT_KEY);
    }
    const j = readLsJson<unknown>(storage.getItem(REMINDER_AUDIT_KEY));
    if (!Array.isArray(j)) return [];
    return j.filter(isReminderAuditEntry);
  } catch {
    return [];
  }
}

export function appendReminderAudit(entry: ReminderAuditEntry): void {
  const storage = portalLocalStorage();
  if (!storage) return;
  const prev = readReminderAuditEntries();
  const next = [entry, ...prev].slice(0, 120);
  try {
    storage.setItem(REMINDER_AUDIT_KEY, JSON.stringify(next));
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

function isReminderChannel(channel: string): boolean {
  const lower = channel.toLowerCase();
  return channel.includes('reminder') || lower.includes('fcm');
}

function isSmsChannel(channel: string): boolean {
  return channel.toLowerCase().includes('sms');
}

export function buildNotificationPageSummary(input: {
  reminderHistory: NotificationRecord[];
  apiRowsSameUser: Array<{ channel: string; status: string }>;
  targetedEmployeeCountForEvent: number;
  responsesCountForEvent: number;
}): NotificationSummary {
  const reminders = input.apiRowsSameUser.filter((r) => isReminderChannel(r.channel));
  const pushSent = reminders.filter((r) => r.status === 'sent').length;
  const derivedPending = Math.max(0, input.targetedEmployeeCountForEvent - input.responsesCountForEvent);
  const pushFailed = reminders.filter((r) => r.status === 'failed').length || (pushSent === 0 ? derivedPending : 0);
  const smsFallbackSent = reminders.filter((r) => isSmsChannel(r.channel)).length;

  return {
    pushSent: pushSent || Math.min(input.targetedEmployeeCountForEvent, input.responsesCountForEvent),
    pushFailed,
    smsFallbackSent,
    reminderHistory: input.reminderHistory,
  };
}
