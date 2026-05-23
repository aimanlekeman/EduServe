import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Achievement, Program } from '../lib/supabase';
import {
  Trophy,
  Users,
  Star,
  Clock,
  Calendar,
  MapPin,
  ChevronRight,
  Award,
  Activity,
  Menu,
  X,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import itcLogo from '/assets/itc-logo.webp';

interface HomePageProps {
  onLogin: () => void;
  onRegister: () => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  trophy: Trophy,
  users: Users,
  star: Star,
  clock: Clock,
  award: Award,
};

export function HomePage({ onLogin, onRegister }: HomePageProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ students: 0, programs: 0, hours: 0 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Ref so realtime callbacks always see the latest program IDs without stale closure
  const programIdsRef = useRef<string[]>([]);
  useEffect(() => {
    programIdsRef.current = upcomingPrograms.map(p => p.id);
  }, [upcomingPrograms]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('homepage-reg-counts')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registrations' },
        (payload) => {
          console.log('[Realtime] INSERT registrations:', payload);
          const row = payload.new as { program_id: string; status: string };
          if (row.status === 'rejected') return;
          if (!programIdsRef.current.includes(row.program_id)) return;
          setRegCounts(prev => ({
            ...prev,
            [row.program_id]: (prev[row.program_id] ?? 0) + 1,
          }));
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'registrations' },
        (payload) => {
          console.log('[Realtime] UPDATE registrations:', payload);
          const row = payload.new as { program_id: string; status: string };
          if (!programIdsRef.current.includes(row.program_id)) return;
          if (row.status === 'rejected') {
            setRegCounts(prev => ({
              ...prev,
              [row.program_id]: Math.max((prev[row.program_id] ?? 1) - 1, 0),
            }));
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] homepage-reg-counts status:', status);
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const refreshCounts = async (programIds: string[]) => {
    if (programIds.length === 0) return;
    const { data } = await supabase
      .from('registrations')
      .select('program_id')
      .in('program_id', programIds)
      .neq('status', 'rejected');
    if (data) {
      const counts: Record<string, number> = {};
      for (const row of data as { program_id: string }[]) {
        counts[row.program_id] = (counts[row.program_id] ?? 0) + 1;
      }
      setRegCounts(counts);
    }
  };

  const loadData = async () => {
    try {
      // Achievements
      const { data: achData } = await supabase
        .from('achievements')
        .select('*')
        .order('date', { ascending: false })
        .limit(4);
      if (achData) setAchievements(achData as Achievement[]);

      // Upcoming approved programs
      const today = new Date().toISOString().split('T')[0];
      const { data: progData } = await supabase
        .from('programs')
        .select('*')
        .eq('status', 'approved')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(4);
      if (progData) {
        setUpcomingPrograms(progData as Program[]);
        if (progData.length > 0) {
          await refreshCounts(progData.map(p => p.id));
        }
      }

      // Stats
      const [{ count: studentCount }, { count: programCount }, { data: hoursData }] =
        await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('programs').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
          supabase.from('profiles').select('volunteer_hours'),
        ]);
      const totalHours = (hoursData || []).reduce(
        (sum: number, p: { volunteer_hours: number }) => sum + (p.volunteer_hours || 0),
        0
      );
      setStats({
        students: studentCount || 0,
        programs: programCount || 0,
        hours: totalHours,
      });
    } catch (err) {
      console.error('Failed to load homepage data:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      day: d.toLocaleDateString('en-MY', { day: 'numeric' }),
      month: d.toLocaleDateString('en-MY', { month: 'short' }),
      full: d.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' }),
    };
  };

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      {/* ── Navigation ── */}
      <nav className="home-nav" style={{ justifyContent: 'space-between' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img
            src={itcLogo}
            alt="EduServe"
            style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }}
          />
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '0.9375rem',
                color: '#ffffff',
                lineHeight: 1,
              }}
            >
              EduServe
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(191, 219, 254, 0.8)' }}>
              Program Management
            </div>
          </div>
        </div>

        {/* Desktop nav links */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          className="hidden md:flex"
        >
          <a href="#achievements" className="btn btn-ghost btn-sm">Achievements</a>
          <a href="#events" className="btn btn-ghost btn-sm">Events</a>
          <button className="btn btn-outline btn-sm" onClick={onLogin}>Log In</button>
          <button className="btn btn-primary btn-sm" onClick={onRegister}>
            Register
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          className="btn btn-ghost btn-sm md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: 68,
            left: 0,
            right: 0,
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            padding: '1rem',
            zIndex: 49,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <button className="btn btn-outline" onClick={onLogin}>Log In</button>
          <button className="btn btn-primary" onClick={onRegister}>Register</button>
        </div>
      )}

      {/* ── Hero ── */}
      <section className="hero-section">
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 720, padding: '2rem' }}>
          <div
            className="badge badge-blue"
            style={{ marginBottom: '1.5rem', fontSize: '0.75rem' }}
          >
            <Activity size={12} />
            Universiti Tun Hussein Onn Malaysia
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '1.25rem',
              letterSpacing: '-0.03em',
            }}
          >
            Volunteer Program{' '}
            <span style={{ color: 'var(--blue-400)' }}>Management</span>{' '}
            System
          </h1>
          <p
            style={{
              fontSize: '1.0625rem',
              color: 'var(--text-secondary)',
              maxWidth: 560,
              margin: '0 auto 2rem',
              lineHeight: 1.75,
            }}
          >
            Track volunteer hours, manage programs, and celebrate achievements —
            all in one place for the UTHM community.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={onRegister}>
              Get Started <ChevronRight size={18} />
            </button>
            <button className="btn btn-outline btn-lg" onClick={onLogin}>
              Sign In
            </button>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: '2rem',
              justifyContent: 'center',
              marginTop: '3rem',
              flexWrap: 'wrap',
            }}
          >
            {[
              { value: stats.students, label: 'Students' },
              { value: stats.programs, label: 'Programs' },
              { value: stats.hours, label: 'Volunteer Hours' },
            ].map(({ value, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.875rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                  }}
                >
                  {value.toLocaleString()}+
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Achievements ── */}
      <section id="achievements" style={{ padding: '5rem 2rem', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div className="section-label">
            <Trophy size={12} />
            Our Achievements
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            Milestones & Recognition
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', maxWidth: 480 }}>
            Celebrating the impact of UTHM's volunteer community.
          </p>

          {achievements.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
              }}
            >
              No achievements yet. Admins can add them from the dashboard.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: '1.75rem',
              }}
            >
              {achievements.map((a) => {
                const IconComp = ICON_MAP[a.icon] || Trophy;
                return (
                  <div className="achievement-card" key={a.id} style={{ padding: 0, overflow: 'hidden' }}>
                    {a.image_url ? (
                      <img
                        src={a.image_url}
                        alt={a.title}
                        style={{
                          width: '100%',
                          height: 'auto',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: 'rgba(37,99,235,0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '1.25rem 1.25rem 0',
                        }}
                      >
                        <IconComp size={22} style={{ color: 'var(--blue-400)' }} />
                      </div>
                    )}
                    <div style={{ padding: '1.25rem' }}>
                      <h3
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '1rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: '0.5rem',
                        }}
                      >
                        {a.title}
                      </h3>
                      <p
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.6,
                          marginBottom: '1rem',
                        }}
                      >
                        {a.description}
                      </p>
                      {a.date && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Calendar size={11} />
                          {formatDate(a.date).full}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Upcoming Events ── */}
      <section id="events" style={{ padding: '5rem 2rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="section-label">
            <Calendar size={12} />
            Upcoming Events
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            Open Programs
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', maxWidth: 480 }}>
            Upcoming volunteer programs you can join. Register to participate.
          </p>

          {upcomingPrograms.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
              }}
            >
              No upcoming programs right now. Check back soon!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '1.25rem' }}>
              {upcomingPrograms.map((p) => {
                const { day, month } = formatDate(p.date);
                const joined = regCounts[p.id] || 0;
                return (
                  <div
                    className="event-card"
                    key={p.id}
                    style={{ flexDirection: 'column', padding: 0, gap: 0, overflow: 'hidden' }}
                  >
                    {/* Banner */}
                    <div className="program-banner">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.title}
                          onError={e => {
                            const el = e.currentTarget as HTMLImageElement;
                            el.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="program-banner-placeholder" />
                      )}
                      {/* Date badge */}
                      <div className="program-date-badge">
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.125rem', color: '#fff', lineHeight: 1 }}>{day}</div>
                        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{month}</div>
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        {p.title}
                      </h3>
                      {p.description && (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {p.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.875rem', fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} /> {p.location}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} /> {p.volunteer_hours}h</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Users size={11} />
                          {p.max_participants ? `${joined} / ${p.max_participants} joined` : `${joined} joined · open`}
                        </span>
                        {p.organizer && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Building2 size={11} /> {p.organizer}
                          </span>
                        )}
                        {p.registration_deadline && (() => {
                          const deadlineStr = p.registration_deadline;
                          const today = new Date(); today.setHours(0,0,0,0);
                          const dl = new Date(deadlineStr); dl.setHours(0,0,0,0);
                          const closed = dl < today;
                          return (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: closed ? '#ef4444' : 'var(--text-muted)', fontWeight: closed ? 600 : 400 }}>
                              <Calendar size={11} />
                              {closed ? 'Registration closed' : `Register by ${dl.toLocaleDateString('en-MY')}`}
                            </span>
                          );
                        })()}
                      </div>
                      <div style={{ marginTop: 'auto', paddingTop: '0.625rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline btn-sm" onClick={onRegister}>Join</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {upcomingPrograms.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button className="btn btn-outline" onClick={onRegister}>
                Register to See All Programs <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border)',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.75rem' }}>
          <img src={itcLogo} alt="EduServe" style={{ width: 18, height: 18, objectFit: 'contain' }} />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
            }}
          >
            EduServe Program Management
          </span>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} Universiti Tun Hussein Onn Malaysia. Final Year Project.
        </p>
      </footer>
    </div>
  );
}
