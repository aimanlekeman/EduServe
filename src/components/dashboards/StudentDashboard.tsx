import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DashboardLayout } from '../layout/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { withTimeout } from '../../lib/withTimeout';
import type { Program, Registration, AttendanceRecord, Certificate, RegistrationStatus } from '../../lib/supabase';
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
  Building2,
} from 'lucide-react';

type Tab = 'overview' | 'programs' | 'attendance' | 'certificates';
type ProgramFilter = 'all' | 'available' | 'registered' | 'past';

interface TierDef { name: string; min: number; cap: number | null; color: string; dim: string; border: string; }
// Must match the formula in ProgramDirectorDashboard exactly
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

const TIERS: TierDef[] = [
  { name: 'Bronze', min: 0,  cap: 20,   color: '#CD7F32', dim: 'rgba(205,127,50,0.13)',  border: 'rgba(205,127,50,0.4)'  },
  { name: 'Silver', min: 20, cap: 50,   color: '#8FA3B1', dim: 'rgba(143,163,177,0.13)', border: 'rgba(143,163,177,0.4)' },
  { name: 'Gold',   min: 50, cap: null, color: '#D4AF5A', dim: 'rgba(212,175,90,0.13)',  border: 'rgba(212,175,90,0.4)'  },
];

export function StudentDashboard() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [myAttendance, setMyAttendance] = useState<AttendanceRecord[]>([]);
  const [myCertificates, setMyCertificates] = useState<Certificate[]>([]);
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const programIdsRef = useRef<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [viewCert, setViewCert] = useState<Certificate | null>(null);
  const [programFilter, setProgramFilter] = useState<ProgramFilter>('all');

  // Feedback
  const [feedbackProgram, setFeedbackProgram] = useState<Program | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHover, setFeedbackHover]   = useState(0);
  const [feedbackReview, setFeedbackReview] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [submittedFeedback, setSubmittedFeedback] = useState<Set<string>>(new Set());

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
            .neq('status', 'rejected');
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

  // Keep ref in sync so realtime callbacks always see current program IDs
  useEffect(() => {
    programIdsRef.current = programs.map(p => p.id);
  }, [programs]);

  // Real-time participant count updates for the programs tab
  useEffect(() => {
    const channel = supabase
      .channel('student-reg-counts')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registrations' },
        (payload) => {
          console.log('[Realtime] student INSERT registrations:', payload);
          const row = payload.new as { program_id: string; status: string };
          if (row.status === 'rejected') return;
          if (!programIdsRef.current.includes(row.program_id)) return;
          setRegCounts(prev => ({ ...prev, [row.program_id]: (prev[row.program_id] ?? 0) + 1 }));
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'registrations' },
        (payload) => {
          console.log('[Realtime] student UPDATE registrations:', payload);
          const row = payload.new as { program_id: string; status: string };
          if (!programIdsRef.current.includes(row.program_id)) return;
          if (row.status === 'rejected') {
            setRegCounts(prev => ({ ...prev, [row.program_id]: Math.max((prev[row.program_id] ?? 1) - 1, 0) }));
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] student-reg-counts status:', status);
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Real-time registration status updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`reg-status-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'registrations', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as { id: string; status: RegistrationStatus };
          setMyRegistrations(prev => {
            const reg = prev.find(r => r.id === updated.id);
            if (!reg) return prev;
            const title = (reg.program as { title: string } | undefined)?.title ?? 'a program';
            if (updated.status === 'approved')
              toast.success(`Your registration for "${title}" was approved!`);
            else if (updated.status === 'rejected')
              toast.error(`Your registration for "${title}" was not approved.`);
            return prev.map(r => r.id === updated.id ? { ...r, status: updated.status } : r);
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Load which programs the student has already reviewed
  useEffect(() => {
    if (!user) return;
    supabase.from('feedback').select('program_id').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setSubmittedFeedback(new Set(data.map((f: { program_id: string }) => f.program_id)));
      });
  }, [user?.id]);

  const submitFeedback = async () => {
    if (!feedbackProgram || feedbackRating === 0) {
      toast.error('Please select a star rating before submitting.');
      return;
    }
    setFeedbackSubmitting(true);
    const { error } = await supabase.from('feedback').insert({
      program_id: feedbackProgram.id,
      user_id:    user?.id,
      rating:     feedbackRating,
      review:     feedbackReview.trim() || null,
    });
    setFeedbackSubmitting(false);
    if (error) {
      toast.error('Failed to submit feedback. Please try again.');
    } else {
      toast.success('Thank you for your feedback!');
      setSubmittedFeedback(prev => new Set([...prev, feedbackProgram.id]));
      setFeedbackProgram(null);
      setFeedbackRating(0);
      setFeedbackReview('');
    }
  };

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

    // Dynamic anti-cheat payload — three accepted formats:
    //   Camera:  JSON string { programId, timestamp }
    //   Manual:  6-digit slot-hash code shown under the QR
    //   Legacy:  raw qr_code string (e.g. "QR-XXXXXXXX")
    let qrCode = code;

    // 1. Numeric 6-digit manual code path — checked FIRST because
    //    JSON.parse("123456") succeeds (returns a number) and would
    //    otherwise bypass this branch entirely.
    if (/^\d{6}$/.test(code)) {
      const currentSlot = Math.floor(Date.now() / 15000);
      const { data: allProgs } = await supabase.from('programs').select('qr_code').eq('status', 'approved');
      let matchedBase: string | null = null;
      for (const prog of (allProgs ?? []) as { qr_code: string }[]) {
        const isValid = [currentSlot, currentSlot - 1, 0].some( // 0 = fixed demo code
          s => slotCode(prog.qr_code ?? '', s) === code
        );
        if (isValid) { matchedBase = prog.qr_code; break; }
      }
      if (!matchedBase) {
        toast.error('Invalid or expired code. Ask your Director for the current 6-digit code.');
        setShowQrModal(false);
        setScanning(false);
        return;
      }
      qrCode = matchedBase;
    } else {
      // 2. JSON payload from camera scan
      try {
        const parsed = JSON.parse(code) as { programId: string; timestamp: number };
        if (parsed.programId && parsed.timestamp) {
          if (Date.now() - parsed.timestamp > 30_000) {
            toast.error('QR Code Expired. Please scan the live code on the Director\'s screen.');
            setShowQrModal(false);
            setScanning(false);
            return;
          }
          qrCode = parsed.programId;
        }
      } catch {
        // 3. Plain-text legacy code — use as-is
      }
    }

    const { data: program } = await supabase
      .from('programs')
      .select('*')
      .eq('qr_code', qrCode)
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

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const isProgramPast = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d < todayMidnight;
  };

  const filteredPrograms = programs.filter(p => {
    const past = isProgramPast(p.date);
    const regClosed = p.registration_deadline ? isProgramPast(p.registration_deadline) : past;
    if (programFilter === 'available')  return !regClosed && !registeredProgramIds.has(p.id);
    if (programFilter === 'registered') return registeredProgramIds.has(p.id);
    if (programFilter === 'past')       return past;
    return true; // 'all'
  });

  // ── Tier logic — hours derived from officially attended programs ──
  const hours = myAttendance.reduce((sum, a) => {
    const prog = a.program as { title: string; date: string; volunteer_hours: number } | undefined;
    return sum + (prog?.volunteer_hours ?? 0);
  }, 0);
  const tierIdx   = hours >= 50 ? 2 : hours >= 20 ? 1 : 0;
  const tier      = TIERS[tierIdx];
  const nextTier  = TIERS[tierIdx + 1] ?? null;
  const progressPct = nextTier && tier.cap
    ? Math.min(((hours - tier.min) / (tier.cap - tier.min)) * 100, 100)
    : 100;
  const hoursToNext = nextTier ? nextTier.min - hours : 0;

  // ── Activity heatmap data (last 52 weeks) ────────────────
  const heatmapData = useMemo(() => {
    // Binary: a day is either attended (1) or not (0)
    const counts: Record<string, 1> = {};
    myAttendance.forEach(a => {
      const d = new Date(a.scanned_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      counts[key] = 1;
    });

    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - 52 * 7);
    start.setDate(start.getDate() - start.getDay()); // align to Sunday
    start.setHours(0, 0, 0, 0);

    const toKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    const weeks: { date: string; count: number; isFuture: boolean }[][] = [];
    const monthLabels: (string | null)[] = [];
    const cur = new Date(start);

    for (let w = 0; w < 53; w++) {
      const weekStart = new Date(cur);
      const week: { date: string; count: number; isFuture: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const key = toKey(cur);
        week.push({ date: key, count: counts[key] ?? 0, isFuture: cur > now });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
      const thisMonth = weekStart.getMonth();
      const prevMonth = w > 0 ? new Date(weeks[w - 1][0].date).getMonth() : -1;
      monthLabels.push(thisMonth !== prevMonth ? weekStart.toLocaleString('en', { month: 'short' }) : null);
    }

    const yearStr = String(new Date().getFullYear());
    const totalThisYear = Object.entries(counts)
      .filter(([k]) => k.startsWith(yearStr))
      .reduce((s, [, c]) => s + c, 0);

    return { weeks, monthLabels, totalThisYear };
  }, [myAttendance]);

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

              {/* ── Tier Progress Card ── */}
              <div className="card" style={{ marginBottom: '1.25rem', background: `linear-gradient(135deg, ${tier.dim}, var(--bg-card))`, border: `1px solid ${tier.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>

                  {/* Tier badge icon */}
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: tier.dim, border: `2px solid ${tier.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Award size={28} style={{ color: tier.color }} />
                  </div>

                  {/* Hours + tier name */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: tier.color, marginBottom: 2 }}>
                      {tier.name} Tier
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-primary)', lineHeight: 1 }}>
                      {hours}<span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 3 }}>hrs</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.4rem' }}>
                      {TIERS.map(t => (
                        <span key={t.name} style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 999, fontWeight: 700, letterSpacing: '0.06em', background: hours >= t.min ? t.dim : 'var(--bg-secondary)', color: hours >= t.min ? t.color : 'var(--text-muted)', border: `1px solid ${hours >= t.min ? t.border : 'transparent'}` }}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    {nextTier ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Progress to {nextTier.name}</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: tier.color }}>{Math.round(progressPct)}%</span>
                        </div>
                        <div style={{ height: 10, borderRadius: 999, background: 'var(--bg-secondary)', overflow: 'hidden', position: 'relative' }}>
                          <div style={{ position: 'absolute', inset: 0, width: `${progressPct}%`, borderRadius: 999, background: `linear-gradient(90deg, ${tier.color}70, ${tier.color})`, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                          <strong style={{ color: tier.color }}>{hoursToNext}h</strong> more to reach {nextTier.name} Tier
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '0.5rem 0' }}>
                        <div style={{ height: 10, borderRadius: 999, background: `linear-gradient(90deg, ${tier.color}70, ${tier.color})` }} />
                        <div style={{ fontSize: '0.8rem', color: tier.color, fontWeight: 600, marginTop: 6 }}>
                          Maximum tier reached — outstanding dedication!
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Stats Grid ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Registrations',     value: myRegistrations.length,  icon: BookOpen,    color: 'var(--success)'  },
                  { label: 'Programs Attended',  value: myAttendance.length,     icon: CheckCircle, color: 'var(--warning)'  },
                  { label: 'Certificates',       value: myCertificates.length,   icon: Award,       color: 'var(--pending)'  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div className="stat-card" key={label}>
                    <div className="stat-icon" style={{ background: `${color}18` }}><Icon size={22} style={{ color }} /></div>
                    <div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>
                  </div>
                ))}
              </div>

              {/* ── Scan QR shortcut ── */}
              <div
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', cursor: 'pointer', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.25)', marginBottom: '1.25rem' }}
                onClick={() => setShowQrModal(true)}
              >
                <div className="stat-icon" style={{ background: 'rgba(37,99,235,0.15)', flexShrink: 0 }}>
                  <QrCode size={22} style={{ color: 'var(--blue-400)' }} />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Scan Attendance QR Code</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Enter the QR code from your program coordinator to record attendance</div>
                </div>
              </div>

              {/* ── Activity Heatmap ── */}
              <div className="card" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={16} style={{ color: 'var(--blue-400)' }} />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>Activity Heatmap</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {heatmapData.totalThisYear} program{heatmapData.totalThisYear !== 1 ? 's' : ''} attended this year
                  </span>
                </div>

                <div style={{ overflowX: 'auto', paddingBottom: '0.25rem' }}>
                  {/* Month labels row */}
                  <div style={{ display: 'flex', marginLeft: 28, marginBottom: 3 }}>
                    {heatmapData.weeks.map((_, i) => (
                      <div key={i} style={{ width: 13, flexShrink: 0, fontSize: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {heatmapData.monthLabels[i] ?? ''}
                      </div>
                    ))}
                  </div>

                  {/* Grid */}
                  <div style={{ display: 'flex', gap: 0 }}>
                    {/* Day labels */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: 4, width: 24 }}>
                      {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
                        <div key={i} style={{ height: 11, fontSize: '0.58rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{d}</div>
                      ))}
                    </div>

                    {/* Week columns */}
                    {heatmapData.weeks.map((week, wi) => (
                      <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '2px' }}>
                        {week.map((day, di) => {
                          const bg = day.isFuture ? 'transparent'
                            : day.count === 1 ? '#1D4ED8'
                            : 'rgba(30,64,175,0.07)';
                          return (
                            <div
                              key={di}
                              title={day.count > 0 ? `${day.date}: ${day.count} program${day.count > 1 ? 's' : ''}` : day.date}
                              style={{ width: 11, height: 11, borderRadius: 2, background: bg, cursor: day.count > 0 ? 'default' : 'default', flexShrink: 0 }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '0.625rem', justifyContent: 'flex-end' }}>
                    <div style={{ width: 11, height: 11, borderRadius: 2, background: 'rgba(30,64,175,0.07)' }} />
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>No attendance</span>
                    <div style={{ width: 11, height: 11, borderRadius: 2, background: '#1D4ED8', marginLeft: 6 }} />
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Attended</span>
                  </div>
                </div>
              </div>

              {/* ── Approved Programs list ── */}
              {myRegistrations.filter(r => r.status === 'approved').length > 0 && (
                <div className="card">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>My Approved Programs</h3>
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
                          {attendedProgramIds.has(r.program_id)
                            ? <span className="badge badge-approved"><CheckCircle size={11} /> Attended</span>
                            : <span className="badge badge-blue">Registered</span>
                          }
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
                  <option value="past">Past Programs</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {filteredPrograms.length === 0 && (
                  <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1/-1', padding: '3rem' }}>
                    {programFilter === 'registered'
                      ? "You haven't registered for any programs yet."
                      : programFilter === 'available'
                      ? 'No upcoming programs available to register right now.'
                      : programFilter === 'past'
                      ? 'No past programs found.'
                      : 'No programs available right now.'}
                  </div>
                )}
                {filteredPrograms.map(p => {
                  const isRegistered = registeredProgramIds.has(p.id);
                  const isAttended   = attendedProgramIds.has(p.id);
                  const joined       = regCounts[p.id] || 0;
                  const regStatus    = myRegistrations.find(r => r.program_id === p.id)?.status;
                  const isPast       = isProgramPast(p.date);
                  const isRegClosed  = p.registration_deadline
                    ? isProgramPast(p.registration_deadline)
                    : isPast;

                  return (
                    <div
                      className="program-card"
                      key={p.id}
                      id={`program-card-${p.id}`}
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
                            { icon: Calendar,   text: new Date(p.date).toLocaleDateString('en-MY') },
                            { icon: MapPin,     text: p.location },
                            { icon: Clock,      text: `${p.volunteer_hours} volunteer hours` },
                            ...(p.organizer ? [{ icon: Building2, text: p.organizer }] : []),
                          ].map(({ icon: Icon, text }) => (
                            <div key={text} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Icon size={12} /> {text}
                            </div>
                          ))}
                          {p.registration_deadline && (
                            <div style={{
                              fontSize: '0.75rem',
                              color: isRegClosed ? 'var(--error, #ef4444)' : 'var(--text-muted)',
                              display: 'flex', alignItems: 'center', gap: 4,
                              fontWeight: isRegClosed ? 600 : 400,
                            }}>
                              <Calendar size={11} />
                              {isRegClosed ? 'Registration closed' : `Register by ${new Date(p.registration_deadline).toLocaleDateString('en-MY')}`}
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

                        {/* Action */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {isAttended ? (
                            <>
                              <span className="badge badge-approved"><CheckCircle size={11} /> Attended</span>
                              {submittedFeedback.has(p.id) ? (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>✓ Feedback sent</span>
                              ) : (
                                <button
                                  className="btn btn-sm"
                                  style={{ fontSize: '0.75rem', background: 'rgba(212,175,90,0.1)', color: '#B8962E', border: '1px solid rgba(212,175,90,0.35)', padding: '0.25rem 0.6rem' }}
                                  onClick={() => { setFeedbackProgram(p); setFeedbackRating(0); setFeedbackReview(''); }}
                                >
                                  ★ Leave Feedback
                                </button>
                              )}
                            </>
                          ) : isRegistered ? (
                            <span className={`badge ${regStatus === 'approved' ? 'badge-approved' : regStatus === 'rejected' ? 'badge-rejected' : 'badge-pending'}`}>
                              {regStatus === 'approved' ? '✓ Approved' : regStatus === 'rejected' ? 'Rejected' : 'Pending Approval'}
                            </span>
                          ) : isRegClosed ? (
                            <button className="btn btn-sm" disabled style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'not-allowed', opacity: 0.7 }}>
                              {isPast ? 'Closed' : 'Expired'}
                            </button>
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
                            EduServe
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

      {/* Feedback Modal */}
      {feedbackProgram && (
        <div className="modal-overlay" onClick={() => setFeedbackProgram(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Leave Feedback
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              {feedbackProgram.title}
            </p>

            {/* Star rating */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                Your Rating *
              </label>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <span
                    key={star}
                    onClick={() => setFeedbackRating(star)}
                    onMouseEnter={() => setFeedbackHover(star)}
                    onMouseLeave={() => setFeedbackHover(0)}
                    style={{
                      fontSize: '2rem', cursor: 'pointer', lineHeight: 1,
                      color: star <= (feedbackHover || feedbackRating) ? '#D4AF5A' : 'var(--border)',
                      transition: 'color 0.1s',
                    }}
                  >★</span>
                ))}
              </div>
            </div>

            {/* Review text */}
            <div className="form-group" style={{ margin: '0 0 1.25rem' }}>
              <label className="label">Comment (optional)</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Share your experience with this program..."
                value={feedbackReview}
                onChange={e => setFeedbackReview(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={feedbackSubmitting || feedbackRating === 0}
                onClick={submitFeedback}
              >
                {feedbackSubmitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : 'Submit Feedback'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setFeedbackProgram(null)}>Cancel</button>
            </div>
          </div>
        </div>
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
