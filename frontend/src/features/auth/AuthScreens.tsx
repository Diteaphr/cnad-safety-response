import { useState } from 'react';
import { useLocale } from '../../locale/LocaleContext';
import { getStrings } from '../../locale/strings';

export function LoginPage({
  loading,
  error,
  onEmailLogin,
}: {
  loading: boolean;
  error: string | null;
  onEmailLogin: (email: string, password: string) => Promise<void>;
}) {
  const { locale } = useLocale();
  const auth = getStrings(locale).auth;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoginError, setEmailLoginError] = useState<string | null>(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const submitEmail = async () => {
    if (!email.trim() || !password || loading || emailSubmitting) return;
    setEmailLoginError(null);
    setEmailSubmitting(true);
    try {
      await onEmailLogin(email.trim(), password);
    } catch (e) {
      setEmailLoginError(e instanceof Error ? e.message : auth.loginFailed);
    } finally {
      setEmailSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>{auth.title}</h1>
        <p className="muted-text auth-lead">{auth.subtitle}</p>
        {loading && <p className="muted-text">{auth.loading}</p>}
        {error && <p className="auth-inline-error">{error}</p>}

        <form
          className="auth-email-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submitEmail();
          }}
        >
          <label className="event-form-field">
            <span className="event-form-field-label">{auth.emailLabel}</span>
            <input
              type="email"
              placeholder={auth.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
          </label>
          <label className="event-form-field">
            <span className="event-form-field-label">{auth.passwordLabel}</span>
            <input
              placeholder={auth.passwordPlaceholder}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </label>
          {emailLoginError ? <p className="auth-inline-error">{emailLoginError}</p> : null}
          <button
            className="btn primary"
            type="submit"
            disabled={loading || emailSubmitting || !email.trim() || !password}
          >
            {emailSubmitting ? auth.submitting : auth.signIn}
          </button>
          <p className="muted-text auth-footnote">{auth.footnote}</p>
        </form>
      </div>
    </div>
  );
}
