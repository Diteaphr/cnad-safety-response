import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import type { NavKey, Role } from '../types';

const navByRole: Record<Role, Array<{ key: NavKey; label: string }>> = {
  employee: [
    { key: 'member-home', label: 'Events' },
    { key: 'employee-history', label: 'History' },
    { key: 'profile', label: 'Profile' },
  ],
  supervisor: [
    { key: 'member-home', label: 'Events' },
    { key: 'notifications', label: 'Reminders' },
    { key: 'profile', label: 'Profile' },
  ],
  admin: [
    { key: 'admin-dashboard', label: 'Overview' },
    { key: 'event-management', label: 'Events' },
    { key: 'user-management', label: 'Users' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'profile', label: 'Profile' },
  ],
};

const NARROW_SIDEBAR_MEDIA = '(max-width: 980px)';

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
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine);
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_SIDEBAR_MEDIA).matches,
  );
  const navItems = navByRole[currentRole];

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
          目前離線：已快取的資料仍可操作；請恢復連線後再試送出。
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
        <span className="app-mobile-shell-title">Safety Connect</span>
      </header>

      <button
        type="button"
        className={`sidebar-drawer-overlay${sidebarDrawerOpen ? ' is-visible' : ''}`}
        aria-label="Close menu"
        tabIndex={-1}
        onClick={() => setSidebarDrawerOpen(false)}
      />

      <aside
        id="app-sidebar-drawer"
        className={`sidebar${sidebarDrawerOpen ? ' is-drawer-open' : ''}`}
        {...(isNarrowViewport ? { 'aria-hidden': !sidebarDrawerOpen } : {})}
      >
        <h1>Employee Safety & Response</h1>
        <p className="muted">Emergency response operations center</p>
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
            <p>Switch role</p>
            <div>
              {roleOptions.map((role) => (
                <button
                  key={role}
                  className={role === currentRole ? 'pill active' : 'pill'}
                  onClick={() => pickRoleFromSidebar(role)}
                  type="button"
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button className="btn ghost logout" onClick={logoutFromSidebar} type="button">
          Logout
        </button>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}

