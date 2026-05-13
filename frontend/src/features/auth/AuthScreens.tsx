import { useState } from 'react';
import type { DemoAccount } from '../../api';
import type { Role } from '../../types';

export function LoginPage({
  accounts,
  loading,
  error,
  onLogin,
  onEmailLogin,
}: {
  accounts: DemoAccount[];
  loading: boolean;
  error: string | null;
  onLogin: (demoId: string) => void | Promise<void>;
  onEmailLogin: (email: string, password: string) => Promise<void>;
}) {
  const [demoId, setDemoId] = useState('employee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoginError, setEmailLoginError] = useState<string | null>(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const submitEmail = async () => {
    setEmailLoginError(null);
    setEmailSubmitting(true);
    try {
      await onEmailLogin(email.trim(), password);
    } catch (e) {
      setEmailLoginError(e instanceof Error ? e.message : '登入失敗');
    } finally {
      setEmailSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Employee Safety & Response</h1>
        <p>Emergency safety reporting and command dashboard.</p>
        {loading && <p className="muted-text">載入後端資料…</p>}
        {error && <p className="muted-text" style={{ color: 'var(--danger, #c0392b)' }}>{error}</p>}

        <h2 className="auth-section-title">使用 Email 登入</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          disabled={loading}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={loading}
        />
        {emailLoginError ? <p className="auth-inline-error">{emailLoginError}</p> : null}
        <button
          className="btn primary"
          onClick={() => void submitEmail()}
          type="button"
          disabled={loading || emailSubmitting || !email.trim() || !password}
        >
          {emailSubmitting ? '登入中…' : 'Sign in'}
        </button>
        <p className="muted-text auth-footnote" style={{ marginTop: 12 }}>
          新帳號由管理員建立；不提供公開註冊。
        </p>

        <hr className="auth-divider" />
        <h2 className="auth-section-title">Demo（原型）</h2>
        <label>
          Prototype Role Selector
          <select value={demoId} onChange={(e) => setDemoId(e.target.value)} disabled={loading || accounts.length === 0}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn ghost"
          onClick={() => void onLogin(demoId)}
          type="button"
          disabled={loading || accounts.length === 0}
        >
          Login with demo role
        </button>
      </div>
    </div>
  );
}

export function RoleSelectionPage({ roles, onPickRole }: { roles: Role[]; onPickRole: (role: Role) => void }) {
  return (
    <div className="auth-shell">
      <div className="auth-card role-pick prettier-role-select">
        <h2>Choose Your Role</h2>
        <div className="role-cards">
          {roles.map((role) => (
            <button key={role} className="role-card" onClick={() => onPickRole(role)} type="button">
              <strong>{role}</strong>
              <p>
                {role === 'employee'
                  ? 'Quickly report your own status.'
                  : role === 'supervisor'
                    ? 'Monitor your team responses.'
                    : 'Manage events and global response.'}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
