import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { X, Download, Loader2 } from 'lucide-react';
import itcLogo from '/assets/itc-logo.webp';

interface Props {
  studentName: string;
  programTitle: string;
  programDate: string;
  volunteerHours: number;
  certificateNo: string;
  issuedAt: string;
  onClose: () => void;
}

// ── Palette ───────────────────────────────────────────────────────────────
const NAVY    = '#0C1F45';
const BLUE    = '#1A56DB';
const SILVER  = '#A8B4C0';
const SILVER2 = '#D0D7E0';
const GOLD    = '#B8962E';
const GOLD2   = '#D4AF5A';
const WHITE   = '#FFFFFF';

// ── Corner ornament (silver/blue theme) ──────────────────────────────────
function Corner({ rotate = 0 }: { rotate?: number }) {
  return (
    <svg
      width="52" height="52" viewBox="0 0 52 52" fill="none"
      style={{ position: 'absolute', transform: `rotate(${rotate}deg)` }}
    >
      <path d="M4 4 L22 4 L22 6 L6 6 L6 22 L4 22 Z" fill={SILVER} />
      <path d="M4 4 L4 22 L6 22 L6 8 L20 8 L20 6 L6 6 L6 4 Z" fill={SILVER2} opacity="0.7" />
      <circle cx="8" cy="8" r="2.5" fill={SILVER} />
      <circle cx="8" cy="8" r="1.1" fill={WHITE} />
    </svg>
  );
}

// ── Seal SVG (blue + silver + gold accent) ───────────────────────────────
function Seal({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="38" stroke={SILVER} strokeWidth="2" fill="none" />
      <circle cx="40" cy="40" r="33" stroke={SILVER2} strokeWidth="0.75" fill="none" />
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i * 360) / 16;
        const r1 = 34, r2 = 38;
        const x1 = 40 + r1 * Math.cos((a * Math.PI) / 180);
        const y1 = 40 + r1 * Math.sin((a * Math.PI) / 180);
        const x2 = 40 + r2 * Math.cos((a * Math.PI) / 180);
        const y2 = 40 + r2 * Math.sin((a * Math.PI) / 180);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={SILVER} strokeWidth="1" />;
      })}
      <circle cx="40" cy="40" r="30" fill={NAVY} />
      <polygon
        points="40,14 43.5,26 56,26 46,34 49.5,46 40,38.5 30.5,46 34,34 24,26 36.5,26"
        fill={GOLD}
      />
      <circle cx="40" cy="38" r="3" fill={WHITE} />
    </svg>
  );
}

// ── Divider (silver + gold diamond) ─────────────────────────────────────
function Divider({ width = '70%', color = SILVER }: { width?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width, margin: '0 auto' }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${color})` }} />
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div style={{ width: 4, height: 4, transform: 'rotate(45deg)', background: GOLD2, flexShrink: 0 }} />
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${color})` }} />
    </div>
  );
}

