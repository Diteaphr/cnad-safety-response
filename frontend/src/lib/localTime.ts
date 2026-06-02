import type { AppLocale } from '../locale/LocaleContext';

/** BCP 47 tag used by dashboard「上次同步」and all portal time display. */
export function localeTag(locale: AppLocale): 'en-US' | 'zh-TW' {
  return locale === 'en' ? 'en-US' : 'zh-TW';
}

/** Device clock instant (ms) — same capture as `dashboardUpdatedAt` / 上次同步. */
export function nowMs(): number {
  return Date.now();
}

/** UTC ISO string for API/storage; same instant as {@link nowMs}. */
export function nowUtcIso(): string {
  return new Date(nowMs()).toISOString();
}

function toDate(value: number | Date | string): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  return new Date(value);
}

/** Format instant for UI — uses device timezone via `toLocaleString` (matches 上次同步). */
export function formatLocaleDateTime(
  value: number | Date | string,
  locale: AppLocale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  const tag = localeTag(locale);
  return options ? d.toLocaleString(tag, options) : d.toLocaleString(tag);
}

export function formatLocaleTime(
  value: number | Date | string,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' },
): string {
  return formatLocaleDateTime(value, locale, options);
}

/** Header line: `上次同步: …` */
export function formatLastSyncedLabel(
  lastSyncedLabel: string,
  ts: number | null,
  locale: AppLocale,
): string | null {
  if (ts === null) return null;
  return `${lastSyncedLabel}: ${formatLocaleDateTime(ts, locale)}`;
}

/**
 * Value for `<input type="datetime-local">` in the user's local timezone.
 * Do not use `toISOString().slice(0, 16)` — that is UTC and causes offset bugs.
 */
export function localDateTimeLocalInputValue(at: Date = new Date(nowMs())): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** `datetime-local` field value → UTC ISO for backend (browser parses as local). */
export function datetimeLocalToUtcIso(value: string): string {
  return new Date(value).toISOString();
}
