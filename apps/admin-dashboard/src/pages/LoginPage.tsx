import { FormEvent, useState } from 'react';

import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { signIn } = useAuth();
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
      setError(err instanceof Error ? err.message : 'Failed to sign in');
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
            <span>Admin access</span>
          </div>
        </div>
        <h1>Control attendance without touching the database.</h1>
        <p>Manage companies, employees, geofences, rules, monitoring, and reports from one secure dashboard.</p>
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          </label>
          {error && <div className="inline-error">{error}</div>}
          <button className="primary-button" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </section>
    </main>
  );
}
