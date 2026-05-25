# CSS purge candidates (`frontend/src/styles.css`)

Audit date: 2026-05-25.

**Done (P1 + P2, 2026-05-25):** Removed orphan auth/onboarding + admin picker/table/action blocks (~249 lines).

**Done (P3, 2026-05-25):** Removed `kahoot-*`, `pie-chart`/`pie-legend`, legacy `supervisor-overview*` block, unused `employee-events-hero*`/`title`/`subtitle`, unused `dash-need-*` (kept `dash-need-row-slim*` used by admin tracking). ~268 lines; build/tests pass.

**Still open:** Priority 4 (broader legacy `dash-hero-summary`, `dash-mid-two-col`, `dash-note`, `kahoot`-adjacent report UI if any remain).

## Summary

| Metric | Value |
|--------|------:|
| Total lines | 7,708 (was 8,225) |
| Unique class selectors | 881 |
| Classes defined 2+ times (duplicate blocks) | 354 |
| `@media` blocks | 38 |
| **Unused (heuristic)** | **171** |
| Built CSS size (prod) | ~139 KB (`dist/assets/index-*.css`) |

Heuristic: each `.class` in `styles.css` is “used” if the exact token appears in `frontend/src/**/*.{ts,tsx}`, `index.html`, or a `className="..."` literal. Dynamic classes (`is-${x}`, template literals) can cause **false positives** (listed as unused but still needed) and **false negatives**.

After manual spot-check, treat **~120–140 classes** as strong purge candidates; keep **~30–50** “unused” entries until you verify responsive-only or dynamic usage.

---

## Priority 1 — Strong orphans (no TSX reference found)

Likely leftover from removed admin dept picker / close-event / old dashboard layouts.

| Class | First line | Notes |
|-------|------------|-------|
| `admin-dept-picker-box` | 5200 | Old dept picker UI |
| `admin-dept-picker-row` | 5208 | |
| `admin-close-intro` | 6192 | Close modal uses `admin-close-summary`, not intro |
| `admin-close-list` | 6196 | |
| `admin-currently-viewing` | 6139 | |
| `admin-dept-table-desktop` | 6091 | |
| `admin-dept-cards-mobile` | 6094 | |
| `admin-dept-mobile-card-top` | 6105 | |
| `admin-dept-mini-progress` | 6111 | |
| `admin-dept-detail-banner` | 6131 | |
| `admin-event-description` | 5908 | |
| `admin-event-scope-row` | 5913 | |
| `admin-scope-label` | 5920 | |
| `admin-detail-tabs` | 5936 | (duplicate naming vs `admin-event-detail-tabs`) |
| `admin-event-header-titles` | 5580 | |
| `admin-event-header-actions` | 5599 | |
| `admin-mobile-more-summary` | 5708 | |
| `admin-event-detail-mobile-actions-panel` | 5720 | |

**Estimated lines if block removed:** ~400–700 (with related descendants/media).

---

## Priority 2 — Old auth / onboarding (files deleted in A)

| Class | First line | Notes |
|-------|------------|-------|
| `profile-onboarding-card` | 68 | `ProfileOnboardingPage` removed |
| `auth-section-title` | 73 | |
| `auth-divider` | 80 | |
| `auth-back` | 113 | |
| `prettier-role-select` | 118 | |
| `role-cards` | 124 | |
| `role-card` | 130 | |

**Estimated lines:** ~200.

---

## Priority 3 — Old employee hero / “Safety Connect” detail fragments

No matching `className` in current `memberScreens.tsx` (hero strip may have been removed).

