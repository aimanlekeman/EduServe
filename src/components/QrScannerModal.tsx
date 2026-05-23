import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, QrCode, Keyboard, Camera, Loader2, VideoOff, RefreshCw } from 'lucide-react';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
  loading?: boolean;
}

type Mode = 'camera' | 'manual';
type CamState = 'starting' | 'ready' | 'error';
type FacingMode = 'environment' | 'user';

export function QrScannerModal({ onScan, onClose, loading = false }: Props) {
  const [mode, setMode] = useState<Mode>('camera');
  const [camState, setCamState] = useState<CamState>('starting');
  const [camError, setCamError] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [cameraKey, setCameraKey] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const scannedRef = useRef(false);
  const activeRef = useRef(false);

  useEffect(() => {
    if (mode !== 'camera') return;

    activeRef.current = true;
    scannedRef.current = false;
    setCamState('starting');
    setCamError('');

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (!activeRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        setCamState('ready');
        tick();
      } catch (err) {
        if (!activeRef.current) return;
        const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
        if (/denied|permission|notallowed/.test(msg)) {
          setCamError('Camera permission denied. Allow camera access in your browser settings and try again.');
        } else if (/notfound|devicenotfound/.test(msg)) {
          setCamError('No camera detected on this device.');
        } else {
          setCamError('Could not start camera. Try entering the code manually.');
        }
        setCamState('error');
      }
    }

    function tick() {
      rafRef.current = requestAnimationFrame(() => {
        if (!activeRef.current || scannedRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
          tick();
          return;
        }

        const { videoWidth: w, videoHeight: h } = video;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(video, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);

        const result = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
        if (result && result.data) {
          scannedRef.current = true;
          onScan(result.data);
          return;
        }

        tick();
      });
    }

    start();

    return () => {
      activeRef.current = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [mode, cameraKey]);

  const stopCamera = () => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const handleClose = () => { stopCamera(); onClose(); };
  const switchToManual = () => { stopCamera(); setMode('manual'); };

  const flipCamera = () => {
    stopCamera();
    setFacingMode(f => f === 'environment' ? 'user' : 'environment');
    setCameraKey(k => k + 1);
  };

  const retryCamera = () => {
    setCameraKey(k => k + 1);
  };

  return (
    <div className="qr-modal-overlay" onClick={handleClose}>
      <div className="qr-modal-box" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <QrCode size={18} style={{ color: 'var(--blue-400)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>
              Record Attendance
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ padding: '0.375rem', borderRadius: '50%', minWidth: 40, minHeight: 40 }} onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.875rem 1.25rem 0' }}>
          {([['camera', Camera, 'Scan QR'], ['manual', Keyboard, 'Enter Code']] as const).map(([m, Icon, label]) => (
            <button
              key={m}
              onClick={() => m === 'manual' ? switchToManual() : setMode('camera')}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                padding: '0.625rem', borderRadius: 'var(--radius-md)', minHeight: 48,
                border: `1.5px solid ${mode === m ? 'var(--blue-400)' : 'var(--border)'}`,
                background: mode === m ? 'rgba(37,99,235,0.1)' : 'transparent',
                color: mode === m ? 'var(--blue-400)' : 'var(--text-muted)',
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.875rem',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Camera view */}
        {mode === 'camera' && (
          <div style={{ padding: '0.875rem 1.25rem 1.25rem' }}>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#000', aspectRatio: '1/1', width: '100%' }}>
              <video
                ref={videoRef}
                muted
                playsInline
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover',
                  opacity: camState === 'ready' ? 1 : 0,
                }}
              />

              {/* Scan guide box */}
              {camState === 'ready' && !loading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{
                    width: '65%', aspectRatio: '1/1',
                    border: '2.5px solid rgba(255,255,255,0.85)',
                    borderRadius: 14,
                    boxShadow: '0 0 0 2000px rgba(0,0,0,0.42)',
                  }} />
                </div>
              )}

              {/* Camera flip button */}
              {camState === 'ready' && !loading && (
                <button
                  onClick={flipCamera}
                  title="Flip camera"
                  style={{
                    position: 'absolute', bottom: '0.75rem', right: '0.75rem',
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)', border: '1.5px solid rgba(255,255,255,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', cursor: 'pointer', backdropFilter: 'blur(4px)',
                  }}
                >
                  <RefreshCw size={18} />
                </button>
              )}

              {/* Starting */}
              {camState === 'starting' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '0.75rem' }}>
                  <Loader2 size={32} className="animate-spin" />
                  <span style={{ fontSize: '0.875rem' }}>Starting camera…</span>
                </div>
              )}

              {/* Error */}
              {camState === 'error' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.88)', color: '#fff', gap: '0.875rem', padding: '1.5rem', textAlign: 'center' }}>
                  <VideoOff size={32} style={{ opacity: 0.5 }} />
                  <p style={{ fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>{camError}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button className="btn btn-ghost btn-sm" style={{ minHeight: 44, color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }} onClick={retryCamera}>
                      <RefreshCw size={14} /> Retry
                    </button>
                    <button className="btn btn-primary btn-sm" style={{ minHeight: 44 }} onClick={switchToManual}>
                      <Keyboard size={14} /> Enter Code Manually
                    </button>
                  </div>
                </div>
              )}

              {/* Processing after scan */}
              {loading && camState === 'ready' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', color: '#fff', gap: '0.75rem' }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: '#60a5fa' }} />
                  <span style={{ fontSize: '0.875rem' }}>Recording attendance…</span>
                </div>
              )}
            </div>

            {camState === 'ready' && !loading && (
              <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
                Point your camera at the QR code shown by your Program Director
              </p>
            )}
          </div>
        )}

        {/* Manual entry */}
        {mode === 'manual' && (
          <div style={{ padding: '0.875rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              Enter the QR code shown by your Program Director.
            </p>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">QR Code</label>
              <input
                className="input-field"
                placeholder="e.g. 742831"
                value={manualInput}
                onChange={e => setManualInput(e.target.value.trim())}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && !loading) onScan(manualInput.trim()); }}
                style={{ fontFamily: 'monospace', letterSpacing: '0.08em', minHeight: 48 }}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', minHeight: 52 }}
              onClick={() => onScan(manualInput.trim())}
              disabled={loading || !manualInput.trim()}
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Checking…</>
                : <><QrCode size={16} /> Record Attendance</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
