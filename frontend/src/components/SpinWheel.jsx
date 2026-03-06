import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Gem, Trophy, Flame, Heart, Crown, Zap, CircleDot, Circle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const PRIZE_ICONS = {
  star: Circle, sparkles: CircleDot, gem: Gem, trophy: Trophy,
  fire: Flame, heart: Heart, hearts: Heart, crown: Crown, zap: Zap,
};

/* ─── Mini wheel (FAB) drawn via tiny canvas ─── */
const MiniWheelCanvas = ({ prizes, spin }) => {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    const s = 48, cx = s/2, cy = s/2, r = s/2 - 2;
    c.width = s; c.height = s;
    const cols = prizes.length
      ? prizes.map(p => p.color)
      : ['#3b82f6','#8b5cf6','#06b6d4','#fbbf24','#ef4444','#10b981','#ec4899','#14b8a6','#a855f7'];
    const slice = (2*Math.PI)/cols.length;
    cols.forEach((clr,i) => {
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,r,i*slice,(i+1)*slice); ctx.closePath();
      ctx.fillStyle = clr; ctx.fill();
    });
    ctx.beginPath(); ctx.arc(cx,cy,6,0,2*Math.PI);
    ctx.fillStyle = '#0f172a'; ctx.fill();
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5; ctx.stroke();
  }, [prizes]);
  return (
    <canvas ref={ref} width={48} height={48}
      className="rounded-full"
      style={{ animation: spin ? 'fabSpin 1.2s linear infinite' : 'none' }} />
  );
};

