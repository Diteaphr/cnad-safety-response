import { useState } from 'react';
import { loginWithEmailApi, registerApi } from '../../api';
import type { DemoAccount } from '../../api';
import type { Department, Role, User } from '../../types';

export function LoginPage({
  accounts,
  loading,
  error,
  onLogin,
  onEmailLogin,
  onGoRegister,
}: {
  accounts: DemoAccount[];
  loading: boolean;
  error: string | null;
  onLogin: (demoId: string) => void | Promise<void>;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onGoRegister: () => void;
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
        <p className="auth-footnote">
          還沒有帳號？{' '}
          <button type="button" className="auth-link" onClick={onGoRegister} disabled={loading}>
            建立帳號
          </button>
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

export function RegisterPage({
  departments,
  loading,
  error,
  onRegisterSuccess,
  onBack,
}: {
  departments: Department[];
  loading: boolean;
  error: string | null;
  onRegisterSuccess: (user: User) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeNo, setEmployeeNo] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setFormError(null);
    if (password.length < 8) {
      setFormError('密碼至少 8 個字元');
      return;
    }
    if (password !== confirm) {
      setFormError('兩次輸入的密碼不一致');
      return;
    }
    setSubmitting(true);
    try {
      await registerApi({
        name: name.trim(),
        email: email.trim(),
        password,
        departmentId: departmentId || undefined,
        phone: phone.trim() || undefined,
        employeeNo: employeeNo.trim() || undefined,
      });
      const loginOut = await loginWithEmailApi({ email: email.trim(), password });
      onRegisterSuccess(loginOut.user);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '註冊失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <button type="button" className="btn ghost auth-back" onClick={onBack}>
          ← 返回登入
        </button>
        <h1>建立帳號</h1>
        <p className="muted-text">註冊後將以一般員工身分登入（employee）。主管／管理員由後台指派。</p>
        {loading && <p className="muted-text">載入後端資料…</p>}
        {error && <p className="muted-text" style={{ color: 'var(--danger, #c0392b)' }}>{error}</p>}
        <input placeholder="姓名" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          disabled={loading}
        />
        <input
          placeholder="密碼（至少 8 字）"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          disabled={loading}
        />
        <input
          placeholder="確認密碼"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          disabled={loading}
        />
        <label>
          部門（選填）
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={loading}>
            <option value="">— 未指定 —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <input placeholder="電話（選填）" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} />
        <input placeholder="員工編號（選填，留空則自動產生）" value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} disabled={loading} />
        {formError && formError !== error ? <p className="auth-inline-error">{formError}</p> : null}
        <button
          className="btn primary"
          type="button"
          disabled={loading || submitting || !name.trim() || !email.trim() || !password}
          onClick={() => void submit()}
        >
          {submitting ? '送出中…' : '註冊並登入'}
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
              <p>{role === 'employee' ? 'Quickly report your own status.' : role === 'supervisor' ? 'Monitor your team responses.' : 'Manage events and global response.'}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
