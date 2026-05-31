import { useEffect, useRef, useState } from 'react';
import { loadEmployeeReportDraft, saveEmployeeReportDraft } from '../../lib/employeeReportDraft';
import type { EventItem, SafetyResponse } from '../../types';
import { EMPTY_STACK_REPORT_FIELDS } from './employeeQuickReportHelpers';
import type { EmployeeReportFields, PendingSubmission } from './memberTypes';

export interface EditDraftBaseline {
  comment: string;
  location: string;
  attachment: File | null;
  selectedNeedHelp: boolean;
  pendingSubmission: PendingSubmission;
  omitStoredAttachment: boolean;
}

export type EmployeeQuickReportPanelProps = Readonly<{
  draftUserId: string | null;
  userName: string;
  selectedEvent: EventItem | null;
  currentDepartment: string;
  latestResponse?: SafetyResponse;
  reportSubmitting: boolean;
  submitErrorMessage: string | null;
  onDismissSubmitError: () => void;
  onRetrySubmit: () => void;
  onSubmit: (
    status: 'safe' | 'need_help',
    fields: EmployeeReportFields,
    meta?: { omitStoredAttachment?: boolean },
  ) => void | Promise<void>;
  layout?: 'full' | 'embedded';
  stackSectionId?: string;
  hideEmergencyContact?: boolean;
  onBackToEvents?: () => void;
  stackInitialReport?: boolean;
  openInEditMode?: boolean;
}>;

