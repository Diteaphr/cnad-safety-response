import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CloudUpload,
  MapPin,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useLocale } from '../../locale/LocaleContext';
import { getStrings } from '../../locale/strings';
import type { Department, EventItem, SafetyResponse } from '../../types';
import type { EmployeeReportFields } from './memberScreens';
import { formatFileSize } from './memberFormat';
import { ReportHistoryEventInfo } from './ReportHistoryEventInfo';

type DraftBaseline = {
  comment: string;
  location: string;
  attachment: File | null;
  omitStoredAttachment: boolean;
};

export function ReportRevisionModal({
  open,
  event,
  latestResponse,
  departments,
  reportSubmitting,
  submitErrorMessage,
  onDismissSubmitError,
  onRetrySubmit,
  onSubmit,
  onClose,
}: {
  open: boolean;
  event: EventItem | null;
  latestResponse: SafetyResponse | null;
  departments: Department[];
  reportSubmitting: boolean;
  submitErrorMessage: string | null;
  onDismissSubmitError: () => void;
  onRetrySubmit: () => void;
  onSubmit: (
    status: 'safe' | 'need_help',
    fields: EmployeeReportFields,
    meta?: { omitStoredAttachment?: boolean; showOverlay?: boolean },
  ) => void | Promise<void>;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [comment, setComment] = useState('');
  const [location, setLocation] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [omitStoredAttachment, setOmitStoredAttachment] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<DraftBaseline | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const MAX_COMMENT_LEN = 500;
  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

  const wasSafe = latestResponse?.status === 'safe';
  const fieldId = event?.id.replace(/[^a-zA-Z0-9_-]/g, '') ?? 'rev';

  useEffect(() => {
    if (!open || !latestResponse) return;
    const c = latestResponse.comment ?? '';
    const loc = latestResponse.location ?? '';
    setComment(c);
    setLocation(loc);
    setAttachment(null);
    setOmitStoredAttachment(false);
    setUploadNotice(null);
    setBaseline({ comment: c, location: loc, attachment: null, omitStoredAttachment: false });
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  }, [open, latestResponse?.id, latestResponse?.updatedAt]);

  const isDirty =
    baseline !== null &&
    (comment !== baseline.comment ||
      location !== baseline.location ||
      attachment !== baseline.attachment ||
      omitStoredAttachment !== baseline.omitStoredAttachment);

  const reportFields = (): EmployeeReportFields => ({
    comment,
    location,
    attachment,
  });

  const submitMeta = { omitStoredAttachment, showOverlay: true as const };

  const applyAttachment = (file: File | undefined | null) => {
    setUploadNotice(null);
    if (!file) {
      setAttachment(null);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadNotice(ec.uploadTooBig);
      return;
    }
    setOmitStoredAttachment(false);
    setAttachment(file);
  };

  const requestClose = () => {
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  };

  const handleSubmitNeedHelp = () => {
    if (reportSubmitting) return;
    void onSubmit('need_help', reportFields(), submitMeta);
  };

  const handleSaveNeedHelp = () => {
    if (reportSubmitting) return;
    void onSubmit('need_help', reportFields(), submitMeta);
  };

  const handleSwitchToSafe = () => {
    if (reportSubmitting) return;
    void onSubmit('safe', { comment: '', location: '', attachment: null }, submitMeta);
  };

  if (!open || !event || !latestResponse) return null;

  return createPortal(
    <>
      <div className="modal-backdrop report-revision-modal-backdrop" onClick={requestClose}>
        <div
          className="modal report-revision-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-revision-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="report-revision-modal-head">
            <div className="report-revision-modal-head-main">
              <ReportHistoryEventInfo
                event={event}
                departments={departments}
                titleId="report-revision-modal-title"
              />
            </div>
            <button type="button" className="report-revision-modal-close" aria-label={ec.close} onClick={requestClose}>
              <X size={18} strokeWidth={2.25} aria-hidden />
            </button>
          </header>

          {wasSafe ? (
            <p className="report-revision-modal-prompt">
              {ec.historySwitchToNeedHelpPromptPrefix}
              <span className="report-revision-tone-need">{ec.cardNeedHelpShort}</span>
              {ec.historySwitchToNeedHelpPromptSuffix}
            </p>
          ) : null}

          {reportSubmitting ? (
            <p className="employee-submit-progress" aria-live="polite">
              {ec.submitting}
            </p>
          ) : null}

          {submitErrorMessage ? (
            <div className="employee-submit-error-banner report-revision-modal-error" role="alert">
              <AlertCircle size={22} aria-hidden />
              <div className="employee-submit-error-body">
                <strong>{ec.submitFailTitle}</strong>
                <p>{submitErrorMessage}</p>
                <div className="employee-submit-error-actions">
                  <button type="button" className="btn primary" disabled={reportSubmitting} onClick={onRetrySubmit}>
                    <RefreshCw size={16} aria-hidden /> {ec.retry}
                  </button>
                  <button type="button" className="btn ghost" onClick={onDismissSubmitError}>
                    {ec.close}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="report-revision-modal-body">
            <div className="employee-fields">
              <label className="employee-field-label" htmlFor={`rev-loc-${fieldId}`}>
                {ec.locationLabel}
              </label>
              <div className="input-with-leading-icon">
                <span className="input-leading-ic" aria-hidden>
                  <MapPin size={16} strokeWidth={2} color="#3d5f85" />
                </span>
                <input
                  id={`rev-loc-${fieldId}`}
                  placeholder={ec.locationPlaceholder}
                  disabled={reportSubmitting}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <label className="employee-field-label" htmlFor={`rev-comment-${fieldId}`}>
                {ec.commentLabel}
              </label>
              <div className="textarea-with-leading-icon">
                <span className="input-leading-ic textarea-leading" aria-hidden>
                  <MessageSquare size={16} strokeWidth={2} color="#3d5f85" />
                </span>
                <textarea
                  id={`rev-comment-${fieldId}`}
                  placeholder={ec.commentPlaceholder}
                  disabled={reportSubmitting}
                  value={comment}
                  maxLength={MAX_COMMENT_LEN}
                  onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_LEN))}
                />
                <span className="employee-char-count">
                  {comment.length}/{MAX_COMMENT_LEN}
                </span>
              </div>
            </div>

            <article className="event-detail-card report-revision-attach-card">
              <div className="event-detail-card-head">
                <span className="event-detail-card-icon">
                  <Paperclip size={18} strokeWidth={1.75} aria-hidden />
                </span>
                <h3>
                  {ec.attachTitle}{' '}
                  {wasSafe ? <span className="employee-optional-hint">（{ec.optionalBadge}）</span> : null}
                </h3>
              </div>
              {!wasSafe && latestResponse.attachmentName && !attachment && !omitStoredAttachment ? (
                <div className="employee-attached-existing">
                  <span className="employee-attached-thumb" aria-hidden />
                  <div className="employee-attached-meta">
                    <strong>{latestResponse.attachmentName}</strong>
                    <span>{formatFileSize(latestResponse.attachmentSizeBytes)}</span>
                  </div>
                  <div className="employee-attached-actions">
                    <button
                      type="button"
                      className="btn ghost btn-compact"
                      onClick={() => attachmentInputRef.current?.click()}
                    >
                      {ec.replaceAttachment}
                    </button>
                    <button
                      type="button"
                      className="btn ghost btn-icon-danger"
                      aria-label={ec.removeAttachmentAria}
                      onClick={() => setOmitStoredAttachment(true)}
                    >
                      <Trash2 size={18} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                </div>
              ) : null}
              <input
                ref={attachmentInputRef}
                id={`rev-file-${fieldId}`}
                type="file"
                className="visually-hidden-input"
                onChange={(e) => applyAttachment(e.target.files?.[0])}
              />
              <label
                htmlFor={`rev-file-${fieldId}`}
                className={`employee-drop-zone${dropActive ? ' is-dragging' : ''}${attachment ? ' has-file' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={() => setDropActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropActive(false);
                  applyAttachment(e.dataTransfer.files?.[0]);
                }}
              >
                <span className="employee-drop-ic" aria-hidden>
                  <CloudUpload size={34} strokeWidth={1.45} color="#1e5494" />
                </span>
                <span className="employee-drop-title">{ec.dropTitle}</span>
                <span className="employee-drop-hint">{ec.dropHint}</span>
                {attachment ? <span className="employee-drop-file">{attachment.name}</span> : null}
                {uploadNotice ? <span className="employee-drop-error">{uploadNotice}</span> : null}
              </label>
              {attachment ? (
                <button
                  type="button"
                  className="btn ghost btn-remove-att"
                  onClick={() => {
                    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
                    applyAttachment(null);
                  }}
                >
                  {ec.removeAttachment}
                </button>
              ) : null}
            </article>
          </div>

          <footer className="report-revision-modal-footer">
            {wasSafe ? (
              <button
                type="button"
                className="btn btn-block report-revision-btn-need"
                disabled={reportSubmitting}
                onClick={handleSubmitNeedHelp}
              >
                {ec.submitNeedHelp}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn primary btn-block"
                  disabled={reportSubmitting || !isDirty}
                  onClick={handleSaveNeedHelp}
                >
                  {ec.historySaveChanges}
                </button>
                <button
                  type="button"
                  className="report-revision-switch-safe"
                  disabled={reportSubmitting}
                  onClick={handleSwitchToSafe}
                >
                  {ec.historySwitchToSafePrefix}
                  <span className="report-revision-tone-safe">{ec.cardIamSafeShort}</span>
                </button>
              </>
            )}
          </footer>
        </div>
      </div>

      <ConfirmModal
        open={discardOpen}
        title={ec.historyDiscardTitle}
        description={ec.historyDiscardBody}
        cancelText={ec.historyDiscardContinue}
        confirmText={ec.historyDiscardConfirm}
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          onClose();
        }}
      />
    </>,
    document.body,
  );
}
