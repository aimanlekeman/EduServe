import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { ArrowLeft, User, Mail, Hash, Phone, Shield, Save, Loader2 } from 'lucide-react';

interface ProfileSettingsProps {
  onClose: () => void;
}

export function ProfileSettings({ onClose }: ProfileSettingsProps) {
  const { user, refreshUser } = useAuth();

  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Populate form from the profiles context (already in memory — no extra fetch needed)
  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setPhone(user.phone_number ?? '');
  }, [user?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedName  = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) { toast.error('Full name cannot be empty.'); return; }
    if (trimmedPhone && !/^[+\d\s\-()]{7,20}$/.test(trimmedPhone)) {
      toast.error('Please enter a valid phone number (digits, spaces, +, -, parentheses).');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: trimmedName, phone_number: trimmedPhone || null })
        .eq('id', user.id);

      if (error) throw error;

      await refreshUser();
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const roleColors: Record<string, { bg: string; color: string; label: string }> = {
    admin:            { bg: 'rgba(220,38,38,0.12)',  color: '#DC2626', label: 'Administrator' },
    program_director: { bg: 'rgba(124,58,237,0.12)', color: '#7C3AED', label: 'Program Director' },
    student:          { bg: 'rgba(37,99,235,0.12)',  color: '#1D4ED8', label: 'Student' },
  };
  const roleStyle = roleColors[user?.role ?? 'student'];

  return (
    <div className="animate-fade-up" style={{ maxWidth: 680, margin: '0 auto' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.75rem' }}>
        <button
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0,
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--blue-600)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: 2 }}>
            Account Settings
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
            Manage your personal information and contact details.
          </p>
        </div>
      </div>

      {/* ── Avatar card ── */}
      <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem 1.5rem' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--blue-600), var(--blue-700))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', color: '#fff',
          boxShadow: '0 4px 16px rgba(29,78,216,0.3)', userSelect: 'none',
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 4 }}>
            {user?.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 999,
              background: roleStyle.bg, color: roleStyle.color,
              fontFamily: 'var(--font-display)', letterSpacing: '0.04em',
            }}>
              <Shield size={10} /> {roleStyle.label}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</span>
          </div>
        </div>
      </div>

      {/* ── Settings form ── */}
      <div className="card">
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', margin: 0 }}>
            Personal Information
          </h2>
        </div>

        <form onSubmit={handleSave} style={{ padding: '0 1.5rem 1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>

            {/* Full Name — editable */}
            <div className="form-group">
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <User size={12} style={{ color: 'var(--text-muted)' }} /> Full Name
              </label>
              <input
                className="input-field"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                maxLength={100}
                required
              />
            </div>

            {/* Email — read-only */}
            <div className="form-group">
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Mail size={12} style={{ color: 'var(--text-muted)' }} /> Email Address
                <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-muted)', marginLeft: 4 }}>read-only</span>
              </label>
              <input
                className="input-field"
                type="email"
                value={user?.email ?? ''}
                readOnly
                style={{ opacity: 0.65, cursor: 'not-allowed', background: 'var(--bg-secondary)' }}
              />
            </div>

            {/* Matric Number — read-only */}
            <div className="form-group">
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Hash size={12} style={{ color: 'var(--text-muted)' }} /> Matric Number
                <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-muted)', marginLeft: 4 }}>read-only</span>
              </label>
              <input
                className="input-field"
                type="text"
                value={user?.matric_number ?? ''}
                readOnly
                style={{ opacity: 0.65, cursor: 'not-allowed', background: 'var(--bg-secondary)', fontFamily: 'monospace', letterSpacing: '0.04em' }}
              />
            </div>

            {/* Phone Number — editable */}
            <div className="form-group">
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Phone size={12} style={{ color: 'var(--text-muted)' }} /> Phone Number
              </label>
              <input
                className="input-field"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 0123456789"
                maxLength={20}
              />
            </div>

          </div>

          {/* Read-only stats row */}
          <div style={{
            display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
            padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)', marginBottom: '1.25rem',
            fontSize: '0.8rem', color: 'var(--text-muted)',
          }}>
            <span>
              Volunteer hours: <strong style={{ color: 'var(--text-primary)' }}>{user?.volunteer_hours ?? 0}</strong>
            </span>
            <span style={{ color: 'var(--border-bright)' }}>·</span>
            <span>
              Member since: <strong style={{ color: 'var(--text-primary)' }}>
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
              </strong>
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving} style={{ minWidth: 120 }}>
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                : <><Save size={14} /> Save Changes</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
