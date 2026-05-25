import type { AppLocale } from '../../locale/LocaleContext';

/** Compact date/time for profile subordinate history cards (mobile-friendly). */
export function formatProfileHistoryTime(iso: string | null | undefined, locale: AppLocale) {
  if (iso == null || iso === '') return '—';
  const tag = locale === 'en' ? 'en-US' : 'zh-TW';
  return new Date(iso).toLocaleString(tag, {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatEmployeeCardTime(iso: string | null, locale: AppLocale) {
  if (iso == null || iso === '') {
    return '—';
  }
  const tag = locale === 'en' ? 'en-US' : 'zh-TW';
  return new Date(iso).toLocaleString(tag, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatFileSize(bytes?: number | null) {
  if (bytes == null || bytes <= 0) return '—';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
