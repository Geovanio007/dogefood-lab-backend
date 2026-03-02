import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Gift, Star, Sparkles, Gem, Trophy, Flame, Heart, Crown, Zap } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const PRIZE_ICONS = {
  star: Star,
  sparkles: Sparkles,
  gem: Gem,
  trophy: Trophy,
  fire: Flame,
  heart: Heart,
  hearts: Heart,
  crown: Crown,
  zap: Zap,
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
  const canvasRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    if (!playerAddress) return;
    try {
      const res = await fetch(`${API_URL}/api/spin-wheel/status/${playerAddress}`);
      if (res.ok) {
        const data = await res.json();
        setCanSpin(data.can_spin);
        setHoursRemaining(data.hours_remaining);
        setPrizes(data.prizes || []);
        setPulseReady(data.can_spin);
      }
    } catch (e) { /* silent */ }
  }, [playerAddress]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Draw wheel on canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current || prizes.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const size = 320;
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 8;
    const sliceAngle = (2 * Math.PI) / prizes.length;

    prizes.forEach((prize, i) => {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      // Slice fill
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = prize.color;
      ctx.fill();

      // Thin border
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;
      const label = prize.label.length > 14 ? prize.label.slice(0, 13) + '..' : prize.label;
      ctx.fillText(label, r - 16, 4);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPIN', cx, cy);
  }, [prizes, isOpen]);

  const handleSpin = async () => {
    if (spinning || !canSpin) return;
    setSpinning(true);
    setWonPrize(null);
    setShowConfetti(false);

    try {
      const res = await fetch(`${API_URL}/api/spin-wheel/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_address: playerAddress })
      });

      if (!res.ok) {
        const err = await res.json();
        setSpinning(false);
        return;
      }

      const data = await res.json();
      const prizeIdx = data.prize_index;
      const sliceAngle = 360 / prizes.length;

      // Calculate target rotation: land on the winning slice
      const targetSliceCenter = prizeIdx * sliceAngle + sliceAngle / 2;
      // Spin 5-8 full rotations + land on target (pointer is at top = 270deg on canvas)
      const extraSpins = (5 + Math.random() * 3) * 360;
      const finalRotation = extraSpins + (360 - targetSliceCenter + 270) % 360;

      setRotation(prev => prev + finalRotation);

      // Show result after animation
      setTimeout(() => {
        setWonPrize(data);
        setShowConfetti(true);
        setSpinning(false);
        setCanSpin(false);
        setPulseReady(false);
        setHoursRemaining(24);
        if (onPrizeWon) onPrizeWon(data);
      }, 4200);

    } catch (e) {
      setSpinning(false);
    }
  };

  const PrizeIcon = wonPrize ? (PRIZE_ICONS[wonPrize.prize?.emoji] || Star) : Star;

  return (
    <>
      {/* Floating Minimized Button */}
      <button
        onClick={() => { setIsOpen(true); setWonPrize(null); setShowConfetti(false); }}
        className={`fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 ${
          pulseReady
            ? 'bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 animate-bounce shadow-yellow-500/50'
            : 'bg-gradient-to-br from-slate-700 to-slate-800 shadow-slate-900/50'
        }`}
        data-testid="spin-wheel-fab"
        title={canSpin ? 'Free spin available!' : `Next spin in ${Math.ceil(hoursRemaining)}h`}
      >
        <Gift className={`w-7 h-7 ${pulseReady ? 'text-white' : 'text-slate-400'}`} />
        {pulseReady && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow-lg">
            1
          </span>
        )}
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="spin-wheel-modal">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !spinning && setIsOpen(false)} />

          {/* Modal Content */}
          <div className="relative w-full max-w-md bg-gradient-to-b from-[#0f172a] via-[#1e1b4b] to-[#0f172a] rounded-3xl border-2 border-yellow-500/30 overflow-hidden shadow-2xl shadow-yellow-500/10">
            {/* Confetti effect */}
            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
                {[...Array(40)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: '-10px',
                      backgroundColor: ['#fbbf24', '#ef4444', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#f97316'][i % 7],
                      animation: `confettiFall ${1.5 + Math.random() * 2}s ease-in forwards`,
                      animationDelay: `${Math.random() * 0.8}s`
                    }}
                  />
                ))}
              </div>
            )}

            {/* Header */}
            <div className="relative p-5 text-center">
              <button
                onClick={() => !spinning && setIsOpen(false)}
                className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
                data-testid="spin-wheel-close"
              >
                <X className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400">
                Spin & Win!
              </h2>
              <p className="text-sm text-slate-400 mt-1">1 free spin every 24 hours</p>
            </div>

            {/* Wheel Area */}
            <div className="relative flex justify-center py-2">
              {/* Pointer triangle at top */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-0 h-0"
                style={{
                  borderLeft: '14px solid transparent',
                  borderRight: '14px solid transparent',
                  borderTop: '28px solid #fbbf24',
                  filter: 'drop-shadow(0 4px 6px rgba(251, 191, 36, 0.4))'
                }}
              />

              {/* Outer glow ring */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full -z-10"
                style={{ background: 'conic-gradient(from 0deg, #fbbf24, #ef4444, #3b82f6, #10b981, #ec4899, #8b5cf6, #f97316, #fbbf24)', opacity: 0.25, filter: 'blur(20px)' }}
              />

              {/* Canvas wheel */}
              <div
                className="relative z-10"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none'
                }}
              >
                <canvas ref={canvasRef} width={320} height={320} className="rounded-full shadow-2xl" style={{ border: '4px solid rgba(251,191,36,0.6)' }} />
              </div>
            </div>

            {/* Prize Result */}
            {wonPrize && (
              <div className="mx-5 mb-2 p-4 rounded-2xl bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 text-center" data-testid="spin-prize-result">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <PrizeIcon className="w-6 h-6 text-yellow-400" />
                  <span className="text-xl font-black text-yellow-300">{wonPrize.prize?.label}</span>
                  <PrizeIcon className="w-6 h-6 text-yellow-400" />
                </div>
                <p className="text-sm text-amber-200/80">{wonPrize.message}</p>
              </div>
            )}

            {/* Spin Button */}
            <div className="p-5 pt-2">
              <button
                onClick={handleSpin}
                disabled={!canSpin || spinning}
                className={`w-full py-4 rounded-2xl font-black text-lg tracking-wide transition-all duration-300 ${
                  canSpin && !spinning
                    ? 'bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/40 hover:shadow-xl hover:shadow-amber-500/50 hover:scale-[1.02] active:scale-95'
                    : spinning
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white animate-pulse cursor-not-allowed'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                data-testid="spin-button"
              >
                {spinning ? 'Spinning...' : canSpin ? 'SPIN NOW!' : `Next spin in ${Math.ceil(hoursRemaining)}h`}
              </button>
            </div>

            {/* Prize Legend */}
            <div className="px-5 pb-5">
              <div className="grid grid-cols-3 gap-1.5">
                {prizes.map((p) => {
                  const Icon = PRIZE_ICONS[p.emoji] || Star;
                  return (
                    <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 text-[11px] text-slate-300">
                      <Icon className="w-3 h-3 flex-shrink-0" style={{ color: p.color }} />
                      <span className="truncate">{p.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confetti animation keyframes */}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(500px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </>
  );
};

export default SpinWheel;
