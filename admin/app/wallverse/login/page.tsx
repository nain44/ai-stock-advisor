'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/wallverse-api';
import '../wallverse.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      localStorage.setItem('wv_token', data.token);
      router.push('/wallverse/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wallverse-theme">
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at top, #1a0a3a 0%, #0a0a0f 60%)',
        padding: '24px',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px', height: '64px',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              borderRadius: '16px',
              fontSize: '28px',
              marginBottom: '16px',
              boxShadow: '0 0 40px rgba(124,58,237,0.4)',
            }}>🖼️</div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f0ff' }}>WallVerse Admin</h1>
            <p style={{ color: '#8b8aa0', fontSize: '14px', marginTop: '4px' }}>Sign in to manage your content</p>
          </div>

          {/* Card */}
          <div className="card" style={{ borderColor: 'rgba(124,58,237,0.3)' }}>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="admin@wallverse.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center', padding: '13px' }}>
                {loading ? <span className="spinner" /> : 'Sign In →'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#5a5a70' }}>
            First time? Use <code style={{ color: '#a78bfa' }}>POST /api/auth/setup</code> to create your account.
          </p>
        </div>
      </div>
    </div>
  );
}
