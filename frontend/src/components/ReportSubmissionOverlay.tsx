import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, LifeBuoy } from 'lucide-react';
import { useLocale } from '../locale/LocaleContext';
import { getStrings } from '../locale/strings';

const AUTO_DISMISS_SECONDS = 5;

export type ReportSubmissionSummary = {
  location?: string;
  comment?: string;
  attachmentName?: string;
};

export function ReportSubmissionOverlay({
  variant,
  eventTitle,
  submittedSummary,
  onDismiss,
}: {
  variant: 'safe' | 'need_help';
  eventTitle?: string;
  submittedSummary?: ReportSubmissionSummary;
  onDismiss: () => void;
}) {
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;
  const [secondsLeft, setSecondsLeft] = useState(AUTO_DISMISS_SECONDS);
  const dismissedRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    dismissedRef.current = false;
    setSecondsLeft(AUTO_DISMISS_SECONDS);
    const tick = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(tick);
          dismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [variant, eventTitle, dismiss]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismiss]);

  const isSafe = variant === 'safe';
  const title = isSafe ? ec.overlayCompleteTitle : ec.overlayNeedHelpTitle;
  const ctaLabel = isSafe ? ec.overlayDone : ec.overlayGotIt;

  const summaryRows: Array<{ label: string; value: string }> = [];
  if (!isSafe && submittedSummary) {
    const loc = submittedSummary.location?.trim();
    const comment = submittedSummary.comment?.trim();
    const attach = submittedSummary.attachmentName?.trim();
    if (loc) summaryRows.push({ label: ec.locationLabel, value: loc });
    if (comment) summaryRows.push({ label: ec.commentLabel, value: comment });
    if (attach) summaryRows.push({ label: ec.attachTitle, value: attach });
  }

  return createPortal(
    <div
      className={`report-submission-overlay report-submission-overlay--${variant}`}
      role="presentation"
      onClick={dismiss}
    >
      <div
        className="report-submission-overlay-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-submission-overlay-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="report-submission-overlay-countdown">{ec.overlayAutoCloseCountdown(secondsLeft)}</p>

        <div className="report-submission-overlay-icon-wrap" aria-hidden>
          <span className="report-submission-overlay-halo" />
          <span className="report-submission-overlay-icon-circle">
            {isSafe ? <Check size={44} strokeWidth={3} /> : <LifeBuoy size={40} strokeWidth={2.25} />}
          </span>
        </div>

        <h2 id="report-submission-overlay-title" className="report-submission-overlay-title">
          {title}
        </h2>

        {eventTitle ? <p className="report-submission-overlay-event">{eventTitle}</p> : null}

        <p className="report-submission-overlay-body">
          {isSafe ? ec.statusDetailSafe : ec.overlayNeedHelpBody}
        </p>

        {summaryRows.length > 0 ? (
          <div className="report-submission-overlay-summary">
            {summaryRows.map((row) => (
              <div key={row.label} className="report-submission-overlay-summary-row">
                <span className="report-submission-overlay-summary-label">{row.label}</span>
                <span className="report-submission-overlay-summary-value">{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        <button type="button" className="report-submission-overlay-cta" onClick={dismiss}>
          {ctaLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