const MAX_COMMENT_LEN = 500;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function useEmployeeQuickReport({
  draftUserId,
  selectedEvent,
  latestResponse,
  reportSubmitting,
  onSubmit,
  onBackToEvents,
  stackInitialReport = false,
  openInEditMode = false,
}: EmployeeQuickReportPanelProps) {
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const helpDetailsRef = useRef<HTMLDivElement>(null);
  const persistDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [employeeComment, setEmployeeComment] = useState('');
  const [employeeLocation, setEmployeeLocation] = useState('');
  const [employeeAttachment, setEmployeeAttachment] = useState<File | null>(null);
  const [selectedNeedHelp, setSelectedNeedHelp] = useState(false);
  const [wantToUpdate, setWantToUpdate] = useState(false);
  const [draftBaseline, setDraftBaseline] = useState<EditDraftBaseline | null>(null);
  const [pendingSubmission, setPendingSubmission] = useState<PendingSubmission>(null);
  const [discardPromptAfter, setDiscardPromptAfter] = useState<'back' | 'cancel' | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [omitStoredAttachment, setOmitStoredAttachment] = useState(false);

  const hasReport = Boolean(latestResponse);
  const showReportingControls = !hasReport || wantToUpdate;
  const isRevisionDraft = Boolean(hasReport && wantToUpdate);
  const showHelpDetailsPanel =
    selectedNeedHelp || (isRevisionDraft && pendingSubmission === 'need_help');
  const needFlowActive =
    (!isRevisionDraft && selectedNeedHelp) ||
    (isRevisionDraft && (selectedNeedHelp || pendingSubmission === 'need_help'));
  const safeButtonDimmed = needFlowActive && (!isRevisionDraft || pendingSubmission !== 'safe');

  const revertToBaselineAndExitEdit = (baseline: EditDraftBaseline) => {
    setEmployeeComment(baseline.comment);
    setEmployeeLocation(baseline.location);
    setEmployeeAttachment(baseline.attachment);
    setSelectedNeedHelp(baseline.selectedNeedHelp);
    setPendingSubmission(baseline.pendingSubmission);
    setOmitStoredAttachment(baseline.omitStoredAttachment);
    setWantToUpdate(false);
    setDraftBaseline(null);
  };

  const isDraftDirty =
    draftBaseline !== null &&
    (employeeComment !== draftBaseline.comment ||
      employeeLocation !== draftBaseline.location ||
      employeeAttachment !== draftBaseline.attachment ||
      selectedNeedHelp !== draftBaseline.selectedNeedHelp ||
      pendingSubmission !== draftBaseline.pendingSubmission ||
      omitStoredAttachment !== draftBaseline.omitStoredAttachment);

  const seedRevisionFromResponse = (response: SafetyResponse) => {
    const wasNeedHelp = response.status === 'need_help';
    const pendingInit: PendingSubmission = wasNeedHelp ? 'need_help' : 'safe';
    const c = response.comment ?? '';
    const loc = response.location ?? '';
    setEmployeeComment(c);
    setEmployeeLocation(loc);
    setEmployeeAttachment(null);
    setUploadNotice(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    setDraftBaseline({
      comment: c,
      location: loc,
      attachment: null,
      selectedNeedHelp: wasNeedHelp,
      pendingSubmission: pendingInit,
      omitStoredAttachment: false,
    });
    setOmitStoredAttachment(false);
    setWantToUpdate(true);
    setPendingSubmission(pendingInit);
    setSelectedNeedHelp(wasNeedHelp);
  };

  useEffect(() => {
    setWantToUpdate(false);
    setPendingSubmission(null);
    setDraftBaseline(null);
    setOmitStoredAttachment(false);

    const eid = selectedEvent?.id;
    if (!eid || !draftUserId) return;
    if (latestResponse) return;

    const stored = loadEmployeeReportDraft(draftUserId, eid);
    setEmployeeComment(stored?.comment ?? '');
    setEmployeeLocation(stored?.location ?? '');
    setSelectedNeedHelp(false);
  }, [selectedEvent?.id, draftUserId, latestResponse?.id]);

  useEffect(() => {
    if (!openInEditMode || !latestResponse) return;
    seedRevisionFromResponse(latestResponse);
  }, [openInEditMode, latestResponse?.id, selectedEvent?.id]);

  useEffect(() => {
    if (!draftUserId || !selectedEvent?.id || Boolean(latestResponse) || wantToUpdate) return;
    if (stackInitialReport) return;
    if (persistDraftTimer.current) globalThis.clearTimeout(persistDraftTimer.current);
    persistDraftTimer.current = globalThis.setTimeout(() => {
      saveEmployeeReportDraft(draftUserId, selectedEvent.id, {
        comment: employeeComment,
        location: employeeLocation,
        selectedNeedHelp,
      });
    }, 420);
    return () => {
      if (persistDraftTimer.current) globalThis.clearTimeout(persistDraftTimer.current);
    };
  }, [
    draftUserId,
    selectedEvent?.id,
    latestResponse,
    wantToUpdate,
    employeeComment,
    employeeLocation,
    selectedNeedHelp,
    stackInitialReport,
  ]);

  useEffect(() => {
    if (latestResponse) setWantToUpdate(false);
  }, [latestResponse?.updatedAt]);

  useEffect(() => {
    if (!showHelpDetailsPanel) return;
    const id = globalThis.requestAnimationFrame(() => {
      globalThis.requestAnimationFrame(() => {
        helpDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    return () => globalThis.cancelAnimationFrame(id);
  }, [showHelpDetailsPanel]);

  useEffect(() => {
    if (!wantToUpdate) setDraftBaseline(null);
  }, [wantToUpdate]);

  const reportFields = (): EmployeeReportFields => ({
    comment: employeeComment,
    location: employeeLocation,
    attachment: employeeAttachment,
  });

  const handleSubmitSafeTap = () => {
    if (reportSubmitting) return;
    if (isRevisionDraft) {
      setPendingSubmission('safe');
      setSelectedNeedHelp(false);
      return;
    }
    setSelectedNeedHelp(false);
    const fields = stackInitialReport ? EMPTY_STACK_REPORT_FIELDS : reportFields();
    void onSubmit('safe', fields, {
      omitStoredAttachment: stackInitialReport ? false : omitStoredAttachment,
    });
  };

  const handleNeedHelpTap = () => {
    if (reportSubmitting) return;
    if (isRevisionDraft) {
      setPendingSubmission('need_help');
      setSelectedNeedHelp(true);
      return;
    }
    setSelectedNeedHelp(true);
  };

  const handleConfirmNeedHelp = () => {
    if (reportSubmitting) return;
    if (isRevisionDraft) return;
    if (!selectedNeedHelp) return;
    void onSubmit('need_help', reportFields(), {
      omitStoredAttachment: stackInitialReport ? false : omitStoredAttachment,
    });
  };

  const enterRevisionMode = () => {
    if (!latestResponse) return;
    seedRevisionFromResponse(latestResponse);
  };

  const confirmDiscardDraft = () => {
    const reason = discardPromptAfter;
    if (draftBaseline) revertToBaselineAndExitEdit(draftBaseline);
    setDiscardPromptAfter(null);
    if (reason === 'back') onBackToEvents?.();
  };

  const requestBackNavigation = () => {
    if (isRevisionDraft && isDraftDirty) {
      setDiscardPromptAfter('back');
      return;
    }
    onBackToEvents?.();
  };

  const requestCancelRevision = () => {
    if (!draftBaseline || !isRevisionDraft) return;
    if (isDraftDirty) {
      setDiscardPromptAfter('cancel');
      return;
    }
    revertToBaselineAndExitEdit(draftBaseline);
  };

  const handleSaveRevision = () => {
    if (reportSubmitting) return;
    if (!pendingSubmission || !isRevisionDraft) return;
    void onSubmit(pendingSubmission, reportFields(), { omitStoredAttachment });
  };

  const applyAttachment = (file: File | undefined | null, uploadTooBigMessage: string) => {
    setUploadNotice(null);
    if (!file) {
      setEmployeeAttachment(null);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadNotice(uploadTooBigMessage);
      return;
    }
    setOmitStoredAttachment(false);
    setEmployeeAttachment(file);
  };

  return {
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
  };
}