// ── Certificate body ───────────────────────────────────────────────────────
function CertificateBody({ studentName, programTitle, programDate, volunteerHours, certificateNo, issuedAt }: Omit<Props, 'onClose'>) {
  const formattedProgDate = new Date(programDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });
  const formattedIssued   = new Date(issuedAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{
      width: '100%',
      aspectRatio: '1 / 1.414',
      background: WHITE,
      position: 'relative',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Outer navy border */}
      <div style={{ position: 'absolute', inset: 12, border: `3px solid ${NAVY}`, borderRadius: 4, pointerEvents: 'none', zIndex: 1 }} />
      {/* Inner silver border */}
      <div style={{ position: 'absolute', inset: 18, border: `1.5px solid ${SILVER2}`, borderRadius: 2, pointerEvents: 'none', zIndex: 1 }} />

      {/* Corner ornaments */}
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}><Corner rotate={0} /></div>
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}><Corner rotate={90} /></div>
      <div style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 2 }}><Corner rotate={180} /></div>
      <div style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 2 }}><Corner rotate={270} /></div>

      {/* ── Header strip ── */}
      <div style={{
        background: `linear-gradient(135deg, ${NAVY} 0%, #142966 100%)`,
        margin: '22px 22px 0',
        padding: 'clamp(16px, 3vh, 24px) clamp(16px, 3vw, 24px)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        borderRadius: '2px 2px 0 0',
        borderBottom: `2px solid ${GOLD}`,
      }}>
        {/* Left — UTHM logo */}
        <img
          src="/assets/uthm-logo.png"
          alt="UTHM"
          style={{ height: 'clamp(64px, 10vh, 90px)', width: 'auto', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />

        {/* Centre — institution & programme text */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            fontFamily: "'Cinzel', serif",
            fontWeight: 700,
            fontSize: 'clamp(0.55rem, 1.5vw, 0.78rem)',
            color: WHITE,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            textAlign: 'center',
            lineHeight: 1.3,
          }}>
            Universiti Tun Hussein Onn Malaysia
          </div>
          <div style={{ display: 'flex', gap: 4, margin: '2px 0' }}>
            <div style={{ width: 24, height: 1.5, background: GOLD, borderRadius: 2 }} />
            <div style={{ width: 12, height: 1.5, background: SILVER, borderRadius: 2 }} />
            <div style={{ width: 6, height: 1.5, background: BLUE, borderRadius: 2 }} />
            <div style={{ width: 12, height: 1.5, background: SILVER, borderRadius: 2 }} />
            <div style={{ width: 24, height: 1.5, background: GOLD, borderRadius: 2 }} />
          </div>
          <div style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 'clamp(0.42rem, 1vw, 0.58rem)',
            color: GOLD2,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}>
            EduServe · Volunteer Programme
          </div>
        </div>

        {/* Right — ITC / EduServe logo */}
        <img
          src={itcLogo}
          alt="EduServe"
          style={{ height: 'clamp(44px, 7vh, 64px)', width: 'auto', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
        />
      </div>

      {/* ── Body ── */}
      <div style={{
        flex: 1,
        margin: '0 22px',
        background: WHITE,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'clamp(6px, 1.4vh, 11px)',
        padding: 'clamp(10px, 2.5vh, 22px) clamp(16px, 4vw, 48px)',
        borderLeft: `1.5px solid ${SILVER2}`,
        borderRight: `1.5px solid ${SILVER2}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle blue watermark circle */}
        <div style={{
          position: 'absolute',
          width: '55%',
          aspectRatio: '1/1',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${BLUE}08 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Title */}
        <div style={{
          fontFamily: "'Cinzel', serif",
          fontWeight: 700,
          fontSize: 'clamp(0.85rem, 2.6vw, 1.45rem)',
          color: NAVY,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          textAlign: 'center',
          position: 'relative',
        }}>
          Certificate of Participation
        </div>

        <Divider width="58%" color={SILVER} />

        {/* Certify text */}
        <div style={{
          fontStyle: 'italic',
          fontSize: 'clamp(0.6rem, 1.3vw, 0.78rem)',
          color: '#6B7280',
          textAlign: 'center',
          letterSpacing: '0.04em',
        }}>
          This is to certify that
        </div>

        {/* Student name */}
        <div style={{
          fontFamily: "'Great Vibes', cursive",
          fontSize: 'clamp(1.8rem, 5vw, 3rem)',
          color: NAVY,
          textAlign: 'center',
          lineHeight: 1.1,
          padding: '2px 0',
        }}>
          {studentName}
        </div>

        {/* Body text */}
        <div style={{
          fontSize: 'clamp(0.58rem, 1.2vw, 0.75rem)',
          color: '#374151',
          textAlign: 'center',
          lineHeight: 1.6,
          maxWidth: '75%',
        }}>
          has successfully participated in the following volunteer programme
        </div>

        {/* Program name box — blue left-accent style */}
        <div style={{
          borderTop: `1px solid ${SILVER2}`,
          borderBottom: `1px solid ${SILVER2}`,
          borderLeft: `4px solid ${BLUE}`,
          borderRight: `1px solid ${SILVER2}`,
          borderRadius: 4,
          padding: 'clamp(6px, 1.2vh, 10px) clamp(16px, 4vw, 36px)',
          background: `linear-gradient(90deg, ${BLUE}0A, transparent)`,
          textAlign: 'center',
          width: '75%',
        }}>
          <div style={{
            fontFamily: "'Cinzel', serif",
            fontWeight: 600,
            fontSize: 'clamp(0.65rem, 1.7vw, 0.95rem)',
            color: NAVY,
            letterSpacing: '0.06em',
          }}>
            {programTitle}
          </div>
        </div>

        {/* Hours & date */}
        <div style={{
          fontSize: 'clamp(0.58rem, 1.1vw, 0.7rem)',
          color: '#4B5563',
          textAlign: 'center',
        }}>
          contributing{' '}
          <strong style={{ color: BLUE, fontWeight: 700 }}>{volunteerHours} volunteer {volunteerHours === 1 ? 'hour' : 'hours'}</strong>
          {' '}to the community on <strong style={{ color: NAVY }}>{formattedProgDate}</strong>
        </div>

        <Divider width="45%" color={SILVER} />
      </div>

      {/* ── Footer strip ── */}
      <div style={{
        background: `linear-gradient(135deg, ${NAVY} 0%, #142966 100%)`,
        margin: '0 22px 22px',
        padding: 'clamp(8px, 1.5vh, 12px) clamp(16px, 3vw, 28px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: '0 0 2px 2px',
        borderTop: `2px solid ${GOLD}`,
        gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 'clamp(0.36rem, 0.8vw, 0.5rem)', color: SILVER, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Certificate No.
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 'clamp(0.5rem, 1vw, 0.65rem)', color: SILVER2, letterSpacing: '0.08em', marginTop: 2 }}>
            {certificateNo}
          </div>
        </div>

        {/* Centre seal */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <Seal size={38} />
          <div style={{ fontSize: 'clamp(0.3rem, 0.65vw, 0.4rem)', color: SILVER, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Official Seal
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'clamp(0.36rem, 0.8vw, 0.5rem)', color: SILVER, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Date of Issue
          </div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(0.5rem, 1vw, 0.65rem)', color: GOLD2, marginTop: 2 }}>
            {formattedIssued}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal shell ────────────────────────────────────────────────────────────
export function CertificateModal(props: Props) {
  const { onClose } = props;
  const certRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!certRef.current) return;
    setDownloading(true);
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(certRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: WHITE,
        logging: false,
        onclone: (doc) => {
          const el = doc.querySelector('[data-cert]') as HTMLElement | null;
          if (el) el.style.fontFamily = "'DM Sans', sans-serif";
        },
      });
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      pdf.save(`${props.certificateNo}.pdf`);
    } catch (e) {
      console.error('Certificate download failed', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 'clamp(12px, 3vw, 24px)',
        overflowY: 'auto',
        gap: 16,
      }}
      onClick={onClose}
    >
      {/* Top action bar */}
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: '#fff', fontSize: '1rem' }}>
            Certificate of Participation
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
            {props.certificateNo}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={download}
            disabled={downloading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.5rem 1.1rem',
              borderRadius: 8,
              border: `1.5px solid ${GOLD2}`,
              background: 'transparent',
              color: GOLD2,
              fontFamily: "'Sora', sans-serif",
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: downloading ? 'not-allowed' : 'pointer',
              opacity: downloading ? 0.7 : 1,
              transition: 'all 0.15s',
            }}
          >
            {downloading
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
              : <><Download size={14} /> Download PDF</>
            }
          </button>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 8,
              border: '1.5px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Certificate preview */}
      <div
        ref={certRef}
        data-cert="true"
        style={{ width: '100%', maxWidth: 600, flexShrink: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <CertificateBody {...props} />
      </div>

      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', paddingBottom: 8 }}>
        Click anywhere outside to close
      </div>
    </div>
  );
}