const SpinWheel = ({ playerAddress, onPrizeWon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [canSpin, setCanSpin] = useState(false);
  const [hoursRemaining, setHoursRemaining] = useState(0);
  const [prizes, setPrizes] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [pulseReady, setPulseReady] = useState(false);
  const wheelRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    if (!playerAddress) return;
    try {
      const res = await fetch(`${API_URL}/api/spin-wheel/status/${playerAddress}`);
      if (res.ok) {
        const d = await res.json();
        setCanSpin(d.can_spin); setHoursRemaining(d.hours_remaining);
        setPrizes(d.prizes || []); setPulseReady(d.can_spin);
      }
    } catch (e) { /* silent */ }
  }, [playerAddress]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  /* ─── Draw main wheel ─── */
  useEffect(() => {
    if (!isOpen || !wheelRef.current || !prizes.length) return;
    const c = wheelRef.current, ctx = c.getContext('2d');
    const size = 340; c.width = size; c.height = size;
    const cx = size/2, cy = size/2, r = size/2 - 12;
    const n = prizes.length, slice = (2*Math.PI)/n;

    /* outer ring glow */
    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cy,r+8,0,2*Math.PI);
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
    ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 18;
    ctx.stroke(); ctx.restore();

    prizes.forEach((p,i) => {
      const a0 = i*slice, a1 = a0+slice;
      /* 3D-ish: darker edge on each slice */
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,r,a0,a1); ctx.closePath();
      const g = ctx.createRadialGradient(cx,cy,r*0.15,cx,cy,r);
      g.addColorStop(0, lighten(p.color, 30));
      g.addColorStop(0.65, p.color);
      g.addColorStop(1, darken(p.color, 35));
      ctx.fillStyle = g; ctx.fill();

      /* thin separator */
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.2; ctx.stroke();

      /* peg dots on rim */
      const pegAngle = a0;
      const px = cx + (r-1)*Math.cos(pegAngle), py = cy + (r-1)*Math.sin(pegAngle);
      ctx.beginPath(); ctx.arc(px,py,3.5,0,2*Math.PI);
      ctx.fillStyle = '#e2e8f0'; ctx.fill();

      /* label */
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(a0+slice/2);
      ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
      ctx.font = '700 11.5px "Inter",system-ui,sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4;
      const lbl = p.label.length > 13 ? p.label.slice(0,12)+'..' : p.label;
      ctx.fillText(lbl, r-22, 4.5); ctx.restore();
    });

    /* center hub — 3D raised look */
    const hubG = ctx.createRadialGradient(cx-4,cy-4,4,cx,cy,32);
    hubG.addColorStop(0, '#1e3a5f'); hubG.addColorStop(0.7, '#0f172a'); hubG.addColorStop(1, '#060b14');
    ctx.beginPath(); ctx.arc(cx,cy,30,0,2*Math.PI);
    ctx.fillStyle = hubG; ctx.fill();
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5;
    ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 12; ctx.stroke();
    ctx.shadowBlur = 0;
    /* hub text */
    ctx.fillStyle = '#38bdf8'; ctx.font = '800 15px "Inter",system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SPIN', cx, cy);
  }, [prizes, isOpen]);

  /* ─── Spin handler ─── */
  const handleSpin = async () => {
    if (spinning || !canSpin) return;
    setSpinning(true); setWonPrize(null); setShowConfetti(false);
    try {
      const res = await fetch(`${API_URL}/api/spin-wheel/spin`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ player_address: playerAddress })
      });
      if (!res.ok) { setSpinning(false); return; }
      const data = await res.json();
      const idx = data.prize_index, sa = 360/prizes.length;
      const target = idx*sa + sa/2;
      const spins = (6 + Math.random()*3) * 360;
      const final = spins + (360 - target + 270) % 360;
      setRotation(prev => prev + final);
      setTimeout(() => {
        setWonPrize(data); setShowConfetti(true);
        setSpinning(false); setCanSpin(false);
        setPulseReady(false); setHoursRemaining(24);
        if (onPrizeWon) onPrizeWon(data);
      }, 4500);
    } catch { setSpinning(false); }
  };

  const Icon = wonPrize ? (PRIZE_ICONS[wonPrize.prize?.emoji] || Circle) : Circle;

  return (
    <>
      {/* ── Floating Mini Wheel Button ── */}
      <button
        onClick={() => { setIsOpen(true); setWonPrize(null); setShowConfetti(false); }}
        className={`fixed bottom-24 right-4 z-40 rounded-full transition-all duration-300 hover:scale-110 ${
          pulseReady ? 'shadow-[0_0_20px_rgba(56,189,248,0.5)]' : 'shadow-xl shadow-slate-900/60'
        }`}
        style={{ width: 56, height: 56, padding: 4, background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)', border: pulseReady ? '2px solid #38bdf8' : '2px solid #334155' }}
        data-testid="spin-wheel-fab"
        title={canSpin ? 'Free spin available!' : `Next spin in ${Math.ceil(hoursRemaining)}h`}
      >
        <MiniWheelCanvas prizes={prizes} spin={pulseReady} />
        {pulseReady && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-400 rounded-full text-[10px] font-black text-slate-900 flex items-center justify-center shadow-lg shadow-cyan-400/50 animate-bounce">
            1
          </span>
        )}
      </button>

      {/* ── Modal ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="spin-wheel-modal">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => !spinning && setIsOpen(false)} />

          <div className="relative w-full max-w-[420px] rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: 'linear-gradient(180deg,#0c1222 0%,#111b33 40%,#0c1222 100%)', border: '1.5px solid rgba(56,189,248,0.2)' }}>

            {/* confetti */}
            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                {[...Array(50)].map((_,i) => (
                  <div key={i} className="absolute rounded-sm"
                    style={{
                      left: `${Math.random()*100}%`, top: '-8px',
                      width: `${4+Math.random()*6}px`, height: `${4+Math.random()*6}px`,
                      backgroundColor: ['#38bdf8','#8b5cf6','#10b981','#ec4899','#fbbf24','#ef4444','#14b8a6'][i%7],
                      animation: `confetti ${1.8+Math.random()*2}s ease-in forwards`,
                      animationDelay: `${Math.random()*0.6}s`,
                    }} />
                ))}
              </div>
            )}

            {/* header */}
            <div className="relative px-6 pt-5 pb-2 text-center">
              <button onClick={() => !spinning && setIsOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors" data-testid="spin-wheel-close">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-400">
                Spin & Win
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tracking-wide uppercase">1 free spin every 24 hours</p>
            </div>

            {/* ── 3D Wheel Area ── */}
            <div className="relative flex justify-center py-3" style={{ perspective: '900px' }}>
              {/* neon ring glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full -z-10"
                style={{ boxShadow: '0 0 60px 8px rgba(56,189,248,0.12), inset 0 0 60px 8px rgba(56,189,248,0.06)' }} />

              {/* pointer */}
              <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20" style={{ filter: 'drop-shadow(0 2px 8px rgba(56,189,248,0.6))' }}>
                <svg width="32" height="36" viewBox="0 0 32 36">
                  <polygon points="16,36 2,0 30,0" fill="#38bdf8" />
                  <polygon points="16,30 6,4 26,4" fill="#0ea5e9" />
                </svg>
              </div>

              {/* wheel with 3D tilt */}
              <div style={{
                transform: `rotateX(6deg) rotate(${rotation}deg)`,
                transition: spinning ? 'transform 4.5s cubic-bezier(0.12, 0.75, 0.1, 1)' : 'none',
                transformStyle: 'preserve-3d',
                filter: spinning ? 'brightness(1.1)' : 'none',
              }}>
                <canvas ref={wheelRef} width={340} height={340} className="rounded-full"
                  style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 3px rgba(56,189,248,0.25), inset 0 0 20px rgba(0,0,0,0.3)' }} />
              </div>
            </div>

            {/* prize result */}
            {wonPrize && (
              <div className="mx-5 mb-1 p-3.5 rounded-2xl text-center z-30 relative"
                data-testid="spin-prize-result"
                style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(56,189,248,0.3)' }}>
                <div className="flex items-center justify-center gap-2">
                  <Icon className="w-5 h-5 text-cyan-400" />
                  <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-sky-400">{wonPrize.prize?.label}</span>
                  <Icon className="w-5 h-5 text-cyan-400" />
                </div>
                <p className="text-xs text-sky-300/70 mt-0.5">{wonPrize.message}</p>
              </div>
            )}

            {/* spin button */}
            <div className="px-5 pt-2 pb-3">
              <button onClick={handleSpin} disabled={!canSpin || spinning}
                data-testid="spin-button"
                className={`w-full py-3.5 rounded-2xl font-black text-base tracking-wide transition-all duration-300 ${
                  canSpin && !spinning
                    ? 'text-white shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-95'
                    : spinning
                      ? 'text-white animate-pulse cursor-not-allowed'
                      : 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                }`}
                style={canSpin && !spinning
                  ? { background: 'linear-gradient(135deg,#0ea5e9,#3b82f6,#8b5cf6)' }
                  : spinning
                    ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }
                    : {}
                }>
                {spinning ? 'Spinning...' : canSpin ? 'SPIN NOW' : `Next spin in ${Math.ceil(hoursRemaining)}h`}
              </button>
            </div>

            {/* prize grid */}
            <div className="px-5 pb-5">
              <div className="grid grid-cols-3 gap-1.5">
                {prizes.map(p => {
                  const Ic = PRIZE_ICONS[p.emoji] || Circle;
                  return (
                    <div key={p.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-slate-400"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Ic className="w-3.5 h-3.5 flex-shrink-0" style={{ color: p.color }} />
                      <span className="truncate">{p.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes confetti {
          0%   { transform: translateY(0) rotate(0deg) scale(1); opacity:1; }
          100% { transform: translateY(520px) rotate(800deg) scale(0.4); opacity:0; }
        }
        @keyframes fabSpin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

/* ── colour helpers ── */
function lighten(hex, pct) {
  const [r,g,b] = hexToRgb(hex);
  return rgbToHex(
    Math.min(255, r + Math.round((255-r)*pct/100)),
    Math.min(255, g + Math.round((255-g)*pct/100)),
    Math.min(255, b + Math.round((255-b)*pct/100))
  );
}
function darken(hex, pct) {
  const [r,g,b] = hexToRgb(hex);
  return rgbToHex(
    Math.max(0, Math.round(r*(1-pct/100))),
    Math.max(0, Math.round(g*(1-pct/100))),
    Math.max(0, Math.round(b*(1-pct/100)))
  );
}
function hexToRgb(h) {
  const v = parseInt(h.replace('#',''),16);
  return [(v>>16)&255,(v>>8)&255,v&255];
}
function rgbToHex(r,g,b) {
  return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
}

export default SpinWheel;
