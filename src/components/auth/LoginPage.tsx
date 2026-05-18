import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { GraduationCap, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';

interface LoginPageProps {
  onToggle: () => void;
  onBack: () => void;
}

export function LoginPage({ onToggle, onBack }: LoginPageProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('Welcome back!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 60% 50% at 30% 50%, rgba(37,99,235,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="auth-card" style={{ position: 'relative' }}>
        {/* Back button */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={onBack}
          style={{ marginBottom: '1.5rem', paddingLeft: 0 }}
        >
          <ArrowLeft size={16} /> Back to Home
        </button>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--blue-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GraduationCap size={22} color="#fff" />
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '1rem',
                color: 'var(--text-primary)',
              }}
            >
              UTHM Volunteer
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sign in to your account</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Email Address</label>
            <input
              type="email"
              className="input-field"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute',
                  right: '0.875rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <hr className="divider" />

        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <button
            onClick={onToggle}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--blue-400)',
              cursor: 'pointer',
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
            }}
          >
            Register here
          </button>
        </p>
      </div>
    </div>
  );
}
