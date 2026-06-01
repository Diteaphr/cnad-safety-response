import { useCallback, useEffect, useMemo, useState } from 'react';
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

function navItemsAdmin(
  locale: AppLocale,
  hasStaffPortal: boolean,
): Array<{ key: NavKey; label: string }> {
  const { layoutNav: L } = getStrings(locale);
  const rows: Array<{ key: NavKey; label: string }> = [
    { key: 'admin-dashboard', label: L.adminEvents },
    { key: 'user-management', label: L.adminUsers },
  ];
  if (!hasStaffPortal) {
    rows.push(
      { key: 'notifications', label: L.adminNotifications },
      { key: 'profile', label: L.adminSystemSettings },
    );
  }
  return rows;
}

function initialNarrowViewport(): boolean {
  return globalThis.window?.matchMedia(NARROW_SIDEBAR_MEDIA).matches ?? false;
}

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    globalThis.addEventListener('online', sync);
    globalThis.addEventListener('offline', sync);
    return () => {
      globalThis.removeEventListener('online', sync);
      globalThis.removeEventListener('offline', sync);
    };
  }, []);
  return online;
}

function useNarrowViewport(): boolean {
  const [isNarrowViewport, setIsNarrowViewport] = useState(initialNarrowViewport);
  useEffect(() => {
    const win = globalThis.window;
    if (!win) return undefined;
    const mq = win.matchMedia(NARROW_SIDEBAR_MEDIA);
    const onChange = () => setIsNarrowViewport(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isNarrowViewport;
}

function useSidebarDrawerEscapeLock(
  sidebarDrawerOpen: boolean,
  isNarrowViewport: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!sidebarDrawerOpen || !isNarrowViewport) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    globalThis.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [sidebarDrawerOpen, isNarrowViewport, onClose]);
}

function layoutChromeForSurface(
  surface: AppSurface,
  chrome: ReturnType<typeof getStrings>['layoutChrome'],
): {
  sidebarTitle: string;
  sidebarSub: string;
  frameClass: string;
  mobileHeaderTone: 'admin' | 'member';
} {
  const isAdmin = surface === 'adminCenter';
  return {
    sidebarTitle: isAdmin ? chrome.adminSidebarTitle : chrome.memberSidebarTitle,
    sidebarSub: isAdmin ? chrome.adminSidebarSub : chrome.memberSidebarSub,
    frameClass: isAdmin ? 'app-frame app-frame--admin-center' : 'app-frame app-frame--member',
    mobileHeaderTone: isAdmin ? 'admin' : 'member',
  };
}

type LayoutProps = Readonly<{
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
}>;

type LayoutMobileHeaderProps = Readonly<{
  mobileHeaderTitle: string;
  mobileHeaderTone: 'admin' | 'member';
  onMobileBack?: () => void;
  sidebarDrawerOpen: boolean;
  onToggleDrawer: () => void;
}>;

function LayoutMobileHeader({
  mobileHeaderTitle,
  mobileHeaderTone,
  onMobileBack,
  sidebarDrawerOpen,
  onToggleDrawer,
}: LayoutMobileHeaderProps) {
  return (
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
          onClick={onToggleDrawer}
        >
          <Menu size={20} strokeWidth={2.25} aria-hidden />
          <span className="sr-only">Toggle menu</span>
        </button>
      )}
      <span className="app-mobile-shell-title">{mobileHeaderTitle}</span>
    </header>
  );
}

type LayoutSidebarProps = Readonly<{
  sidebarTitle: string;
  sidebarSub: string;
  navItems: Array<{ key: NavKey; label: string }>;
  currentNav: NavKey;
  navLocked: boolean;
  sidebarDrawerOpen: boolean;
  isNarrowViewport: boolean;
  showSidebarAdminEntry: boolean;
  showSidebarStaffExit: boolean;
  chrome: ReturnType<typeof getStrings>['layoutChrome'];
  onNavigateItem: (key: NavKey) => void;
  onEnterAdminCenter: () => void;
  onExitAdminCenter: () => void;
  onLogout: () => void;
  onCloseDrawer: () => void;
}>;

