import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../lib/supabase';
import { toast } from 'sonner';
import { GraduationCap, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';

interface RegisterPageProps {
  onToggle: () => void;
  onBack: () => void;
}

const ROLES: { value: UserRole; label: string; description: string }[] = [
  {
    value: 'student',
    label: 'Student',
    description: 'Register for programs, track hours, earn certificates',
  },
  {
    value: 'program_director',
    label: 'Program Director',
    description: 'Create and manage volunteer programs',
  },
];

export function RegisterPage({ onToggle, onBack }: RegisterPageProps) {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPw) {
      toast.error('Please fill in all fields');
      return;
    }
    if (password !== confirmPw) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, name, role);
      toast.success('Account created! You are now logged in.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 60% 50% at 70% 50%, rgba(37,99,235,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="auth-card"
        style={{ position: 'relative', maxWidth: 500 }}
      >
        <button
          className="btn btn-ghost btn-sm"
          onClick={onBack}
          style={{ marginBottom: '1.5rem', paddingLeft: 0 }}
        >
          <ArrowLeft size={16} /> Back to Home
        </button>

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
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Create your account</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Full Name</label>
            <input
              type="text"
              className="input-field"
              placeholder="Ahmad bin Abdullah"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="label">Email Address</label>
            <input
              type="email"
              className="input-field"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Role selection */}
          <div className="form-group">
            <label className="label">Account Type</label>
            <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.875rem',
                    padding: '0.875rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${role === r.value ? 'var(--blue-500)' : 'var(--border)'}`,
                    background: role === r.value ? 'rgba(37,99,235,0.08)' : 'var(--bg-input)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    style={{ marginTop: 3, accentColor: 'var(--blue-500)' }}
                  />
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: role === r.value ? 'var(--blue-300)' : 'var(--text-primary)',
                      }}
                    >
                      {r.label}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {r.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Admin accounts are assigned by the system administrator.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div className="form-group">
              <label className="label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Min. 6 chars"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="label">Confirm Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Repeat password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <hr className="divider" />

        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
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
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
