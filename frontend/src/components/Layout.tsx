import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ChevronRight, Menu } from 'lucide-react';
import { useLocale } from '../locale/LocaleContext';
import type { AppLocale } from '../locale/LocaleContext';
import { getStrings } from '../locale/strings';
import type { NavKey, AppSurface, UserCapabilities } from '../types';

const NARROW_SIDEBAR_MEDIA = '(max-width: 1024px)';

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
    { key: 'admin-dashboard', label: L.adminEvents },
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
  mobileHeaderTitle,
  onMobileBack,
  navLocked = false,
  onBlockedNav,
  children,
}: {
  surface: AppSurface;
  caps: UserCapabilities;
  currentNav: NavKey;
  onNavigate: (nav: NavKey) => void;
  onEnterAdminCenter: () => void;
  onExitAdminCenter: () => void;
  onLogout: () => void;
  /** 窄螢幕頂列中央標題文字 */
  mobileHeaderTitle: string;
  /** 子頁面返回 handler；有值時頂列左側顯示返回鍵，否則顯示 hamburger */
  onMobileBack?: () => void;
  /** 有待回報時鎖定非首頁導覽 */
  navLocked?: boolean;
  onBlockedNav?: (target: NavKey) => void;
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
    if (navLocked && key !== 'member-home') {
      onBlockedNav?.(key);
      return;
    }
    setSidebarDrawerOpen(false);
    onNavigate(key);
  };

  const tryEnterAdminCenter = () => {
    if (navLocked) {
      onBlockedNav?.('admin-dashboard');
      return;
    }
    setSidebarDrawerOpen(false);
    onEnterAdminCenter();
  };

  const frameClass =
    surface === 'adminCenter' ? 'app-frame app-frame--admin-center' : 'app-frame app-frame--member';
  const mobileHeaderTone = surface === 'adminCenter' ? 'admin' : 'member';

  const showSidebarAdminEntry = surface === 'member' && caps.canManage;
  const showSidebarStaffExit = surface === 'adminCenter' && caps.hasStaffPortal;

  return (
    <div className={frameClass}>
      {!online ? (
        <div className="offline-bar" role="status">
          {chrome.offlineBanner}
        </div>
      ) : null}
      <header className={`app-mobile-shell-header app-mobile-shell-header--${mobileHeaderTone}`}>
        {onMobileBack ? (
          <button
            type="button"
            className="sidebar-hamburger-btn"
            onClick={onMobileBack}
            aria-label="返回"
          >
            <ArrowLeft size={20} strokeWidth={2.25} aria-hidden />
            <span className="sr-only">返回</span>
          </button>
        ) : (
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
        )}
        <span className="app-mobile-shell-title">{mobileHeaderTitle}</span>
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
          {navItems.map((item) => {
            const isLocked = navLocked && item.key !== 'member-home';
            return (
              <button
                key={item.key}
                className={`${currentNav === item.key ? 'nav-btn active' : 'nav-btn'}${isLocked ? ' nav-btn--locked' : ''}`}
                onClick={() => navigateFromSidebar(item.key)}
                type="button"
                aria-disabled={isLocked || undefined}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {showSidebarAdminEntry ? (
            <>
              <div className="sidebar-divider" aria-hidden />
              <button
                type="button"
                className={`sidebar-link-btn${navLocked ? ' sidebar-link-btn--locked' : ''}`}
                onClick={tryEnterAdminCenter}
                aria-disabled={navLocked || undefined}
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
