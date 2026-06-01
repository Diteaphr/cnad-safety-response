import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearEmployeeReportDraft,
  loadEmployeeReportDraft,
  saveEmployeeReportDraft,
} from './employeeReportDraft';

const USER = 'user-1';
const EVENT = 'event-1';

describe('employeeReportDraft', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and restores draft fields', () => {
    saveEmployeeReportDraft(USER, EVENT, {
      comment: '需要協助',
      location: '3F 會議室',
      selectedNeedHelp: true,
    });

    const stored = loadEmployeeReportDraft(USER, EVENT);
    expect(stored).toEqual({
      comment: '需要協助',
      location: '3F 會議室',
      selectedNeedHelp: true,
      updatedAt: expect.any(String),
    });
  });

  it('clears draft after successful submit flow', () => {
    saveEmployeeReportDraft(USER, EVENT, {
      comment: 'x',
      location: 'y',
      selectedNeedHelp: false,
    });
    clearEmployeeReportDraft(USER, EVENT);
    expect(loadEmployeeReportDraft(USER, EVENT)).toBeNull();
  });
});
