import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CloudUpload,
  FileImage,
  Headphones,
  Info,
  LifeBuoy,
  MapPin,
  MessageSquare,
  Paperclip,
  Pencil,
  Phone,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PageBackButton } from '../../components/PageBackButton';
import { useLocale } from '../../locale/LocaleContext';
import { getStrings } from '../../locale/strings';
import { formatLocaleDateTime, formatLocaleTime } from '../../lib/localTime';
import { formatFileSize } from './memberFormat';
import {
  heroSublineText,
  needRevisionButtonClass,
  safeRevisionButtonClass,
  safeWideButtonClass,
} from './employeeQuickReportHelpers';
import {
  useEmployeeQuickReport,
  type EmployeeQuickReportPanelProps,
} from './useEmployeeQuickReport';

export function EmployeeQuickReportPanel(props: EmployeeQuickReportPanelProps) { // NOSONAR - view shell; state in useEmployeeQuickReport
  const {
    userName,
    selectedEvent,
    currentDepartment,
    latestResponse,
    reportSubmitting,
    submitErrorMessage,
    onDismissSubmitError,
    onRetrySubmit,
    layout = 'full',
    hideEmergencyContact = false,
    stackSectionId,
    onBackToEvents,
    stackInitialReport = false,
  } = props;
  const vm = useEmployeeQuickReport(props);
  const {
    attachmentInputRef,
    helpDetailsRef,
    dropActive,
    setDropActive,
    employeeComment,
    setEmployeeComment,
    employeeLocation,
    setEmployeeLocation,
    employeeAttachment,
    selectedNeedHelp,
    wantToUpdate,
    pendingSubmission,
    discardPromptAfter,
    setDiscardPromptAfter,
    uploadNotice,
    omitStoredAttachment,
    setOmitStoredAttachment,
    hasReport,
    showReportingControls,
    isRevisionDraft,
    showHelpDetailsPanel,
    needFlowActive,
    safeButtonDimmed,
    isDraftDirty,
    maxCommentLen: MAX_COMMENT_LEN,
    handleSubmitSafeTap,
    handleNeedHelpTap,
    handleConfirmNeedHelp,
    enterRevisionMode,
    confirmDiscardDraft,
    requestBackNavigation,
    requestCancelRevision,
    handleSaveRevision,
    applyAttachment,
  } = vm;
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;
  if (!selectedEvent) return null;

  const fieldId = selectedEvent.id.replace(/[^a-zA-Z0-9_-]/g, '');
  const heroTimeSource = selectedEvent.startAt ?? selectedEvent.createdAt;
  const heroTime = formatLocaleDateTime(heroTimeSource, locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const fullHero =
    layout === 'full' ? (
      <header className="employee-event-hero">
        <div className="employee-event-hero-art" aria-hidden />
        <div className="employee-event-hero-body">
          <div className="employee-event-icon-ring">
            <Activity size={36} strokeWidth={1.6} aria-hidden />
          </div>
          <h1 className="employee-event-headline">{selectedEvent.title}</h1>
          <p className="employee-event-subline">
            {heroSublineText(hasReport, wantToUpdate, ec.heroSublineReporting, ec.heroSublineDraft, userName)}
          </p>
          <div className="employee-event-meta-pill">
            <span className="employee-event-meta-item">
              <span className="employee-event-meta-ic" aria-hidden>
                ●
              </span>
              {selectedEvent.type}
            </span>
            <span className="employee-event-meta-split" aria-hidden />
            <span className="employee-event-meta-item">{currentDepartment}</span>
            <span className="employee-event-meta-split" aria-hidden />
            <span className="employee-event-meta-item">{heroTime}</span>
          </div>
        </div>
      </header>
    ) : null;

  return (
    <>
      {layout === 'full' && onBackToEvents ? (
        <div className="employee-event-page-nav">
          <PageBackButton onClick={requestBackNavigation} ariaLabel={ec.backToEventsAria} />
        </div>
      ) : null}
      {fullHero}
      {reportSubmitting ? (
        <p className="employee-submit-progress" aria-live="polite">
          {ec.submitting}
        </p>
      ) : null}
      {submitErrorMessage ? (
        <div className="employee-submit-error-banner" role="alert">
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

      <div
        className={`employee-event-body${layout === 'embedded' ? ' employee-quick-report-body--embedded' : ''}`}
        id={stackSectionId}
      >
        <div className={`employee-event-shell${isRevisionDraft ? ' employee-event-shell--revision' : ''}`}>
              {!showReportingControls && latestResponse && !stackInitialReport ? (
                <>
                  <div className="employee-submit-success-banner">
                    <CheckCircle2 className="employee-submit-success-ic" size={40} strokeWidth={2} aria-hidden />
                    <div className="employee-submit-success-copy">
                      <strong>Report Submitted</strong>
                      <p>Your status has been shared with your emergency response team.</p>
                    </div>
                  </div>

                  <article className="event-detail-card employee-status-overview-card">
                    <h3 className="employee-section-title">
                      <Users size={22} strokeWidth={1.75} className="employee-section-title-icon" aria-hidden />
                      Your current status
                    </h3>
                    <div className="employee-status-overview-grid">
                      <div
                        className={`employee-status-slot ${latestResponse.status === 'safe' ? 'employee-status-slot--active-safe' : 'employee-status-slot--muted'}`}
                      >
                        {latestResponse.status === 'safe' ? (
                          <span className="employee-status-slot-check" aria-hidden>
                            <CheckCircle2 size={22} strokeWidth={2} />
                          </span>
                        ) : null}
                        <ShieldCheck size={28} strokeWidth={1.5} aria-hidden />
                        <div>
                          <div className="employee-status-slot-title">I&apos;m Safe</div>
                          <div className="employee-status-slot-hint">{latestResponse.status === 'safe' ? 'This is the status you submitted.' : 'Not selected.'}</div>
                        </div>
                      </div>
                      <div
                        className={`employee-status-slot ${latestResponse.status === 'need_help' ? 'employee-status-slot--active-help' : 'employee-status-slot--muted'}`}
                      >
                        {latestResponse.status === 'need_help' ? (
                          <span className="employee-status-slot-check employee-status-slot-check--help" aria-hidden>
                            <CheckCircle2 size={22} strokeWidth={2} />
                          </span>
                        ) : null}
                        <LifeBuoy size={28} strokeWidth={1.5} aria-hidden />
                        <div>
                          <div className="employee-status-slot-title">I need help</div>
                          <div className="employee-status-slot-hint">{latestResponse.status === 'need_help' ? 'This is the status you submitted.' : 'Not selected.'}</div>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="event-detail-card employee-summary-card">
                    <h3 className="employee-section-title">
                      <ClipboardList size={22} strokeWidth={1.75} className="employee-section-title-icon" aria-hidden />
                      Submitted summary
                    </h3>
                    <dl className="employee-summary-rows">
                      <div className="employee-summary-row">
                        <dt>Status</dt>
                        <dd>
                          <span className={latestResponse.status === 'safe' ? 'employee-pill-safe' : 'employee-pill-help'}>
                            {latestResponse.status === 'safe' ? "I'm Safe" : 'I need help'}
                          </span>
                        </dd>
                      </div>
                      <div className="employee-summary-row">
                        <dt>{ec.submittedAtLabel}</dt>
                        <dd>
                          {`${formatLocaleTime(latestResponse.updatedAt, locale, { hour: 'numeric', minute: '2-digit' })} (${formatLocaleTime(latestResponse.updatedAt, locale, {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true,
                            })})`}
                        </dd>
                      </div>
                      <div className="employee-summary-row">
                        <dt>{ec.locationLabel}</dt>
                        <dd>{latestResponse.location?.trim() || '—'}</dd>
                      </div>
                      <div className="employee-summary-row">
                        <dt>{ec.commentLabel}</dt>
                        <dd>{latestResponse.comment?.trim() || '—'}</dd>
                      </div>
                      <div className="employee-summary-row employee-summary-row--files">
                        <dt>{ec.attachTitle}</dt>
                        <dd>
                          {latestResponse.attachmentName ? (
                            <span className="employee-file-chip">
                              <FileImage size={18} strokeWidth={1.75} aria-hidden />
                              <span>
                                <strong>{latestResponse.attachmentName}</strong>
                                <span className="employee-file-chip-meta">{formatFileSize(latestResponse.attachmentSizeBytes)}</span>
                              </span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                    </dl>

                    <div className="employee-summary-actions">
                      <button type="button" className="btn btn-navy-solid" onClick={enterRevisionMode}>
                        <Pencil size={18} strokeWidth={2} aria-hidden /> {ec.editReport}
                      </button>
                      <button type="button" className="btn employee-btn-outline" onClick={() => onBackToEvents?.()}>
                        {ec.done}
                      </button>
                    </div>
                  </article>
                </>
              ) : null}
              {!showReportingControls && latestResponse && stackInitialReport && !wantToUpdate ? (
                <div className="member-initial-report-done">
                  <CheckCircle2 size={36} strokeWidth={2} className="member-initial-report-done-ic" aria-hidden />
                  <div className="member-initial-report-done-copy">
                    <strong>{ec.reportSuccessTitle}</strong>
                    <p className="muted-text">
                      {latestResponse.status === 'safe' ? ec.statusDetailSafe : ec.statusDetailNeedHelp}
                    </p>
                    <p className="muted-text small">{ec.tapCardToEditHint}</p>
                  </div>
                </div>
              ) : null}
              {showReportingControls ? (
                <>
                  {isRevisionDraft ? (
                    <output className="employee-edit-alert">
                      <Info size={22} strokeWidth={2} className="employee-edit-alert-icon" aria-hidden />
                      <div>
                        <strong>Editing submitted report</strong>
                        <p>You can update your information and save your changes.</p>
                      </div>
                    </output>
                  ) : null}

                  {stackInitialReport && !isRevisionDraft ? (
                      <div className={`member-initial-report-actions${reportSubmitting ? ' is-disabled' : ''}`}>
                        <button
                          type="button"
                          disabled={reportSubmitting}
                          className={`employee-status-wide safe member-initial-report-btn${safeButtonDimmed ? ' is-dimmed' : ''}`}
                          onClick={handleSubmitSafeTap}
                        >
                          <span className="employee-status-inner">
                            <span className="employee-status-ic" aria-hidden>
                              <ShieldCheck size={28} strokeWidth={1.65} />
                            </span>
                            <span className="employee-status-label">I&apos;m Safe</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={reportSubmitting}
                          className={`employee-status-wide need member-initial-report-btn${selectedNeedHelp ? ' is-selected' : ''}`}
                          onClick={handleNeedHelpTap}
                        >
                          <span className="employee-status-inner">
                            <span className="employee-status-ic" aria-hidden>
                              <LifeBuoy size={28} strokeWidth={1.65} />
                            </span>
                            <span className="employee-status-label">I need help</span>
                          </span>
                        </button>
                      </div>
                  ) : (
                  <article className="event-detail-card">
                    <div className="event-detail-card-head">
                      <span className="event-detail-card-icon">
                        <Users size={22} strokeWidth={1.75} aria-hidden />
                      </span>
                      <h3>{ec.reportCardTitle}</h3>
                    </div>
                    <div className={`employee-status-row${isRevisionDraft ? ' employee-status-row--revision' : ''}`}>
                      <button
                        type="button"
                        disabled={reportSubmitting}
                        className={
                          isRevisionDraft
                            ? safeRevisionButtonClass(pendingSubmission)
                            : safeWideButtonClass(safeButtonDimmed)
                        }
                        onClick={handleSubmitSafeTap}
                      >
                        {isRevisionDraft && pendingSubmission === 'safe' ? (
                          <span className="employee-revision-corner-badge employee-revision-corner-badge--safe" aria-hidden>
                            <CheckCircle2 size={22} strokeWidth={2.25} />
                          </span>
                        ) : null}
                        <span className="employee-status-inner">
                          <span className="employee-status-ic" aria-hidden>
                            <ShieldCheck size={28} strokeWidth={1.65} />
                          </span>
                          <span className="employee-status-label">I&apos;m Safe</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={reportSubmitting}
                        className={
                          isRevisionDraft
                            ? needRevisionButtonClass(pendingSubmission)
                            : 'employee-status-wide need'
                        }
                        onClick={handleNeedHelpTap}
                      >
                        {isRevisionDraft && needFlowActive ? (
                          <span className="employee-choice-check" aria-hidden>
                            ✓
                          </span>
                        ) : null}
                        {isRevisionDraft && pendingSubmission === 'need_help' ? (
                          <span className="employee-revision-corner-badge employee-revision-corner-badge--need" aria-hidden>
                            <CheckCircle2 size={22} strokeWidth={2.25} />
                          </span>
                        ) : null}
                        <span className="employee-status-inner">
                          <span className="employee-status-ic" aria-hidden>
                            <LifeBuoy size={28} strokeWidth={1.65} />
                          </span>
                          <span className="employee-status-label">I need help</span>
                        </span>
                      </button>
                    </div>
                  </article>
                  )}

                  {!isRevisionDraft && showReportingControls && selectedNeedHelp ? (
                    <div ref={helpDetailsRef} className="employee-help-details-panel">
                      <article className="event-detail-card">
                        <div className="event-detail-card-head">
                          <span className="event-detail-card-icon">
                            <ClipboardList size={22} strokeWidth={1.75} aria-hidden />
                          </span>
                          <h3>
                            {ec.supplementaryTitle}{' '}
                            <span className="employee-optional-hint">（{ec.optionalBadge}）</span>
                          </h3>
                        </div>
                        <div className="employee-fields">
                          <label className="employee-field-label" htmlFor={`emp-loc-${fieldId}`}>
                            {ec.locationLabel}
                          </label>
                          <div className="input-with-leading-icon">
                            <span className="input-leading-ic" aria-hidden>
                              <MapPin size={19} strokeWidth={2} color="#3d5f85" />
                            </span>
                            <input
                              id={`emp-loc-${fieldId}`}
                              placeholder={ec.locationPlaceholder}
                              disabled={reportSubmitting}
                              value={employeeLocation}
                              onChange={(e) => setEmployeeLocation(e.target.value)}
                            />
                          </div>

                          <label className="employee-field-label" htmlFor={`emp-comment-${fieldId}`}>
                            {ec.commentLabel}
                          </label>
                          <div className="textarea-with-leading-icon">
                            <span className="input-leading-ic textarea-leading" aria-hidden>
                              <MessageSquare size={19} strokeWidth={2} color="#3d5f85" />
                            </span>
                            <textarea
                              id={`emp-comment-${fieldId}`}
                              placeholder={ec.commentPlaceholder}
                              disabled={reportSubmitting}
                              value={employeeComment}
                              maxLength={MAX_COMMENT_LEN}
                              onChange={(e) => setEmployeeComment(e.target.value.slice(0, MAX_COMMENT_LEN))}
                            />
                            <span className="employee-char-count">{employeeComment.length}/{MAX_COMMENT_LEN}</span>
                          </div>
                        </div>
                      </article>

                      <article className="event-detail-card">
                        <div className="event-detail-card-head">
                          <span className="event-detail-card-icon">
                            <Paperclip size={22} strokeWidth={1.75} aria-hidden />
                          </span>
                          <h3>
                            {ec.attachTitle}{' '}
                            <span className="employee-optional-hint">（{ec.optionalBadge}）</span>
                          </h3>
                        </div>
                        <input
                          ref={attachmentInputRef}
                          id={`emp-file-${fieldId}`}
                          type="file"
                          className="visually-hidden-input"
                          onChange={(e) => applyAttachment(e.target.files?.[0], ec.uploadTooBig)}
                        />
                        <label
                          htmlFor={`emp-file-${fieldId}`}
                          className={`employee-drop-zone${dropActive ? ' is-dragging' : ''}${employeeAttachment ? ' has-file' : ''}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDropActive(true);
                          }}
                          onDragLeave={() => setDropActive(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDropActive(false);
                            applyAttachment(e.dataTransfer.files?.[0], ec.uploadTooBig);
                          }}
                        >
                          <span className="employee-drop-ic" aria-hidden>
                            <CloudUpload size={46} strokeWidth={1.45} color="#1e5494" />
                          </span>
                          <span className="employee-drop-title">{ec.dropTitle}</span>
                          <span className="employee-drop-hint">{ec.dropHint}</span>
                          {employeeAttachment ? <span className="employee-drop-file">{employeeAttachment.name}</span> : null}
                          {uploadNotice ? <span className="employee-drop-error">{uploadNotice}</span> : null}
                        </label>
                        {employeeAttachment ? (
                          <button
                            type="button"
                            className="btn ghost btn-remove-att"
                            onClick={() => {
                              if (attachmentInputRef.current) attachmentInputRef.current.value = '';
                              applyAttachment(null, ec.uploadTooBig);
                            }}
                          >
                            {ec.removeAttachment}
                          </button>
                        ) : null}
                      </article>
                      <button
                        type="button"
                        className="btn primary btn-block employee-submit-need-help"
                        disabled={reportSubmitting}
                        onClick={handleConfirmNeedHelp}
                      >
                        {ec.submitNeedHelp}
                      </button>
                    </div>
                  ) : null}

                  {isRevisionDraft && showHelpDetailsPanel ? (
                    <div ref={helpDetailsRef} className="employee-help-details-panel">
                    <article className="event-detail-card">
                      <div className="event-detail-card-head">
                        <span className="event-detail-card-icon">
                          <ClipboardList size={22} strokeWidth={1.75} aria-hidden />
                        </span>
                        <h3>{ec.revisionDetailsHeading}</h3>
                      </div>
                      <div className="employee-fields">
                        <label className="employee-field-label" htmlFor={`emp-loc-rev-${fieldId}`}>
                          {ec.locationLabel}
                        </label>
                        <div className="input-with-leading-icon">
                          <span className="input-leading-ic" aria-hidden>
                            <MapPin size={19} strokeWidth={2} color="#3d5f85" />
                          </span>
                          <input
                            id={`emp-loc-rev-${fieldId}`}
                            placeholder={ec.locationPlaceholder}
                            disabled={reportSubmitting}
                            value={employeeLocation}
                            onChange={(e) => setEmployeeLocation(e.target.value)}
                          />
                        </div>

                        <label className="employee-field-label" htmlFor={`emp-comment-rev-${fieldId}`}>
                          {ec.commentLabel}
                        </label>
                        <div className="textarea-with-leading-icon">
                          <span className="input-leading-ic textarea-leading" aria-hidden>
                            <MessageSquare size={19} strokeWidth={2} color="#3d5f85" />
                          </span>
                          <textarea
                            id={`emp-comment-rev-${fieldId}`}
                            placeholder={ec.commentPlaceholder}
                            disabled={reportSubmitting}
                            value={employeeComment}
                            maxLength={MAX_COMMENT_LEN}
                            onChange={(e) => setEmployeeComment(e.target.value.slice(0, MAX_COMMENT_LEN))}
                          />
                          <span className="employee-char-count">{employeeComment.length}/{MAX_COMMENT_LEN}</span>
                        </div>
                      </div>
                    </article>

                    <article className="event-detail-card">
                      <div className="event-detail-card-head">
                        <span className="event-detail-card-icon">
                          <Paperclip size={22} strokeWidth={1.75} aria-hidden />
                        </span>
                        <h3>{ec.attachTitle}</h3>
                      </div>
                      {isRevisionDraft && latestResponse?.attachmentName && !employeeAttachment && !omitStoredAttachment ? (
                        <div className="employee-attached-existing">
                          <span className="employee-attached-thumb" aria-hidden />
                          <div className="employee-attached-meta">
                            <strong>{latestResponse.attachmentName}</strong>
                            <span>{formatFileSize(latestResponse.attachmentSizeBytes)}</span>
                          </div>
                          <div className="employee-attached-actions">
                            <button type="button" className="btn ghost btn-compact" onClick={() => attachmentInputRef.current?.click()}>
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
                      <input ref={attachmentInputRef} id={`emp-file-rev-${fieldId}`} type="file" className="visually-hidden-input" onChange={(e) => applyAttachment(e.target.files?.[0], ec.uploadTooBig)} />
                      <label
                        htmlFor={`emp-file-rev-${fieldId}`}
                        className={`employee-drop-zone${dropActive ? ' is-dragging' : ''}${employeeAttachment ? ' has-file' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDropActive(true);
                        }}
                        onDragLeave={() => setDropActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDropActive(false);
                          applyAttachment(e.dataTransfer.files?.[0], ec.uploadTooBig);
                        }}
                      >
                        <span className="employee-drop-ic" aria-hidden>
                          <CloudUpload size={46} strokeWidth={1.45} color="#1e5494" />
                        </span>
                        <span className="employee-drop-title">{ec.dropTitle}</span>
                        <span className="employee-drop-hint">{ec.dropHint}</span>
                        {employeeAttachment ? <span className="employee-drop-file">{employeeAttachment.name}</span> : null}
                        {uploadNotice ? <span className="employee-drop-error">{uploadNotice}</span> : null}
                      </label>
                      {employeeAttachment ? (
                        <button
                          type="button"
                          className="btn ghost btn-remove-att"
                          onClick={() => {
                            if (attachmentInputRef.current) attachmentInputRef.current.value = '';
                            applyAttachment(null, ec.uploadTooBig);
                          }}
                        >
                          {ec.removeAttachment}
                        </button>
                      ) : null}
                    </article>
                  </div>
                  ) : null}
                </>
              ) : null}

              {hideEmergencyContact ? null : (
              <article className="event-detail-card event-detail-card--emergency">
                <div className="event-detail-card-head">
                  <span className="event-detail-card-icon">
                    <Phone size={22} strokeWidth={1.8} aria-hidden />
                  </span>
                  <h3>{ec.emergencyContactTitle}</h3>
                </div>
                <div className="emergency-inline emergency-inline--desktop">
                  <a className="emergency-slot" href="tel:+886212345678">
                    <span className="emergency-slot-ic emergency-slot-ic--headset" aria-hidden>
                      <Headphones size={20} strokeWidth={2} />
                    </span>
                    <div>
                      <div className="emergency-slot-title">Emergency Hotline</div>
                      <div className="emergency-slot-num">+886 (2) 1234-5678</div>
                    </div>
                  </a>
                  <span className="emergency-vrule" aria-hidden />
                  <a className="emergency-slot" href="tel:+886298765432">
                    <span className="emergency-slot-ic emergency-slot-ic--people" aria-hidden>
                      <Users size={20} strokeWidth={2} />
                    </span>
                    <div>
                      <div className="emergency-slot-title">HR Duty Line</div>
                      <div className="emergency-slot-num">+886 (2) 9876-5432</div>
                    </div>
                  </a>
                </div>
                <div className="emergency-list emergency-list--narrow">
                  <a className="emergency-row" href="tel:+886212345678">
                    <span className="emergency-row-ic" aria-hidden>
                      <Headphones size={20} strokeWidth={2} />
                    </span>
                    <div className="emergency-row-text">
                      <div className="emergency-slot-title">Emergency Hotline</div>
                      <div className="emergency-slot-num">+886 (2) 1234-5678</div>
                    </div>
                    <span className="emergency-row-chevron" aria-hidden>
                      <ChevronRight size={20} strokeWidth={2} />
                    </span>
                  </a>
                  <a className="emergency-row" href="tel:+886298765432">
                    <span className="emergency-row-ic" aria-hidden>
                      <Users size={20} strokeWidth={2} />
                    </span>
                    <div className="emergency-row-text">
                      <div className="emergency-slot-title">HR Duty Line</div>
                      <div className="emergency-slot-num">+886 (2) 9876-5432</div>
                    </div>
                    <span className="emergency-row-chevron" aria-hidden>
                      <ChevronRight size={20} strokeWidth={2} />
                    </span>
                  </a>
                </div>
              </article>
              )}

              <footer className={`employee-event-tagline${isRevisionDraft ? ' employee-event-tagline--revision' : ''}`}>
                Stay safe. Stay connected. ♡
              </footer>
            </div>
          </div>

          {isRevisionDraft ? (
            <footer className="employee-edit-sticky-bar">
              <div className="employee-edit-sticky-inner">
                <p className="employee-edit-sticky-meta">
                  Last updated{' '}
                  {latestResponse ? formatLocaleTime(latestResponse.updatedAt, locale, { hour: 'numeric', minute: '2-digit' }) : '—'}
                </p>
                <div className="employee-edit-sticky-actions">
                  <button type="button" className="btn employee-btn-outline-strong" onClick={requestCancelRevision}>
                    Discard changes
                  </button>
                  <button type="button" className="btn btn-navy-solid" disabled={!isDraftDirty || reportSubmitting} onClick={handleSaveRevision}>
                    Save changes
                  </button>
                </div>
                <p className="employee-edit-sticky-tagline">Stay safe. Stay connected. ♡</p>
              </div>
            </footer>
          ) : null}

          <ConfirmModal
            open={discardPromptAfter !== null}
            title="Discard unsaved changes?"
            description="You have unsaved changes to your report draft. If you leave now, those changes will be lost."
            cancelText="Continue editing"
            confirmText="Discard changes"
            onCancel={() => setDiscardPromptAfter(null)}
            onConfirm={confirmDiscardDraft}
          />
    </>
  );
}
