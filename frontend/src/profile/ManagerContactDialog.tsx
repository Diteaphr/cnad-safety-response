import { useEffect, useRef } from 'react';
import { Copy } from 'lucide-react';
import type { ToastState, User } from '../types';

async function copyToClipboard(text: string): Promise<boolean> {
  if (!globalThis.navigator?.clipboard?.writeText) return false;
  try {
    await globalThis.navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

type ManagerContactDialogProps = Readonly<{
  manager: User;
  open: boolean;
  onClose: () => void;
  showToast: (t: ToastState) => void;
}>;

export function ManagerContactDialog({ manager, open, onClose, showToast }: ManagerContactDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return undefined;
    if (!dialog.open) dialog.showModal();
    const t = globalThis.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      globalThis.clearTimeout(t);
      if (dialog.open) dialog.close();
    };
  }, [open]);

  if (!open) return null;

  const rows: Array<{ label: string; value: string }> = [{ label: '電子郵件', value: manager.email }];
  if (manager.phone?.trim()) rows.push({ label: '電話', value: manager.phone.trim() });
  if (manager.teamsUsername?.trim()) rows.push({ label: 'Teams', value: manager.teamsUsername.trim() });

  const handleCopy = async (value: string) => {
    const ok = await copyToClipboard(value);
    if (ok) showToast({ tone: 'success', message: '已複製到剪貼簿' });
    else showToast({ tone: 'danger', message: '無法複製，請手動選取' });
  };

  return (
    <dialog
      ref={dialogRef}
      className="profile-settings-contact-dialog-root"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <button
        type="button"
        className="profile-settings-contact-dialog-scrim"
        aria-label="關閉"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="modal profile-settings-contact-dialog"
        aria-labelledby="manager-contact-title"
        tabIndex={-1}
      >
        <h3 id="manager-contact-title">聯絡 {manager.name}</h3>
        <p className="profile-settings-contact-hint">點選「複製」可將內容貼到郵件或訊息。</p>
        <ul className="profile-settings-contact-rows">
          {rows.map((row) => (
            <li key={row.label}>
              <div>
                <span className="profile-settings-contact-label">{row.label}</span>
                <span className="profile-settings-contact-value">{row.value}</span>
              </div>
              <button
                type="button"
                className="btn ghost profile-settings-copy-btn"
                onClick={() => handleCopy(row.value)}
              >
                <Copy size={16} aria-hidden />
                複製
              </button>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={onClose}>
            關閉
          </button>
        </div>
      </div>
    </dialog>
  );
}
