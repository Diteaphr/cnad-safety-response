import { ArrowLeft } from 'lucide-react';

/** Unified content-area back control; hidden on narrow viewports (Layout mobile header handles back). */
export function PageBackButton({
  onClick,
  ariaLabel,
  className = '',
}: {
  onClick: () => void;
  ariaLabel: string;
  className?: string;
}) {
  const classes = ['page-content-back', className].filter(Boolean).join(' ');

  return (
    <button type="button" className={classes} onClick={onClick} aria-label={ariaLabel} title={ariaLabel}>
      <ArrowLeft size={18} strokeWidth={2.25} aria-hidden />
    </button>
  );
}
