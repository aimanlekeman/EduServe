import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../layout/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { withTimeout } from '../../lib/withTimeout';
import type { Program, Registration } from '../../lib/supabase';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  QrCode,
  Plus,
  CheckCircle,
  XCircle,
  RotateCcw,
  Trash2,
  Loader2,
  X,
  Clock,
  ImagePlus,
  Megaphone,
  Building2,
  CalendarX,
  Calendar,
  MapPin,
} from 'lucide-react';

type Tab = 'overview' | 'programs' | 'registrations';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface ProgramForm {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  volunteer_hours: string;
  max_participants: string;
  organizer: string;
  registration_deadline: string;
}

const EMPTY_FORM: ProgramForm = {
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  volunteer_hours: '1',
  max_participants: '',
  organizer: '',
  registration_deadline: '',
};

const TODAY = new Date().toISOString().split('T')[0];

// FNV-1a-inspired hash: combines qr_code + slot into a non-sequential 6-digit code
function slotCode(qrCode: string, slot: number): string {
  let h = 0x811c9dc5;
  for (const c of qrCode + String(slot)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = (Math.imul(h, 0x45d9f3b) >>> 0) ^ (h >>> 16);
  return String(h % 1_000_000).padStart(6, '0');
}

export function ProgramDirectorDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ProgramForm>(EMPTY_FORM);
  const [programImage, setProgramImage] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  // Filters
  const [programFilter, setProgramFilter] = useState<StatusFilter>('all');
  const [regFilter, setRegFilter] = useState<StatusFilter>('all');

  // QR modal
  const [qrProgram, setQrProgram] = useState<Program | null>(null);
  const [qrPayload, setQrPayload] = useState('');
  const [qrDisplayCode, setQrDisplayCode] = useState('');
  const [qrCountdown, setQrCountdown] = useState(15);

  // Banner editing
  const [bannerUploading, setBannerUploading] = useState<string | null>(null);

  // Program alert
  const [alertProgram, setAlertProgram] = useState<Program | null>(null);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSending, setAlertSending] = useState(false);

  const sendProgramAlert = async () => {
    if (!alertProgram || !alertMessage.trim()) { toast.error('Please enter a message'); return; }
    setAlertSending(true);
    const { data: regs } = await supabase
      .from('registrations').select('user_id')
      .eq('program_id', alertProgram.id).eq('status', 'approved');
    if (!regs || regs.length === 0) {
      toast.error('No approved participants for this program');
      setAlertSending(false);
      return;
    }
    const rows = (regs as { user_id: string }[]).map(r => ({
      user_id: r.user_id,
      title: `📌 Alert: ${alertProgram.title}`,
      body: alertMessage.trim(),
      type: 'program_alert',
      created_by: user?.id,
      program_id: alertProgram.id,
    }));
    const { error } = await supabase.from('notifications').insert(rows);
    setAlertSending(false);
    if (error) { toast.error('Failed to send alert'); }
    else { toast.success(`Alert sent to ${regs.length} participant${regs.length !== 1 ? 's' : ''}`); setAlertProgram(null); setAlertMessage(''); }
  };

  // Reviews
  interface FeedbackRow { rating: number; review: string | null; created_at: string; }
  const [reviewProgram, setReviewProgram] = useState<Program | null>(null);
  const [programFeedback, setProgramFeedback] = useState<FeedbackRow[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const openReviews = async (p: Program) => {
    setReviewProgram(p);
    setProgramFeedback([]);
    setReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('rating, review, created_at')
        .eq('program_id', p.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProgramFeedback((data ?? []) as FeedbackRow[]);
    } catch {
      toast.error('Failed to load reviews.');
      setReviewProgram(null);
    } finally {
      setReviewsLoading(false);
    }
  };

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Program directors share a unified view: all programs created by any director,
      // and every registration across those programs.
      const { data: progData, error: progError } = await supabase
        .from('programs')
        .select('*')
        .order('created_at', { ascending: false });

      if (progError) throw progError;
      if (progData) setPrograms(progData as Program[]);

      const programIds = (progData ?? []).map(p => p.id);
      if (programIds.length > 0) {
        const { data: regData, error: regError } = await supabase
          .from('registrations')
          .select('*, user:user_id(*), program:program_id(title,date)')
          .in('program_id', programIds)
          .order('created_at', { ascending: false });

        if (regError) throw regError;
        if (regData) setRegistrations(regData as Registration[]);
      } else {
        setRegistrations([]);
      }
    } catch (err) {
      console.error('Failed to load director data:', err);
      toast.error('Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Rotate the QR image payload AND the manual-entry code every 15 s while the
  // modal is open. The display code is derived from the current 15-second slot,
  // matching the student-side validation (accepts currentSlot & currentSlot-1).
  useEffect(() => {
    if (!qrProgram) { setQrPayload(''); setQrDisplayCode(''); return; }

    const refresh = () => {
      const slot = Math.floor(Date.now() / 15000);
      setQrDisplayCode(slotCode(qrProgram.qr_code ?? '', slot));
      setQrPayload(JSON.stringify({ programId: qrProgram.qr_code, timestamp: Date.now() }));
    };
    refresh();
    setQrCountdown(15);
    const tick = setInterval(() => {
      setQrCountdown(prev => {
        if (prev <= 1) { refresh(); return 15; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [qrProgram]);

  const createProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    const { title, description, date, time, location, volunteer_hours, organizer, registration_deadline } = formData;
    if (!title || !date || !time || !location || !volunteer_hours) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (registration_deadline && registration_deadline > date) {
      toast.error('Registration deadline cannot be after the event date');
      return;
    }
    setCreating(true);

    let image_url: string | null = null;
    if (programImage) {
      const ext = programImage.name.split('.').pop();
      const path = `programs/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('programs').upload(path, programImage);
      if (uploadErr) {
        toast.error('Failed to upload banner image');
        setCreating(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('programs').getPublicUrl(path);
      image_url = urlData.publicUrl;
    }

    const { error } = await supabase.from('programs').insert({
      title,
      description: description || null,
      date,
      time,
      location,
      volunteer_hours: parseInt(volunteer_hours),
      max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
      organizer: organizer || null,
      registration_deadline: registration_deadline || null,
      created_by: user?.id,
      image_url,
    });
    setCreating(false);
    if (!error) {
      toast.success('Program created! Awaiting admin approval.');
      setFormData(EMPTY_FORM);
      setProgramImage(null);
      setShowForm(false);
      load();
    } else {
      toast.error('Failed to create program');
    }
  };

  const deleteProgram = async (id: string) => {
    if (!confirm('Delete this program?')) return;
    const { error } = await supabase.from('programs').delete().eq('id', id);
    if (!error) { toast.success('Program deleted'); load(); }
    else toast.error('Failed to delete');
  };

  const updateBanner = async (programId: string, file: File) => {
    setBannerUploading(programId);
    const ext = file.name.split('.').pop();
    const path = `programs/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('programs').upload(path, file);
    if (uploadErr) {
      toast.error('Failed to upload image');
      setBannerUploading(null);
      return;
    }
    const { data: urlData } = supabase.storage.from('programs').getPublicUrl(path);
    const { error: updateErr } = await supabase.from('programs').update({ image_url: urlData.publicUrl }).eq('id', programId);
    setBannerUploading(null);
    if (updateErr) {
      toast.error('Failed to save banner');
    } else {
      toast.success('Banner updated!');
      load();
    }
  };

  const updateRegistration = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('registrations').update({ status }).eq('id', id);
    if (!error) {
      toast.success(`Registration ${status}`);
      const reg = registrations.find(r => r.id === id);
      if (reg) {
        const prog = reg.program as { title: string; date: string } | null;
        await supabase.from('notifications').insert({
          user_id: reg.user_id,
          title: status === 'approved' ? 'Registration Approved ✓' : 'Registration Update',
          body: status === 'approved'
            ? `Your registration for "${prog?.title}" has been approved!`
            : `Your registration for "${prog?.title}" was not approved.`,
          type: status === 'approved' ? 'success' : 'warning',
          created_by: user?.id,
          program_id: reg.program_id,
        });
      }
      load();
    } else toast.error('Failed to update registration');
  };

  const stats = {
    total: programs.length,
    approved: programs.filter(p => p.status === 'approved').length,
    pending: programs.filter(p => p.status === 'pending').length,
    pendingRegs: registrations.filter(r => r.status === 'pending').length,
  };

  const filteredPrograms = programFilter === 'all'
    ? programs
    : programs.filter(p => p.status === programFilter);

  const filteredRegistrations = regFilter === 'all'
    ? registrations
    : registrations.filter(r => r.status === regFilter);

  const NAV = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'programs', icon: BookOpen, label: 'My Programs' },
    { id: 'registrations', icon: Users, label: 'Registrations' },
  ];

  const set = (k: keyof ProgramForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData(f => ({ ...f, [k]: e.target.value }));

  return (
    <DashboardLayout
      title={tab === 'overview' ? 'Overview' : tab === 'programs' ? 'My Programs' : 'Registrations'}
      subtitle={`Welcome, ${user?.name}`}
      navItems={NAV}
      activeTab={tab}
      onTabChange={(t) => setTab(t as Tab)}
      roleLabel="Program Director"
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem', color: 'var(--blue-400)' }} />
          <p>Loading...</p>
        </div>
      ) : (
        <>
          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="animate-fade-up">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {[
                  { label: 'Total Programs', value: stats.total, icon: BookOpen, color: 'var(--blue-400)' },
                  { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'var(--success)' },
                  { label: 'Pending Approval', value: stats.pending, icon: Clock, color: 'var(--warning)' },
                  { label: 'Pending Regs', value: stats.pendingRegs, icon: Users, color: 'var(--pending)' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div className="stat-card" key={label}>
                    <div className="stat-icon" style={{ background: `${color}18` }}>
                      <Icon size={22} style={{ color }} />
                    </div>
                    <div>
                      <div className="stat-value">{value}</div>
                      <div className="stat-label">{label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                <div
                  className="card"
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}
                  onClick={() => { setTab('programs'); setShowForm(true); }}
                >
                  <div className="stat-icon"><Plus size={22} style={{ color: 'var(--blue-400)' }} /></div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>Create Program</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Add a new volunteer program</div>
                  </div>
                </div>
                <div
                  className="card"
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}
                  onClick={() => setTab('registrations')}
                >
                  <div className="stat-icon" style={{ background: 'rgba(139,92,246,0.12)' }}><Users size={22} style={{ color: 'var(--pending)' }} /></div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>Review Registrations</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{stats.pendingRegs} pending</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Programs ── */}
          {tab === 'programs' && (
            <div className="animate-fade-up">
              {/* Toolbar */}
              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <select
                  className="input-field"
                  style={{ width: 'auto', minWidth: 170 }}
                  value={programFilter}
                  onChange={e => setProgramFilter(e.target.value as StatusFilter)}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
                  <Plus size={15} /> Create Program
                </button>
              </div>

              {/* Create form */}
              {showForm && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>New Volunteer Program</h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}><X size={16} /></button>
                  </div>
                  <form onSubmit={createProgram}>
                    <div className="form-group">
                      <label className="label">Program Title *</label>
                      <input className="input-field" value={formData.title} onChange={set('title')} placeholder="e.g. Community Clean-Up Drive" />
                    </div>
                    <div className="form-group">
                      <label className="label">Description</label>
                      <textarea className="input-field" rows={3} value={formData.description} onChange={set('description')} placeholder="Describe the program..." style={{ resize: 'vertical' }} />
                    </div>
                    <div className="form-group">
                      <label className="label">Organizer(s)</label>
                      <input className="input-field" value={formData.organizer} onChange={set('organizer')} placeholder="e.g. FSKTM, Computer Science Society" />
                    </div>
                    <div className="form-group">
                      <label className="label">Banner Image</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="input-field"
                        style={{ cursor: 'pointer' }}
                        onChange={e => setProgramImage(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.875rem' }}>
                      <div className="form-group">
                        <label className="label">Date *</label>
                        <input
                          type="date"
                          className="input-field"
                          value={formData.date}
                          min={TODAY}
                          onChange={set('date')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="label">Time *</label>
                        <input type="time" className="input-field" value={formData.time} onChange={set('time')} />
                      </div>
                      <div className="form-group">
                        <label className="label">Registration Deadline</label>
                        <input
                          type="date"
                          className="input-field"
                          value={formData.registration_deadline}
                          min={TODAY}
                          max={formData.date || undefined}
                          onChange={set('registration_deadline')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="label">Volunteer Hours *</label>
                        <input type="number" min="1" max="24" className="input-field" value={formData.volunteer_hours} onChange={set('volunteer_hours')} />
                      </div>
                      <div className="form-group">
                        <label className="label">Max Participants</label>
                        <input type="number" min="1" className="input-field" value={formData.max_participants} onChange={set('max_participants')} placeholder="Unlimited" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="label">Location *</label>
                      <input className="input-field" value={formData.location} onChange={set('location')} placeholder="e.g. UTHM Main Campus" />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Submit for Approval
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Programs grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {filteredPrograms.length === 0 && (
                  <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem', gridColumn: '1 / -1' }}>
                    {programFilter === 'all' ? 'No programs yet. Create your first one!' : `No ${programFilter} programs.`}
                  </div>
                )}
                {filteredPrograms.map(p => {
                  const joined = registrations.filter(r => r.program_id === p.id && r.status !== 'rejected').length;
                  return (
                    <div className="program-card" key={p.id} id={`program-card-${p.id}`} style={{ padding: 0, overflow: 'hidden' }}>

                      {/* Banner */}
                      <div className="program-card-banner">
                        {p.image_url
                          ? <img src={p.image_url} alt={p.title} />
                          : <div className="program-card-banner-placeholder" />
                        }
                      </div>

                      {/* Content */}
                      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                        {/* Title + status badge */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>{p.title}</span>
                            <span className={`badge badge-${p.status === 'approved' ? 'approved' : p.status === 'pending' ? 'pending' : 'rejected'}`}>{p.status}</span>
                          </div>
                          {p.description && (
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>
                              {p.description}
                            </p>
                          )}
                        </div>

                        {/* Meta rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {([
                            { icon: Calendar,   text: new Date(p.date).toLocaleDateString('en-MY') },
                            { icon: MapPin,     text: p.location },
                            { icon: Clock,      text: `${p.volunteer_hours} volunteer hours` },
                            ...(p.organizer ? [{ icon: Building2, text: p.organizer }] : []),
                          ] as { icon: React.ElementType; text: string }[]).map(({ icon: Icon, text }) => (
                            <div key={text} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Icon size={12} /> {text}
                            </div>
                          ))}
                          {p.registration_deadline && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CalendarX size={11} /> Reg. by {new Date(p.registration_deadline).toLocaleDateString('en-MY')}
                            </div>
                          )}
                        </div>

                        {/* Participant count */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '0.35rem 0.6rem', borderRadius: 6, width: 'fit-content' }}>
                          <Users size={12} />
                          {p.max_participants
                            ? <span><strong style={{ color: 'var(--text-primary)' }}>{joined}</strong> / {p.max_participants} Participants</span>
                            : <span><strong style={{ color: 'var(--text-primary)' }}>{joined}</strong> Participants · Unlimited</span>
                          }
                        </div>

                        {/* Director actions */}
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', paddingTop: '0.625rem', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
                          {/* Hidden file input for banner update */}
                          <input
                            type="file"
                            accept="image/*"
                            id={`banner-${p.id}`}
                            style={{ display: 'none' }}
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) updateBanner(p.id, file);
                              e.target.value = '';
                            }}
                          />
                          <label
                            htmlFor={`banner-${p.id}`}
                            className="btn btn-outline btn-sm"
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}
                            title={p.image_url ? 'Change banner' : 'Add banner'}
                          >
                            {bannerUploading === p.id ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                            Banner
                          </label>
                          {p.status === 'approved' && (
                            <button className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}
                              onClick={() => { setAlertProgram(p); setAlertMessage(''); }}>
                              <Megaphone size={13} /> Alert
                            </button>
                          )}
                          {p.status === 'approved' && (
                            <button className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}
                              onClick={() => openReviews(p)}>
                              ★ Reviews
                            </button>
                          )}
                          {p.status === 'approved' && p.qr_code && (
                            <button className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}
                              onClick={() => setQrProgram(p)}>
                              <QrCode size={13} /> QR
                            </button>
                          )}
                          <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }}
                            onClick={() => deleteProgram(p.id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Registrations ── */}
          {tab === 'registrations' && (
            <div className="animate-fade-up">
              <div style={{ marginBottom: '0.875rem' }}>
                <select
                  className="input-field"
                  style={{ width: 'auto', minWidth: 180 }}
                  value={regFilter}
                  onChange={e => setRegFilter(e.target.value as StatusFilter)}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="card">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Matric No.</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Phone</th>
                        <th>Program</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Date Applied</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRegistrations.length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No registrations found</td></tr>
                      )}
                      {filteredRegistrations.map(r => {
                        const regUser = r.user as { name: string; email: string; matric_number: string | null; phone_number: string | null } | undefined;
                        return (
                        <tr key={r.id}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{regUser?.name}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {regUser?.matric_number
                              ? <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', letterSpacing: '0.04em' }}>{regUser.matric_number}</span>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>
                            }
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {regUser?.phone_number
                              ? <a href={`tel:${regUser.phone_number.replace(/\s/g, '')}`} style={{ color: 'var(--blue-500)', textDecoration: 'none', fontWeight: 500 }}>{regUser.phone_number}</a>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>
                            }
                          </td>
                          <td>{(r.program as { title: string })?.title}</td>
                          <td>{new Date(r.created_at).toLocaleDateString('en-MY')}</td>
                          <td><span className={`badge badge-${r.status === 'approved' ? 'approved' : r.status === 'pending' ? 'pending' : 'rejected'}`}>{r.status}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                              {r.status === 'pending' && (
                                <>
                                  <button className="btn btn-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.2)', padding: '0.3rem 0.6rem' }} onClick={() => updateRegistration(r.id, 'approved')} title="Approve"><CheckCircle size={13} /></button>
                                  <button className="btn btn-danger btn-sm" style={{ padding: '0.3rem 0.6rem' }} onClick={() => updateRegistration(r.id, 'rejected')} title="Reject"><XCircle size={13} /></button>
                                </>
                              )}
                              {r.status === 'approved' && (
                                <button className="btn btn-danger btn-sm" style={{ padding: '0.3rem 0.6rem' }} onClick={() => updateRegistration(r.id, 'rejected')} title="Revoke approval"><XCircle size={13} /></button>
                              )}
                              {r.status === 'rejected' && (
                                <button className="btn btn-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.2)', padding: '0.3rem 0.6rem' }} onClick={() => updateRegistration(r.id, 'approved')} title="Restore / Approve"><RotateCcw size={13} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* QR Modal */}
      {qrProgram && (
        <div className="modal-overlay" onClick={() => setQrProgram(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{qrProgram.title}</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Show this live QR — it refreshes every 15 s to prevent sharing</p>
            <div className="qr-display" style={{ margin: '0 auto 1.25rem' }}>
              {qrPayload && (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrPayload)}`}
                  alt="QR Code"
                  width={200}
                  height={200}
                />
              )}
              {/* Countdown bar */}
              <div style={{ marginTop: '0.875rem' }}>
                <div style={{ height: 4, borderRadius: 999, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 999,
                    background: qrCountdown <= 5 ? '#ef4444' : 'var(--blue-400)',
                    width: `${(qrCountdown / 15) * 100}%`,
                    transition: 'width 0.9s linear, background 0.3s',
                  }} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', marginBottom: 0 }}>
                  Refreshing in <strong style={{ color: qrCountdown <= 5 ? '#ef4444' : 'var(--text-primary)' }}>{qrCountdown}s</strong>
                </p>
              </div>

              {/* Manual entry code */}
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Manual Entry Code</p>
                <p style={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.12em', margin: 0 }}>
                  {qrDisplayCode}
                </p>
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setQrProgram(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Send Alert Modal */}
      {alertProgram && (
        <div className="modal-overlay" onClick={() => setAlertProgram(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Send Alert to Participants
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{alertProgram.title}</p>
            <div className="form-group" style={{ margin: '0 0 1.25rem' }}>
              <label className="label">Message</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder='e.g. "Reminder: Please bring an umbrella tomorrow!"'
                value={alertMessage}
                onChange={e => setAlertMessage(e.target.value)}
                style={{ resize: 'vertical' }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                disabled={alertSending || !alertMessage.trim()}
                onClick={sendProgramAlert}
              >
                {alertSending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Megaphone size={14} /> Send Alert</>}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAlertProgram(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reviews Modal */}
      {reviewProgram && (
        <div className="modal-overlay" onClick={() => setReviewProgram(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Student Reviews
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{reviewProgram.title}</p>

            {reviewsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
              </div>
            ) : programFeedback.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>No reviews yet for this program.</p>
            ) : (
              <>
                {/* Average rating summary */}
                {(() => {
                  const avg = programFeedback.reduce((s, f) => s + f.rating, 0) / programFeedback.length;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: 'rgba(212,175,90,0.08)', border: '1px solid rgba(212,175,90,0.25)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '2rem', fontWeight: 800, color: '#D4AF5A', fontFamily: 'var(--font-display)' }}>{avg.toFixed(1)}</span>
                      <div>
                        <div style={{ color: '#D4AF5A', fontSize: '1.1rem', letterSpacing: 2 }}>
                          {'★'.repeat(Math.round(avg))}{'☆'.repeat(5 - Math.round(avg))}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{programFeedback.length} review{programFeedback.length !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Individual reviews */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 320, overflowY: 'auto' }}>
                  {programFeedback.map((f, i) => (
                    <div key={i} style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ color: '#D4AF5A', fontSize: '0.9rem' }}>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(f.created_at).toLocaleDateString('en-MY')}</span>
                      </div>
                      {f.review && <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{f.review}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}

            <button className="btn btn-outline btn-sm" style={{ marginTop: '1.25rem', width: '100%', justifyContent: 'center' }} onClick={() => setReviewProgram(null)}>Close</button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