function LayoutSidebar({
  sidebarTitle,
  sidebarSub,
  navItems,
  currentNav,
  navLocked,
  sidebarDrawerOpen,
  isNarrowViewport,
  showSidebarAdminEntry,
  showSidebarStaffExit,
  chrome,
  onNavigateItem,
  onEnterAdminCenter,
  onExitAdminCenter,
  onLogout,
  onCloseDrawer,
}: LayoutSidebarProps) {
  return (
    <>
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
                onClick={() => onNavigateItem(item.key)}
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
                onClick={onEnterAdminCenter}
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

          <button className="btn ghost logout" onClick={onLogout} type="button">
            {chrome.logout}
          </button>
        </div>
      </aside>

      <button
        type="button"
        className={`sidebar-drawer-overlay${sidebarDrawerOpen ? ' is-visible' : ''}`}
        aria-label="Close menu"
        tabIndex={-1}
        onClick={onCloseDrawer}
      />
    </>
  );
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
}: LayoutProps) {
  const { locale } = useLocale();
  const { layoutChrome: chrome } = getStrings(locale);
  const navItems = useMemo(() => {
    return surface === 'adminCenter'
      ? navItemsAdmin(locale, caps.hasStaffPortal)
      : navItemsMember(locale, caps.canViewTeam);
  }, [locale, surface, caps.canViewTeam, caps.hasStaffPortal]);
  const { sidebarTitle, sidebarSub, frameClass, mobileHeaderTone } = layoutChromeForSurface(surface, chrome);

  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
  const online = useOnlineStatus();
  const isNarrowViewport = useNarrowViewport();
  const closeDrawer = useCallback(() => setSidebarDrawerOpen(false), []);

  useSidebarDrawerEscapeLock(sidebarDrawerOpen, isNarrowViewport, closeDrawer);

  useEffect(() => {
    if (!isNarrowViewport && sidebarDrawerOpen) setSidebarDrawerOpen(false);
  }, [isNarrowViewport, sidebarDrawerOpen]);

  useEffect(() => {
    setSidebarDrawerOpen(false);
  }, [surface, currentNav]);

  const navigateFromSidebar = (key: NavKey) => {
    if (navLocked && key !== 'member-home') {
      onBlockedNav?.(key);
      return;
    }
    closeDrawer();
    onNavigate(key);
  };

  const tryEnterAdminCenter = () => {
    if (navLocked) {
      onBlockedNav?.('admin-dashboard');
      return;
    }
    closeDrawer();
    onEnterAdminCenter();
  };

  const handleLogout = () => {
    closeDrawer();
    onLogout();
  };

  return (
    <div className={frameClass}>
      {online ? null : <output className="offline-bar">{chrome.offlineBanner}</output>}
      <LayoutMobileHeader
        mobileHeaderTitle={mobileHeaderTitle}
        mobileHeaderTone={mobileHeaderTone}
        onMobileBack={onMobileBack}
        sidebarDrawerOpen={sidebarDrawerOpen}
        onToggleDrawer={() => setSidebarDrawerOpen((open) => !open)}
      />
      <main className="content">{children}</main>
      <LayoutSidebar
        sidebarTitle={sidebarTitle}
        sidebarSub={sidebarSub}
        navItems={navItems}
        currentNav={currentNav}
        navLocked={navLocked}
        sidebarDrawerOpen={sidebarDrawerOpen}
        isNarrowViewport={isNarrowViewport}
        showSidebarAdminEntry={surface === 'member' && caps.canManage}
        showSidebarStaffExit={surface === 'adminCenter' && caps.hasStaffPortal}
        chrome={chrome}
        onNavigateItem={navigateFromSidebar}
        onEnterAdminCenter={tryEnterAdminCenter}
        onExitAdminCenter={() => {
          closeDrawer();
          onExitAdminCenter();
        }}
        onLogout={handleLogout}
        onCloseDrawer={closeDrawer}
      />
    </div>
  );
}
