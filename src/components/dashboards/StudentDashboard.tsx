import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../layout/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { withTimeout } from '../../lib/withTimeout';
import type { Program, Registration, AttendanceRecord, Certificate } from '../../lib/supabase';
import { toast } from 'sonner';
import { QrScannerModal } from '../QrScannerModal';
import { CertificateModal } from '../CertificateModal';
import {
  LayoutDashboard,
  BookOpen,
  QrCode,
  Award,
  Clock,
  CheckCircle,
  MapPin,
  Calendar,
  Loader2,
  Eye,
  Users,
} from 'lucide-react';

type Tab = 'overview' | 'programs' | 'attendance' | 'certificates';
type ProgramFilter = 'all' | 'available' | 'registered';

export function StudentDashboard() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [myAttendance, setMyAttendance] = useState<AttendanceRecord[]>([]);
  const [myCertificates, setMyCertificates] = useState<Certificate[]>([]);
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [viewCert, setViewCert] = useState<Certificate | null>(null);
  const [programFilter, setProgramFilter] = useState<ProgramFilter>('all');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [p, reg, att, cert] = await withTimeout(Promise.all([
        supabase.from('programs').select('*').eq('status', 'approved').order('date', { ascending: true }),
        supabase.from('registrations').select('*, program:program_id(title,date,location,volunteer_hours)').eq('user_id', user.id),
        supabase.from('attendance').select('*, program:program_id(title,date,volunteer_hours)').eq('user_id', user.id).order('scanned_at', { ascending: false }),
        supabase.from('certificates').select('*, program:program_id(title,date,volunteer_hours)').eq('user_id', user.id).order('issued_at', { ascending: false }),
      ]));
      if (p.data) {
        setPrograms(p.data as Program[]);
        if (p.data.length > 0) {
          const { data: regData } = await supabase
            .from('registrations')
            .select('program_id')
            .in('program_id', p.data.map(prog => prog.id))
            .eq('status', 'approved');
          const counts: Record<string, number> = {};
          (regData || []).forEach((r: { program_id: string }) => {
            counts[r.program_id] = (counts[r.program_id] || 0) + 1;
          });
          setRegCounts(counts);
        }
      }
      if (reg.data) setMyRegistrations(reg.data as Registration[]);
      if (att.data) setMyAttendance(att.data as AttendanceRecord[]);
      if (cert.data) setMyCertificates(cert.data as Certificate[]);
    } catch (err) {
      console.error('Failed to load student data:', err);
      toast.error('Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const registerForProgram = async (programId: string) => {
    const { error } = await supabase.from('registrations').insert({
      program_id: programId,
      user_id: user?.id,
    });
    if (!error) { toast.success('Registration submitted! Awaiting approval.'); load(); }
    else if (error.code === '23505') toast.error('Already registered for this program');
    else toast.error('Registration failed');
  };

  const scanQR = async (code: string) => {
    if (!code) { toast.error('No QR code detected'); return; }
    setScanning(true);

    const { data: program } = await supabase
      .from('programs')
      .select('*')
      .eq('qr_code', code)
      .eq('status', 'approved')
      .single();

    if (!program) {
      toast.error('Invalid QR code or program not found');
      setScanning(false);
      return;
    }

    const { data: reg } = await supabase
      .from('registrations')
      .select('id')
      .eq('program_id', program.id)
      .eq('user_id', user?.id)
      .eq('status', 'approved')
      .single();

    if (!reg) {
      toast.error('You are not registered or approved for this program');
      setScanning(false);
      return;
    }

    const { error: attErr } = await supabase.from('attendance').insert({
      program_id: program.id,
      user_id: user?.id,
    });

    if (attErr?.code === '23505') {
      toast.error('Attendance already recorded for this program');
    } else if (attErr) {
      toast.error('Failed to record attendance');
    } else {
      const { error: certErr } = await supabase.from('certificates').insert({
        program_id: program.id,
        user_id: user?.id,
        certificate_no: `CERT-${Date.now().toString(36).toUpperCase()}`,
      });
      if (certErr) {
        console.error('Certificate insert failed:', certErr);
        toast.error(`Attendance recorded but certificate failed: ${certErr.message}`);
      } else {
        toast.success(`Attendance recorded for "${program.title}"! Certificate generated.`);
      }
      await refreshUser();
      load();
    }

    setShowQrModal(false);
    setScanning(false);
  };

  const registeredProgramIds = new Set(myRegistrations.map(r => r.program_id));
  const attendedProgramIds   = new Set(myAttendance.map(a => a.program_id));

  const filteredPrograms = programs.filter(p => {
    if (programFilter === 'available')  return !registeredProgramIds.has(p.id);
    if (programFilter === 'registered') return registeredProgramIds.has(p.id);
    return true;
  });

  const NAV = [
    { id: 'overview',      icon: LayoutDashboard, label: 'Overview' },
    { id: 'programs',      icon: BookOpen,         label: 'Programs' },
    { id: 'attendance',    icon: QrCode,           label: 'Attendance' },
    { id: 'certificates',  icon: Award,            label: 'Certificates' },
  ];

  return (
    <>
    <DashboardLayout
      title={tab === 'overview' ? 'My Dashboard' : tab === 'programs' ? 'Available Programs' : tab === 'attendance' ? 'Attendance' : 'My Certificates'}
      subtitle={`Welcome, ${user?.name}`}
      navItems={NAV}
      activeTab={tab}
      onTabChange={(t) => setTab(t as Tab)}
      roleLabel="Student"
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem', color: 'var(--blue-400)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      ) : (
        <>
          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="animate-fade-up">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {[
                  { label: 'Volunteer Hours',   value: user?.volunteer_hours ?? 0, icon: Clock,       color: 'var(--blue-400)' },
                  { label: 'Registrations',      value: myRegistrations.length,      icon: BookOpen,    color: 'var(--success)'  },
                  { label: 'Programs Attended',  value: myAttendance.length,         icon: CheckCircle, color: 'var(--warning)'  },
                  { label: 'Certificates',       value: myCertificates.length,       icon: Award,       color: 'var(--pending)'  },
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

              {/* Scan QR shortcut */}
              <div
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', cursor: 'pointer', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.25)', marginBottom: '1.5rem' }}
                onClick={() => setShowQrModal(true)}
              >
                <div className="stat-icon" style={{ background: 'rgba(37,99,235,0.15)', flexShrink: 0 }}>
                  <QrCode size={22} style={{ color: 'var(--blue-400)' }} />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                    Scan Attendance QR Code
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Enter the QR code from your program coordinator to record attendance
                  </div>
                </div>
              </div>

              {/* Upcoming registered programs */}
              {myRegistrations.filter(r => r.status === 'approved').length > 0 && (
                <div className="card">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    My Approved Programs
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {myRegistrations.filter(r => r.status === 'approved').map(r => {
                      const prog = r.program as { title: string; date: string; location: string; volunteer_hours: number };
                      return (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{prog?.title}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem' }}>
                              <span>{new Date(prog?.date).toLocaleDateString('en-MY')}</span>
                              <span>{prog?.volunteer_hours}h</span>
                            </div>
                          </div>
                          {attendedProgramIds.has(r.program_id) ? (
                            <span className="badge badge-approved"><CheckCircle size={11} /> Attended</span>
                          ) : (
                            <span className="badge badge-blue">Registered</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Programs ── */}
          {tab === 'programs' && (
            <div className="animate-fade-up">
              {/* Filter toolbar */}
              <div style={{ marginBottom: '1rem' }}>
                <select
                  className="input-field"
                  style={{ width: 'auto', minWidth: 200 }}
                  value={programFilter}
                  onChange={e => setProgramFilter(e.target.value as ProgramFilter)}
                >
                  <option value="all">All Programs</option>
                  <option value="available">Available to Register</option>
                  <option value="registered">Registered</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {filteredPrograms.length === 0 && (
                  <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1/-1', padding: '3rem' }}>
                    {programFilter === 'registered'
                      ? "You haven't registered for any programs yet."
                      : programFilter === 'available'
                      ? 'No programs available to register right now.'
                      : 'No programs available right now.'}
                  </div>
                )}
                {filteredPrograms.map(p => {
                  const isRegistered = registeredProgramIds.has(p.id);
                  const isAttended   = attendedProgramIds.has(p.id);
                  const joined       = regCounts[p.id] || 0;
                  const regStatus    = myRegistrations.find(r => r.program_id === p.id)?.status;

                  return (
                    <div
                      className="program-card"
                      key={p.id}
                      style={{ padding: 0, overflow: 'hidden' }}
                    >
                      {/* Banner */}
                      <div className="program-card-banner">
                        {p.image_url
                          ? <img src={p.image_url} alt={p.title} />
                          : <div className="program-card-banner-placeholder" />
                        }
                      </div>

                      {/* Content */}
                      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{p.title}</div>
                          {p.description && (
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>
                              {p.description}
                            </p>
                          )}
                        </div>

                        {/* Meta */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {[
                            { icon: Calendar, text: new Date(p.date).toLocaleDateString('en-MY') },
                            { icon: MapPin,   text: p.location },
                            { icon: Clock,    text: `${p.volunteer_hours} volunteer hours` },
                          ].map(({ icon: Icon, text }) => (
                            <div key={text} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Icon size={12} /> {text}
                            </div>
                          ))}
                        </div>

                        {/* Participant count */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '0.35rem 0.6rem', borderRadius: 6, width: 'fit-content' }}>
                          <Users size={12} />
                          {p.max_participants
                            ? <span><strong style={{ color: 'var(--text-primary)' }}>{joined}</strong> / {p.max_participants} Participants</span>
                            : <span><strong style={{ color: 'var(--text-primary)' }}>{joined}</strong> Participants · Unlimited</span>
                          }
                        </div>

                        {/* Action */}
                        <div>
                          {isAttended ? (
                            <span className="badge badge-approved"><CheckCircle size={11} /> Attended</span>
                          ) : isRegistered ? (
                            <span className={`badge ${regStatus === 'approved' ? 'badge-approved' : regStatus === 'rejected' ? 'badge-rejected' : 'badge-pending'}`}>
                              {regStatus === 'approved' ? '✓ Approved' : regStatus === 'rejected' ? 'Rejected' : 'Pending Approval'}
                            </span>
                          ) : (
                            <button className="btn btn-primary btn-sm" onClick={() => registerForProgram(p.id)}>
                              Register
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Attendance ── */}
          {tab === 'attendance' && (
            <div className="animate-fade-up">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => setShowQrModal(true)}>
                  <QrCode size={15} /> Record Attendance
                </button>
              </div>
              <div className="card">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Program</th>
                        <th>Date</th>
                        <th>Hours</th>
                        <th>Scanned At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myAttendance.length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No attendance records yet</td></tr>
                      )}
                      {myAttendance.map(a => {
                        const prog = a.program as { title: string; date: string; volunteer_hours: number };
                        return (
                          <tr key={a.id}>
                            <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{prog?.title}</td>
                            <td>{new Date(prog?.date).toLocaleDateString('en-MY')}</td>
                            <td><span className="badge badge-approved">+{prog?.volunteer_hours}h</span></td>
                            <td>{new Date(a.scanned_at).toLocaleString('en-MY')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Certificates ── */}
          {tab === 'certificates' && (
            <div className="animate-fade-up">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {myCertificates.length === 0 && (
                  <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1/-1', padding: '3rem' }}>
                    No certificates yet. Attend a program to earn one!
                  </div>
                )}
                {myCertificates.map(c => {
                  const prog = c.program as { title: string; date: string; volunteer_hours: number };
                  return (
                    <div
                      key={c.id}
                      className="card"
                      style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', borderTop: '3px solid #B8962E' }}
                      onClick={() => setViewCert(c)}
                    >
                      {/* Mini certificate preview strip */}
                      <div style={{ background: 'linear-gradient(135deg, #0F2448, #1A3566)', borderRadius: 6, padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(184,150,46,0.2)', border: '1.5px solid #B8962E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Award size={20} style={{ color: '#D4AF5A' }} />
                        </div>
                        <div>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#D4AF5A', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                            Certificate of Participation
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                            UTHM Volunteer Programme
                          </div>
                        </div>
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem', fontSize: '0.9rem' }}>
                          {prog?.title}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span><Clock size={11} style={{ display: 'inline', marginRight: 3 }} />{prog?.volunteer_hours}h</span>
                          <span>·</span>
                          <span>{new Date(prog?.date).toLocaleDateString('en-MY')}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '0.25rem 0.6rem', borderRadius: 4 }}>
                          {c.certificate_no}
                        </span>
                        <button
                          className="btn btn-sm"
                          style={{ background: 'rgba(29,78,216,0.08)', color: 'var(--blue-400)', border: '1px solid rgba(29,78,216,0.2)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
                          onClick={e => { e.stopPropagation(); setViewCert(c); }}
                        >
                          <Eye size={12} /> View & Download
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* QR Scan Modal */}
      {showQrModal && (
        <QrScannerModal
          onScan={scanQR}
          onClose={() => setShowQrModal(false)}
          loading={scanning}
        />
      )}

    </DashboardLayout>

    {/* Certificate Modal — outside DashboardLayout to avoid stacking context */}
    {viewCert && (
      <CertificateModal
        studentName={user?.name ?? ''}
        programTitle={(viewCert.program as { title: string; date: string; volunteer_hours: number } | null)?.title ?? 'Volunteer Programme'}
        programDate={(viewCert.program as { title: string; date: string; volunteer_hours: number } | null)?.date ?? viewCert.issued_at}
        volunteerHours={(viewCert.program as { title: string; date: string; volunteer_hours: number } | null)?.volunteer_hours ?? 0}
        certificateNo={viewCert.certificate_no}
        issuedAt={viewCert.issued_at}
        onClose={() => setViewCert(null)}
      />
    )}
    </>
  );
}
