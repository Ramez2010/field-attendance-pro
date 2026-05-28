import { FormEvent, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getFriendlyErrorMessage } from '../lib/errors';

export function LoginPage() {
  const { signIn } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, t('auth.failedSignIn')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand large">
          <div className="brand-mark">FA</div>
          <div>
            <strong>Field Attendance Pro</strong>
            <span>{t('auth.adminAccess')}</span>
          </div>
        </div>
        <label className="field" style={{ marginBottom: 8 }}>
          <span>{t('layout.language')}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value === 'ar' ? 'ar' : 'en')}>
            <option value="en">{t('language.english')}</option>
            <option value="ar">{t('language.arabic')}</option>
          </select>
        </label>
        <h1>{t('auth.tagline')}</h1>
        <p>{t('auth.description')}</p>
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>{t('auth.email')}</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="field">
            <span>{t('auth.password')}</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          </label>
          {error && <div className="inline-error">{error}</div>}
          <button className="primary-button" disabled={loading}>{loading ? t('auth.signingIn') : t('auth.signIn')}</button>
        </form>
      </section>
    </main>
  );
}
