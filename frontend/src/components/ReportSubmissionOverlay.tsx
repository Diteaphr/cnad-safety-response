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

function getSummaryRows(isSafe: boolean, submittedSummary: ReportSubmissionSummary | undefined, ec: any) {
  const rows: Array<{ label: string; value: string }> = [];
  if (!isSafe && submittedSummary) {
    const loc = submittedSummary.location?.trim();
    const comment = submittedSummary.comment?.trim();
    const attach = submittedSummary.attachmentName?.trim();
    if (loc) rows.push({ label: ec.locationLabel, value: loc });
    if (comment) rows.push({ label: ec.commentLabel, value: comment });
    if (attach) rows.push({ label: ec.attachTitle, value: attach });
  }
  return rows;
}

export function ReportSubmissionOverlay({
  variant,
  mode = 'initial',
  eventTitle,
  submittedSummary,
  onDismiss,
}: {
  variant: 'safe' | 'need_help';
  mode?: 'initial' | 'revision';
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
    const tick = globalThis.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          globalThis.clearInterval(tick);
          dismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => globalThis.clearInterval(tick);
  }, [variant, mode, eventTitle, dismiss]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [dismiss]);

  const isSafe = variant === 'safe';
  const isRevision = mode === 'revision';

  let title = ec.overlayNeedHelpTitle;
  if (isRevision) {
    title = ec.overlayRevisionTitle;
  } else if (isSafe) {
    title = ec.overlayCompleteTitle;
  }

  let body = ec.overlayNeedHelpBody;
  if (isRevision) {
    body = isSafe ? ec.overlayRevisionSafeBody : ec.overlayRevisionNeedHelpBody;
  } else if (isSafe) {
    body = ec.statusDetailSafe;
  }

  const ctaLabel = isSafe ? ec.overlayDone : ec.overlayGotIt;

  const summaryRows = getSummaryRows(isSafe, submittedSummary, ec);

  return createPortal(
    <div className={`report-submission-overlay report-submission-overlay--${variant}`}>
      {/* NOSONAR */}
      <button
        type="button"
        aria-label="Close"
        className="report-submission-overlay-backdrop-fallback"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          cursor: 'pointer',
          border: 'none',
          background: 'none',
          width: '100%',
          height: '100%'
        }}
        onClick={dismiss}
      />
      <dialog
        open
        className="report-submission-overlay-panel"
        aria-labelledby="report-submission-overlay-title"
        style={{ position: 'relative' }}
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

        <p className="report-submission-overlay-body">{body}</p>

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
      </dialog>
    </div>,
    document.body,
  );
}
