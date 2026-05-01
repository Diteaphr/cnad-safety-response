import type { ReactNode } from 'react';
import type { NavKey, Role } from '../types';

const navByRole: Record<Role, Array<{ key: NavKey; label: string }>> = {
  employee: [
    { key: 'employee-home', label: 'Home' },
    { key: 'employee-history', label: 'History' },
    { key: 'profile', label: 'Profile' },
  ],
  supervisor: [
    { key: 'supervisor-dashboard', label: 'Dashboard' },
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
  const navItems = navByRole[currentRole];
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <h1>Employee Safety & Response</h1>
        <p className="muted">Emergency response operations center</p>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={currentNav === item.key ? 'nav-btn active' : 'nav-btn'}
              onClick={() => onSwitchNav(item.key)}
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
                  onClick={() => onSwitchRole(role)}
                  type="button"
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button className="btn ghost logout" onClick={onLogout} type="button">
          Logout
        </button>
      </aside>

      <main className="content">{children}</main>

      <nav className="bottom-nav">
        {navItems.slice(0, 4).map((item) => (
          <button
            key={item.key}
            className={currentNav === item.key ? 'bottom-item active' : 'bottom-item'}
            onClick={() => onSwitchNav(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
        <button className="bottom-item logout-item" onClick={onLogout} type="button">
          Logout
        </button>
      </nav>
      <button className="mobile-logout" onClick={onLogout} type="button">
        Logout
      </button>
    </div>
  );
}

