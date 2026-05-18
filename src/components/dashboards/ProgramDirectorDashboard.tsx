import { useState, useEffect, useCallback } from 'react';
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
}

const EMPTY_FORM: ProgramForm = {
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  volunteer_hours: '1',
  max_participants: '',
};

const TODAY = new Date().toISOString().split('T')[0];

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

  // Banner editing
  const [bannerUploading, setBannerUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [p, r] = await withTimeout(Promise.all([
        supabase
          .from('programs')
          .select('*')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('registrations')
          .select('*, user:user_id(name,email), program:program_id(title,date)')
          .in('program_id', (await supabase.from('programs').select('id').eq('created_by', user.id)).data?.map(p => p.id) || [])
          .order('created_at', { ascending: false }),
      ]));
      if (p.data) setPrograms(p.data as Program[]);
      if (r.data) setRegistrations(r.data as Registration[]);
    } catch (err) {
      console.error('Failed to load director data:', err);
      toast.error('Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const createProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    const { title, description, date, time, location, volunteer_hours } = formData;
    if (!title || !date || !time || !location || !volunteer_hours) {
      toast.error('Please fill in all required fields');
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
    if (!error) { toast.success(`Registration ${status}`); load(); }
    else toast.error('Failed to update registration');
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

              {/* Programs list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {filteredPrograms.length === 0 && (
                  <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                    {programFilter === 'all' ? 'No programs yet. Create your first one!' : `No ${programFilter} programs.`}
                  </div>
                )}
                {filteredPrograms.map(p => (
                  <div className="card" key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Banner thumbnail */}
                    <div style={{
                      width: 90, height: 64, borderRadius: 'var(--radius-md)', overflow: 'hidden',
                      flexShrink: 0, background: 'rgba(37,99,235,0.12)', position: 'relative',
                    }}>
                      {p.image_url
                        ? <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ImagePlus size={20} style={{ color: 'var(--blue-400)', opacity: 0.5 }} />
                          </div>
                      }
                    </div>

                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>{p.title}</span>
                        <span className={`badge badge-${p.status === 'approved' ? 'approved' : p.status === 'pending' ? 'pending' : 'rejected'}`}>{p.status}</span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span>{new Date(p.date).toLocaleDateString('en-MY')}</span>
                        <span>{p.location}</span>
                        <span>{p.volunteer_hours}h</span>
                      </div>
                      {p.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.375rem' }}>{p.description}</p>}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
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
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        title={p.image_url ? 'Change banner' : 'Add banner'}
                      >
                        {bannerUploading === p.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <ImagePlus size={14} />
                        }
                        {p.image_url ? 'Change' : 'Add Banner'}
                      </label>
                      {p.status === 'approved' && p.qr_code && (
                        <button className="btn btn-outline btn-sm" onClick={() => setQrProgram(p)}>
                          <QrCode size={14} /> QR Code
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => deleteProgram(p.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
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
                        <th>Program</th>
                        <th>Date Applied</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRegistrations.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No registrations found</td></tr>
                      )}
                      {filteredRegistrations.map(r => (
                        <tr key={r.id}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{(r.user as { name: string })?.name}</td>
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
                      ))}
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
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Share this QR code for attendance</p>
            <div className="qr-display" style={{ margin: '0 auto 1.25rem' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrProgram.qr_code || '')}`}
                alt="QR Code"
                width={200}
                height={200}
              />
              <div style={{ fontSize: '0.8125rem', color: '#475569', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                {qrProgram.qr_code}
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setQrProgram(null)}>Close</button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
