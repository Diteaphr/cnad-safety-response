import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearEmployeeReportDraft,
  employeeReportDraftKey,
  loadEmployeeReportDraft,
  saveEmployeeReportDraft,
} from './employeeReportDraft';

const USER = 'user-1';
const EVENT = 'event-1';

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  vi.stubGlobal('window', { localStorage: storage });
  return store;
}

describe('employeeReportDraft', () => {
  beforeEach(() => {
    installLocalStorageMock();
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
    const store = installLocalStorageMock();
    saveEmployeeReportDraft(USER, EVENT, {
      comment: 'x',
      location: 'y',
      selectedNeedHelp: false,
    });
    clearEmployeeReportDraft(USER, EVENT);
    expect(store.has(employeeReportDraftKey(USER, EVENT))).toBe(false);
  });
});
