import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, LayoutDashboard, Menu } from 'lucide-react';
import { useLocale } from '../locale/LocaleContext';
import type { AppLocale } from '../locale/LocaleContext';
import { getStrings } from '../locale/strings';
import type { NavKey, AppSurface, UserCapabilities } from '../types';

const NARROW_SIDEBAR_MEDIA = '(max-width: 980px)';

function navItemsMember(locale: AppLocale, canViewTeam: boolean): Array<{ key: NavKey; label: string }> {
  const { layoutNav: L } = getStrings(locale);
  const rows: Array<{ key: NavKey; label: string }> = [
    { key: 'member-home', label: L.memberHome },
    ...(canViewTeam ? [{ key: 'team-dashboard-home' as const, label: L.teamReports }] : []),
    { key: 'notifications', label: L.notifications },
    { key: 'profile', label: L.accountSettings },
  ];
  return rows;
}

function navItemsAdmin(locale: AppLocale): Array<{ key: NavKey; label: string }> {
  const { layoutNav: L } = getStrings(locale);
  return [
    { key: 'admin-dashboard', label: L.adminOverview },
    { key: 'event-management', label: L.adminEvents },
    { key: 'user-management', label: L.adminUsers },
    { key: 'notifications', label: L.adminNotifications },
    { key: 'profile', label: L.adminSystemSettings },
  ];
}

export function Layout({
  surface,
  caps,
  currentNav,
  onNavigate,
  onEnterAdminCenter,
  onExitAdminCenter,
  onLogout,
  children,
}: {
  surface: AppSurface;
  caps: UserCapabilities;
  currentNav: NavKey;
  onNavigate: (nav: NavKey) => void;
  onEnterAdminCenter: () => void;
  onExitAdminCenter: () => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const { layoutChrome: chrome } = getStrings(locale);
  const navItems = useMemo(() => {
    return surface === 'adminCenter'
      ? navItemsAdmin(locale)
      : navItemsMember(locale, caps.canViewTeam);
  }, [locale, surface, caps.canViewTeam]);
  const sidebarTitle =
    surface === 'adminCenter' ? chrome.adminSidebarTitle : chrome.memberSidebarTitle;
  const sidebarSub = surface === 'adminCenter' ? chrome.adminSidebarSub : chrome.memberSidebarSub;
  const mobileTitle = surface === 'adminCenter' ? chrome.adminSidebarTitle : chrome.mobileAppTitle;

  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine);
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_SIDEBAR_MEDIA).matches,
  );

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(NARROW_SIDEBAR_MEDIA);
    const onChange = () => setIsNarrowViewport(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isNarrowViewport && sidebarDrawerOpen) setSidebarDrawerOpen(false);
  }, [isNarrowViewport, sidebarDrawerOpen]);

  useEffect(() => {
    setSidebarDrawerOpen(false);
  }, [surface, currentNav]);

  useEffect(() => {
    if (!sidebarDrawerOpen || !isNarrowViewport) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [sidebarDrawerOpen, isNarrowViewport]);

  const navigateFromSidebar = (key: NavKey) => {
    setSidebarDrawerOpen(false);
    onNavigate(key);
  };

  const frameClass =
    surface === 'adminCenter' ? 'app-frame app-frame--admin-center' : 'app-frame app-frame--member';
  const mobileHeaderTone = surface === 'adminCenter' ? 'admin' : 'member';

  const showSidebarAdminEntry =
    surface === 'member' && caps.canManage && !isNarrowViewport;
  const showSidebarStaffExit =
    surface === 'adminCenter' && caps.hasStaffPortal && !isNarrowViewport;

  const showMobileEnterAdmin = isNarrowViewport && surface === 'member' && caps.canManage;
  const showMobileExitAdmin = isNarrowViewport && surface === 'adminCenter' && caps.hasStaffPortal;

  return (
    <div className={frameClass}>
      {!online ? (
        <div className="offline-bar" role="status">
          {chrome.offlineBanner}
        </div>
      ) : null}
      <header className={`app-mobile-shell-header app-mobile-shell-header--${mobileHeaderTone}`}>
        <button
          type="button"
          className="sidebar-hamburger-btn"
          aria-expanded={sidebarDrawerOpen}
          aria-controls="app-sidebar-drawer"
          onClick={() => setSidebarDrawerOpen((open) => !open)}
        >
          <Menu size={20} strokeWidth={2.25} aria-hidden />
          <span className="sr-only">Toggle menu</span>
        </button>
        <span className="app-mobile-shell-title">{mobileTitle}</span>
        <div className="app-mobile-shell-trailing">
          {showMobileEnterAdmin ? (
            <button
              type="button"
              className="mobile-shell-switch-btn mobile-shell-switch-btn--to-admin"
              aria-label={chrome.ariaMobileEnterAdmin}
              onClick={() => {
                setSidebarDrawerOpen(false);
                onEnterAdminCenter();
              }}
            >
              <LayoutDashboard size={18} strokeWidth={2.1} aria-hidden />
              <span className="mobile-shell-switch-btn__label">{chrome.mobileEnterAdminCenter}</span>
            </button>
          ) : null}
          {showMobileExitAdmin ? (
            <button
              type="button"
              className="mobile-shell-switch-btn mobile-shell-switch-btn--to-staff"
              aria-label={chrome.ariaMobileExitAdmin}
              onClick={() => {
                setSidebarDrawerOpen(false);
                onExitAdminCenter();
              }}
            >
              <ChevronLeft size={18} strokeWidth={2.1} aria-hidden />
              <span className="mobile-shell-switch-btn__label">{chrome.mobileExitAdminCenter}</span>
            </button>
          ) : null}
        </div>
      </header>

      <main className="content">{children}</main>

      <aside
        id="app-sidebar-drawer"
        className={`sidebar${sidebarDrawerOpen ? ' is-drawer-open' : ''}`}
        {...(isNarrowViewport ? { 'aria-hidden': !sidebarDrawerOpen } : {})}
      >
        <header className="sidebar-brand-block">
          <h1>{sidebarTitle}</h1>
          <p className="muted">{sidebarSub}</p>
        </header>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={currentNav === item.key ? 'nav-btn active' : 'nav-btn'}
              onClick={() => navigateFromSidebar(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {showSidebarAdminEntry ? (
            <>
              <div className="sidebar-divider" aria-hidden />
              <button
                type="button"
                className="sidebar-link-btn"
                onClick={() => {
                  setSidebarDrawerOpen(false);
                  onEnterAdminCenter();
                }}
              >
                <span>{chrome.enterAdminCenter}</span>
                <ChevronRight size={18} aria-hidden strokeWidth={2} />
              </button>
            </>
          ) : null}

          {showSidebarStaffExit ? (
            <>
              <div className="sidebar-divider" aria-hidden />
              <button type="button" className="sidebar-link-btn sidebar-link-btn--back" onClick={onExitAdminCenter}>
                ← {chrome.backToStaffMode}
              </button>
            </>
          ) : null}

          <button
            className="btn ghost logout"
            onClick={() => {
              setSidebarDrawerOpen(false);
              onLogout();
            }}
            type="button"
          >
            {chrome.logout}
          </button>
        </div>
      </aside>

      <button
        type="button"
        className={`sidebar-drawer-overlay${sidebarDrawerOpen ? ' is-visible' : ''}`}
        aria-label="Close menu"
        tabIndex={-1}
        onClick={() => setSidebarDrawerOpen(false)}
      />
    </div>
  );
}
