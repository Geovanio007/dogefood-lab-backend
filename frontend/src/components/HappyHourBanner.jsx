import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Zap } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const HappyHourBanner = () => {
  const [status, setStatus] = useState(null);
  const [countdown, setCountdown] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/happy-hour/status`);
      if (res.ok) setStatus(await res.json());
    } catch (e) {
      console.error('Happy Hour fetch error:', e);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (!status) return;

    const tick = () => {
      if (status.active) {
        const remaining = status.remaining_seconds;
        const now = Date.now();
        const elapsed = Math.floor((now - fetchTimestamp) / 1000);
        const left = Math.max(0, remaining - elapsed);
        const m = Math.floor(left / 60);
        const s = left % 60;
        setCountdown(`${m}m ${s.toString().padStart(2, '0')}s`);
        if (left <= 0) fetchStatus();
      } else {
        const secsUntil = status.seconds_until_next;
        const now = Date.now();
        const elapsed = Math.floor((now - fetchTimestamp) / 1000);
        const left = Math.max(0, secsUntil - elapsed);
        const h = Math.floor(left / 3600);
        const m = Math.floor((left % 3600) / 60);
        const s = left % 60;
        setCountdown(`${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
        if (left <= 0) fetchStatus();
      }
    };

    const fetchTimestamp = Date.now();
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [status, fetchStatus]);

  if (!status) return null;

  if (status.active) {
    return (
      <div
        className="mb-6 relative overflow-hidden rounded-xl border-2 border-yellow-400/60"
        data-testid="happy-hour-banner"
      >
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-600/90 via-amber-500/90 to-orange-500/90" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.1),transparent_50%)]" />

        <div className="relative z-10 flex items-center justify-between p-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm uppercase tracking-wide">Happy Hour Live</span>
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </div>
              <p className="text-yellow-100 text-xs mt-0.5">
                +{status.bonus_percent}% bonus points on all treats collected now
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-white/70 text-[10px] uppercase tracking-wider">Ends in</div>
            <div className="text-white font-mono font-bold text-lg">{countdown}</div>
          </div>
        </div>
      </div>
    );
  }

  // Upcoming state — compact, subtle
  return (
    <div
      className="mb-6 relative overflow-hidden rounded-xl border border-slate-500/30"
      data-testid="happy-hour-banner"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-slate-700/80 via-slate-600/80 to-slate-700/80" />

      <div className="relative z-10 flex items-center justify-between p-3 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <span className="text-slate-200 font-semibold text-xs">Happy Hour</span>
            <p className="text-slate-400 text-[10px]">
              +{status.bonus_percent}% bonus points daily at {status.start_hour_utc}:00 UTC
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-slate-500 text-[9px] uppercase tracking-wider">Starts in</div>
          <div className="text-yellow-400 font-mono font-semibold text-sm">{countdown}</div>
        </div>
      </div>
    </div>
  );
};

export default HappyHourBanner;
