export function ConfirmModal({
  open,
  title,
  description,
  cancelText = 'Cancel',
  confirmText,
  confirmTone = 'danger',
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  cancelText?: string;
  confirmText: string;
  confirmTone?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel} type="button">
            {cancelText}
          </button>
          <button className={confirmTone === 'primary' ? 'btn primary' : 'btn danger'} onClick={onConfirm} type="button">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

