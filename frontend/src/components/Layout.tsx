import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { useLocale } from '../locale/LocaleContext';
import type { AppLocale } from '../locale/LocaleContext';
import { getStrings } from '../locale/strings';
import type { NavKey, Role } from '../types';

const NARROW_SIDEBAR_MEDIA = '(max-width: 980px)';

function navLabelsForRole(locale: AppLocale, role: Role): Array<{ key: NavKey; label: string }> {
  const { layoutNav: L } = getStrings(locale);
  if (role === 'employee') {
    return [
      { key: 'member-home', label: L.empHome },
      { key: 'profile', label: L.profile },
    ];
  }
  if (role === 'supervisor') {
    return [
      { key: 'member-home', label: L.supervisorHome },
      { key: 'team-dashboard-home', label: L.teamDash },
      { key: 'notifications', label: L.reminders },
      { key: 'profile', label: L.profile },
    ];
  }
  return [
    { key: 'admin-dashboard', label: L.adminOverview },
    { key: 'event-management', label: L.adminEvents },
    { key: 'user-management', label: L.adminUsers },
    { key: 'notifications', label: L.adminNotifications },
    { key: 'profile', label: L.profile },
  ];
}

function roleChipLabel(locale: AppLocale, role: Role): string {
  const { layoutChrome } = getStrings(locale);
  if (role === 'employee') return layoutChrome.roleEmployee;
  if (role === 'supervisor') return layoutChrome.roleSupervisor;
  return layoutChrome.roleAdmin;
}

export function Layout({
  currentRole,
  roleOptions,
  currentNav,
  onSwitchRole,
  onSwitchNav,
  onLogout,
  children,
}: {
  currentRole: Role;
  roleOptions: Role[];
  currentNav: NavKey;
  onSwitchRole: (role: Role) => void;
  onSwitchNav: (nav: NavKey) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const { layoutChrome } = getStrings(locale);
  const navItems = useMemo(() => navLabelsForRole(locale, currentRole), [locale, currentRole]);
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
  }, [currentRole, currentNav]);

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
    onSwitchNav(key);
  };

  const pickRoleFromSidebar = (role: Role) => {
    setSidebarDrawerOpen(false);
    onSwitchRole(role);
  };

  const logoutFromSidebar = () => {
    setSidebarDrawerOpen(false);
    onLogout();
  };

  return (
    <div className="app-frame">
      {!online ? (
        <div className="offline-bar" role="status">
          {layoutChrome.offlineBanner}
        </div>
      ) : null}
      <header className="app-mobile-shell-header">
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
        <span className="app-mobile-shell-title">{layoutChrome.mobileAppTitle}</span>
      </header>

      {/* Main must precede sidebar in DOM so narrow layouts stack content under the shell header */}
      <main className="content">{children}</main>

      <aside
        id="app-sidebar-drawer"
        className={`sidebar${sidebarDrawerOpen ? ' is-drawer-open' : ''}`}
        {...(isNarrowViewport ? { 'aria-hidden': !sidebarDrawerOpen } : {})}
      >
        <h1>{layoutChrome.sidebarHeadline}</h1>
        <p className="muted">{layoutChrome.sidebarSub}</p>
        <nav>
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
        {roleOptions.length > 1 ? (
          <div className="role-switch">
            <p>{layoutChrome.switchRole}</p>
            <div>
              {roleOptions.map((role) => (
                <button
                  key={role}
                  className={role === currentRole ? 'pill active' : 'pill'}
                  onClick={() => pickRoleFromSidebar(role)}
                  type="button"
                >
                  {roleChipLabel(locale, role)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button className="btn ghost logout" onClick={logoutFromSidebar} type="button">
          {layoutChrome.logout}
        </button>
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

