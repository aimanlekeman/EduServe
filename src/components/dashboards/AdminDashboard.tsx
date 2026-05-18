import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../layout/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { withTimeout } from '../../lib/withTimeout';
import type { Profile, Program, Registration, Achievement } from '../../lib/supabase';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Trophy,
  CheckCircle,
  XCircle,
  RotateCcw,
  Trash2,
  Plus,
  Loader2,
  Calendar,
  BarChart2,
  Clock,
} from 'lucide-react';
import { AnalyticsTab } from './AnalyticsTab';

type Tab = 'overview' | 'programs' | 'users' | 'achievements' | 'analytics';

export function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  // Program / user filters
  const [programFilter, setProgramFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'program_director' | 'student'>('all');

  // Achievement form
  const [achForm, setAchForm] = useState({ title: '', description: '', date: '', category: 'general', icon: 'trophy' });
  const [achImage, setAchImage] = useState<File | null>(null);
  const [achLoading, setAchLoading] = useState(false);
  const [showAchForm, setShowAchForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, u, r, a] = await withTimeout(Promise.all([
        supabase.from('programs').select('*, creator:created_by(name,email)').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('registrations').select('*, program:program_id(title,date), user:user_id(name,email)').order('created_at', { ascending: false }),
        supabase.from('achievements').select('*').order('date', { ascending: false }),
      ]));
      if (p.data) setPrograms(p.data as Program[]);
      if (u.data) setUsers(u.data as Profile[]);
      if (r.data) setRegistrations(r.data as Registration[]);
      if (a.data) setAchievements(a.data as Achievement[]);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      toast.error('Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approveProgram = async (id: string, approved: boolean) => {
    const { error } = await supabase
      .from('programs')
      .update({ status: approved ? 'approved' : 'rejected' })
      .eq('id', id);
    if (!error) {
      toast.success(`Program ${approved ? 'approved' : 'rejected'}`);
      load();
    } else {
      toast.error('Failed to update program');
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (!error) { toast.success('User deleted'); load(); }
    else toast.error('Failed to delete user');
  };

  const deleteProgram = async (id: string) => {
    if (!confirm('Delete this program?')) return;
    const { error } = await supabase.from('programs').delete().eq('id', id);
    if (!error) { toast.success('Program deleted'); load(); }
    else toast.error('Failed to delete program');
  };

  const createAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!achForm.title) { toast.error('Title is required'); return; }
    setAchLoading(true);

    let image_url: string | null = null;
    if (achImage) {
      const ext = achImage.name.split('.').pop();
      const path = `achievements/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('achievements').upload(path, achImage);
      if (uploadErr) {
        toast.error('Failed to upload image');
        setAchLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('achievements').getPublicUrl(path);
      image_url = urlData.publicUrl;
    }

    const { error } = await supabase.from('achievements').insert({ ...achForm, image_url });
    setAchLoading(false);
    if (!error) {
      toast.success('Achievement added');
      setAchForm({ title: '', description: '', date: '', category: 'general', icon: 'trophy' });
      setAchImage(null);
      setShowAchForm(false);
      load();
    } else toast.error('Failed to add achievement');
  };

  const deleteAchievement = async (id: string) => {
    if (!confirm('Delete this achievement?')) return;
    const { error } = await supabase.from('achievements').delete().eq('id', id);
    if (!error) { toast.success('Deleted'); load(); }
  };

  const stats = {
    totalUsers: users.filter(u => u.role === 'student').length,
    totalPrograms: programs.filter(p => p.status === 'approved').length,
    pendingPrograms: programs.filter(p => p.status === 'pending').length,
    totalHours: users.reduce((s, u) => s + (u.volunteer_hours || 0), 0),
  };

  const filteredPrograms = programFilter === 'all' ? programs : programs.filter(p => p.status === programFilter);
  const filteredUsers = userRoleFilter === 'all' ? users : users.filter(u => u.role === userRoleFilter);

  const NAV = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'programs', icon: BookOpen, label: 'Programs' },
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'achievements', icon: Trophy, label: 'Achievements' },
    { id: 'analytics', icon: BarChart2, label: 'Analytics' },
  ];

  const tabTitle: Record<Tab, string> = {
    overview: 'Dashboard Overview',
    programs: 'Program Management',
    users: 'User Management',
    achievements: 'Achievements',
    analytics: 'Analytics & KPI',
  };

  return (
    <DashboardLayout
      title={tabTitle[tab]}
      subtitle={`Welcome back, ${user?.name}`}
      navItems={NAV}
      activeTab={tab}
      onTabChange={(t) => setTab(t as Tab)}
      roleLabel="Administrator"
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem', color: 'var(--blue-400)' }} />
          <p>Loading data...</p>
        </div>
      ) : (
        <>
          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="animate-fade-up">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {[
                  { label: 'Total Students', value: stats.totalUsers, icon: Users, color: 'var(--blue-400)' },
                  { label: 'Active Programs', value: stats.totalPrograms, icon: BookOpen, color: 'var(--success)' },
                  { label: 'Pending Approval', value: stats.pendingPrograms, icon: Clock, color: 'var(--warning)' },
                  { label: 'Volunteer Hours', value: stats.totalHours, icon: Trophy, color: 'var(--blue-300)' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div className="stat-card" key={label}>
                    <div className="stat-icon" style={{ background: `${color}18` }}>
                      <Icon size={22} style={{ color }} />
                    </div>
                    <div>
                      <div className="stat-value">{value.toLocaleString()}</div>
                      <div className="stat-label">{label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pending programs quick view */}
              {stats.pendingPrograms > 0 && (
                <div className="card">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    Pending Program Approvals
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {programs.filter(p => p.status === 'pending').slice(0, 5).map(p => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.875rem',
                          background: 'var(--bg-secondary)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                          gap: '1rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{p.title}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {new Date(p.date).toLocaleDateString('en-MY')} · {p.location}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.2)' }} onClick={() => approveProgram(p.id, true)}>
                            <CheckCircle size={14} /> Approve
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => approveProgram(p.id, false)}>
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Programs ── */}
          {tab === 'programs' && (
            <div className="animate-fade-up">
              <div style={{ marginBottom: '0.875rem' }}>
                <select
                  className="input-field"
                  style={{ width: 'auto', minWidth: 180 }}
                  value={programFilter}
                  onChange={e => setProgramFilter(e.target.value as typeof programFilter)}
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
                        <th>Program</th>
                        <th>Date</th>
                        <th>Location</th>
                        <th>Hours</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrograms.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No programs found</td></tr>
                      )}
                      {filteredPrograms.map(p => (
                        <tr key={p.id}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.title}</td>
                          <td>{new Date(p.date).toLocaleDateString('en-MY')}</td>
                          <td>{p.location}</td>
                          <td>{p.volunteer_hours}h</td>
                          <td><span className={`badge badge-${p.status === 'approved' ? 'approved' : p.status === 'pending' ? 'pending' : 'rejected'}`}>{p.status}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                              {p.status === 'pending' && (
                                <>
                                  <button className="btn btn-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.2)', padding: '0.3rem 0.6rem' }} onClick={() => approveProgram(p.id, true)} title="Approve"><CheckCircle size={13} /></button>
                                  <button className="btn btn-danger btn-sm" style={{ padding: '0.3rem 0.6rem' }} onClick={() => approveProgram(p.id, false)} title="Reject"><XCircle size={13} /></button>
                                </>
                              )}
                              {p.status === 'approved' && (
                                <button className="btn btn-danger btn-sm" style={{ padding: '0.3rem 0.6rem' }} onClick={() => approveProgram(p.id, false)} title="Reject"><XCircle size={13} /></button>
                              )}
                              {p.status === 'rejected' && (
                                <button className="btn btn-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.2)', padding: '0.3rem 0.6rem' }} onClick={() => approveProgram(p.id, true)} title="Restore / Approve"><RotateCcw size={13} /></button>
                              )}
                              <button className="btn btn-danger btn-sm" style={{ padding: '0.3rem 0.6rem' }} onClick={() => deleteProgram(p.id)} title="Delete"><Trash2 size={13} /></button>
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

          {/* ── Users ── */}
          {tab === 'users' && (
            <div className="animate-fade-up">
              <div style={{ marginBottom: '0.875rem' }}>
                <select
                  className="input-field"
                  style={{ width: 'auto', minWidth: 180 }}
                  value={userRoleFilter}
                  onChange={e => setUserRoleFilter(e.target.value as typeof userRoleFilter)}
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="program_director">Program Director</option>
                  <option value="student">Student</option>
                </select>
              </div>
              <div className="card">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Hours</th>
                        <th>Joined</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No users found</td></tr>
                      )}
                      {filteredUsers.map(u => (
                        <tr key={u.id}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{u.name}</td>
                          <td>{u.email}</td>
                          <td>
                            <span className="badge badge-blue" style={{ textTransform: 'capitalize', fontSize: '0.7rem' }}>
                              {u.role === 'program_director' ? 'Director' : u.role}
                            </span>
                          </td>
                          <td>{u.role === 'student' ? `${u.volunteer_hours}h` : '—'}</td>
                          <td>{new Date(u.created_at).toLocaleDateString('en-MY')}</td>
                          <td>
                            {u.id !== user?.id && (
                              <button className="btn btn-danger btn-sm" style={{ padding: '0.3rem 0.6rem' }} onClick={() => deleteUser(u.id)}><Trash2 size={13} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Achievements ── */}
          {tab === 'achievements' && (
            <div className="animate-fade-up">
              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAchForm(!showAchForm)}>
                  <Plus size={15} /> Add Achievement
                </button>
              </div>

              {showAchForm && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
                    New Achievement
                  </h3>
                  <form onSubmit={createAchievement}>
                    <div className="form-group">
                      <label className="label">Title *</label>
                      <input className="input-field" value={achForm.title} onChange={e => setAchForm(f => ({ ...f, title: e.target.value }))} placeholder="Achievement title" />
                    </div>
                    <div className="form-group">
                      <label className="label">Description</label>
                      <textarea className="input-field" rows={3} value={achForm.description} onChange={e => setAchForm(f => ({ ...f, description: e.target.value }))} placeholder="Details..." style={{ resize: 'vertical' }} />
                    </div>
                    <div className="form-group">
                      <label className="label">Background Image</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="input-field"
                        onChange={e => setAchImage(e.target.files?.[0] ?? null)}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
                      <div className="form-group">
                        <label className="label">Date</label>
                        <input
                          type="date"
                          className="input-field"
                          value={achForm.date}
                          onChange={e => setAchForm(f => ({ ...f, date: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="label">Category</label>
                        <select className="input-field" value={achForm.category} onChange={e => setAchForm(f => ({ ...f, category: e.target.value }))}>
                          <option value="general">General</option>
                          <option value="award">Award</option>
                          <option value="milestone">Milestone</option>
                          <option value="recognition">Recognition</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="label">Icon</label>
                        <select className="input-field" value={achForm.icon} onChange={e => setAchForm(f => ({ ...f, icon: e.target.value }))}>
                          <option value="trophy">Trophy</option>
                          <option value="users">Users</option>
                          <option value="star">Star</option>
                          <option value="clock">Clock</option>
                          <option value="award">Award</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={achLoading}>
                        {achLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAchForm(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {achievements.length === 0 && (
                  <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1/-1', padding: '3rem' }}>
                    No achievements yet. Add one above.
                  </div>
                )}
                {achievements.map(a => (
                  <div className="card" key={a.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>{a.category}</span>
                      <button className="btn btn-danger btn-sm" style={{ padding: '0.25rem 0.5rem' }} onClick={() => deleteAchievement(a.id)}><Trash2 size={12} /></button>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{a.title}</div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{a.description}</p>
                    {a.date && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={11} /> {new Date(a.date).toLocaleDateString('en-MY')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Analytics ── */}
          {tab === 'analytics' && (
            <AnalyticsTab
              programs={programs}
              users={users}
              registrations={registrations}
            />
          )}
        </>
      )}
    </DashboardLayout>
  );
}