| Class | First line |
|-------|------------|
| `employee-events-hero` | 2442 |
| `employee-events-hero-text` | 2465 |
| `employee-events-title` | 2470 |
| `employee-events-title-icon` | 2481 |
| `employee-events-subtitle` | 2491 |
| `ee-stripe-bg-pending` | 2685 |
| `ee-stripe-bg-safe` | 2689 |
| `ee-stripe-bg-danger` | 2693 |
| `ee-stripe-bg-muted` | 2697 |
| `employee-event-body` | 583 |
| `employee-event-muted-block` | 639 |
| `employee-confirm-help` | 807 |
| `employee-drop-zone` | 822 |
| `employee-event-empty` | 971 |
| `edit-report-inline` | 634 |
| `report-done-card` | 634 |
| `edit-draft-toolbar` | 646 |
| `event-toolbar-card` | 646 |
| `is-pending-choice` | 687 |
| `is-need-selected` | 698 |

**Caution:** `employee-event-page` / `employee-event-hero` **are** still used — do not delete those blocks.

---

## Priority 4 — Legacy supervisor dashboard (pre–`DashboardPages` refactor)

Large block around lines **1031–1426** and **5020–5531** (`kahoot-*`, `supervisor-overview`, `dash-need-*`, `pie-chart`, etc.). No literal class names in current TSX.

| Sample classes | Lines (approx) |
|----------------|----------------|
| `kahoot-buttons`, `kahoot-btn` | 1040–1064 |
| `supervisor-overview`, `supervisor-need-help-panel` | 1352–1387 |
| `dashboard-visual`, `pie-chart`, `pie-legend` | 1343–1426 |
| `dash-need-grid`, `dash-hero-summary--*` | 5268–5354 |
| `dash-toolbar`, `dash-table-foot` | 5527–5531 |

**Estimated lines:** ~1,500–2,000 (biggest win, highest regression risk — delete in one PR with visual QA on admin + supervisor dashboards).

---

## Priority 5 — Member priority / idle variants (verify in browser first)

| Class | First line |
|-------|------------|
| `member-priority-directory-back` | 3592 |
| `member-priority-idle-actions` | 3596 |
| `member-priority-idle-emergency` | 3603 |
| `member-priority-footer-actions` | 3710 |
| `member-initial-report-actions` | 3719 |
| `member-report-success-overlay-*` | 3760–3787 |
| `member-idle-history-row*` | 3828–3867 |
| `team-dashboard-home-header` | 3874 |

---

## Priority 6 — Duplicate definitions (consolidate, don’t blindly delete)

Top duplicated selectors (merge rules instead of deleting one copy):

| Class | Definition count |
|-------|-----------------:|
| `app-frame` | 65 |
| `app-frame--admin-center` | 51 |
| `supervisor-event-center` | 45 |
| `admin-event-detail-root` | 29 |
| `event-filter-chip` | 25 |
| `btn` | 17 |
| `sidebar` | 15 |

These are mostly **responsive overrides** scattered across `@media` blocks — refactor by grouping per component file when splitting CSS.

---

## Recommended cleanup order (when you implement B)

1. Delete **Priority 1 + 2** blocks → run `npm run build` + click admin event center + auth login.
2. Remove **Priority 3** hero/detail scraps → QA member home + report flow.
3. Split `styles.css` into `styles/member.css`, `styles/admin.css`, `styles/shared.css` (import from `main.tsx`) **before** tackling Priority 4.
4. Priority 4 only with side-by-side screenshots (supervisor + admin dashboards).
5. Run PurgeCSS or `coverage` in Chrome DevTools on a full user journey to catch false positives.

---

## Regenerate this audit

```bash
cd frontend
python3 ../scripts/audit_css_usage.py   # if added later; or re-run the graphify + grep pass from PR notes
```

Manual grep for one class:

```bash
rg 'admin-dept-picker' src
```

---

## Related (not CSS)

Completed in **orphan pass A** (2026-05-25):

- Removed repo-root `app/` prototype
- Removed `mockData.ts`, `ProfileOnboardingPage.tsx`, `ForcePasswordChangePage.tsx`
- Removed unused deps `axios`, `react-router-dom` from `package.json`

**Deferred (pass C):** `backend/app/api/routes/events.py`, `EventService`, `schemas/event.py`.
