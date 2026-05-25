import { useEffect, useRef } from 'react';
import { Copy } from 'lucide-react';
import type { DashboardStrings } from '../../locale/strings';
import type { ToastState } from '../../types';

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function EmployeeContactDialog({
  name,
  department,
  phone,
  email,
  note,
  locationLine,
  open,
  onClose,
  dash,
  showToast,
}: {
  name: string;
  department: string;
  phone?: string;
  email?: string;
  note?: string;
  locationLine?: string;
  open: boolean;
  onClose: () => void;
  dash: DashboardStrings;
  showToast: (t: ToastState) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  const rows: Array<{ label: string; value: string; copyable: boolean }> = [];
  if (email?.trim()) rows.push({ label: dash.supervisorEmailLabel, value: email.trim(), copyable: true });
  else rows.push({ label: dash.supervisorEmailLabel, value: dash.supervisorNoEmail, copyable: false });
  if (phone?.trim()) rows.push({ label: dash.phoneLabel, value: phone.trim(), copyable: true });
  else rows.push({ label: dash.phoneLabel, value: dash.noPhone, copyable: false });
  if (department) rows.push({ label: dash.adminDeptColDept, value: department, copyable: false });
  const extra = [locationLine, note].filter(Boolean).join(' · ');
  if (extra) rows.push({ label: dash.supervisorContactNotes, value: extra, copyable: false });

  const handleCopy = async (value: string) => {
    const ok = await copyToClipboard(value);
    if (ok) showToast({ tone: 'success', message: '已複製到剪貼簿' });
    else showToast({ tone: 'danger', message: '無法複製，請手動選取' });
  };

  return (
    <div
      className="modal-backdrop profile-settings-modal-root"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="modal profile-settings-contact-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-contact-title"
        tabIndex={-1}
      >
        <h3 id="employee-contact-title">{dash.supervisorContactTitle(name)}</h3>
        <p className="profile-settings-contact-hint">{dash.supervisorContactHint}</p>
        <ul className="profile-settings-contact-rows">
          {rows.map((row) => (
            <li key={row.label}>
              <div>
                <span className="profile-settings-contact-label">{row.label}</span>
                <span className="profile-settings-contact-value">{row.value}</span>
              </div>
              {row.copyable ? (
                <button
                  type="button"
                  className="btn ghost profile-settings-copy-btn"
                  onClick={() => handleCopy(row.value)}
                >
                  <Copy size={16} aria-hidden />
                  {dash.supervisorContactCopy}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={onClose}>
            {dash.supervisorContactClose}
          </button>
        </div>
      </div>
    </div>
  );
}
