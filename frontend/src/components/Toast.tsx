import type { ToastState } from '../types';

export function Toast({ toast }: Readonly<{ toast: ToastState | null }>) {
  if (!toast) return null;
  return <div className={`toast ${toast.tone}`}>{toast.message}</div>;
}

