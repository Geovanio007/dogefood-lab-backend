import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useGame } from '../contexts/GameContext';
import { useTelegram } from '../contexts/TelegramContext';
import { ArrowLeft, Trophy, Crown, Users, TrendingUp, Clock, CircleDot, Beaker } from 'lucide-react';
import PlayerStatsModal from './PlayerStatsModal';
import MusicPlayer from './MusicPlayer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const SEASON_1_END = new Date('2026-03-31T00:00:00Z').getTime();

const SeasonCountdown = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calc = () => {
      const diff = SEASON_1_END - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      };
    };
    setTimeLeft(calc());
    const t = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(t);
  }, []);

  const boxes = [
    { val: timeLeft.days, label: 'DAYS' },
    { val: String(timeLeft.hours).padStart(2, '0'), label: 'HRS' },
    { val: String(timeLeft.minutes).padStart(2, '0'), label: 'MIN' },
    { val: String(timeLeft.seconds).padStart(2, '0'), label: 'SEC' },
  ];

  return (
    <div className="rounded-2xl p-4 border border-sky-500/20 bg-gradient-to-r from-sky-900/30 via-[#0c1222] to-sky-900/30"
      style={{ boxShadow: '0 0 30px rgba(56,189,248,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
      <div className="text-xs text-sky-400 mb-3 text-center font-bold tracking-widest flex items-center justify-center gap-2">
        <Clock className="w-3.5 h-3.5" /> SEASON 1 ENDS IN
      </div>
      <div className="flex gap-2 sm:gap-3 justify-center">
        {boxes.map((b, i) => (
          <div key={i} className="text-center">
            <div className="rounded-xl px-3 sm:px-4 py-2 min-w-[48px] sm:min-w-[56px] border border-sky-500/20 bg-sky-500/10"
              style={{ boxShadow: '0 4px 12px rgba(56,189,248,0.1), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
              <span className={`text-xl sm:text-2xl font-black ${i === 3 ? 'text-yellow-400' : 'text-white'}`}>{b.val}</span>
            </div>
            <span className="text-[10px] text-sky-400/70 mt-1 block font-semibold">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Leaderboard = () => {
  const { address } = useAccount();
  const { points, currentLevel } = useGame();
  const { telegramUser } = useTelegram();
  const playerAddress = address || (telegramUser ? `tg_${telegramUser.id}` : null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [currentUserPoints, setCurrentUserPoints] = useState(0);
  const [selectedPlayerAddress, setSelectedPlayerAddress] = useState(null);

  const SEASON_1_POOL = 20000000;
  const DISTRIBUTION = {
    top10: { percent: 30, multiplier: 1.5, tokens: SEASON_1_POOL * 0.30 },
    top20: { percent: 20, multiplier: 0.7, tokens: SEASON_1_POOL * 0.20 },
    top50: { percent: 20, multiplier: 0.2, tokens: SEASON_1_POOL * 0.20 },
    nftHolders: { percent: 20, tokens: SEASON_1_POOL * 0.20 },
    specialEvents: { percent: 10, tokens: SEASON_1_POOL * 0.10 },
  };

  const loadLeaderboard = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/leaderboard`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(Array.isArray(data) ? data : []);
        setError(null);
      } else { throw new Error('Failed to load'); }
    } catch (err) {
      setError(err.message);
      setLeaderboard([]);
    }
  };

  useEffect(() => {
    (async () => { setLoading(true); await loadLeaderboard(); setLoading(false); })();
    const iv = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (playerAddress && leaderboard.length > 0) {
      const idx = leaderboard.findIndex(e => e.address?.toLowerCase() === playerAddress.toLowerCase());
      if (idx !== -1) { setCurrentUserRank(idx + 1); setCurrentUserPoints(leaderboard[idx].points || 0); }
      else { setCurrentUserRank(null); setCurrentUserPoints(points || 0); }
    }
  }, [playerAddress, leaderboard, points]);

  const getRankIcon = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null;
  const formatAddr = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`;
  const fmt = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const calcRewards = (rank) => {
    if (rank <= 10) return { tokens: Math.floor(DISTRIBUTION.top10.tokens * ((11 - rank) / 55) * 1.5), tier: 'Top 10', mult: '1.5x' };
    if (rank <= 20) return { tokens: Math.floor(DISTRIBUTION.top20.tokens * ((21 - rank) / 55) * 0.7), tier: 'Top 20', mult: '0.7x' };
    if (rank <= 50) return { tokens: Math.floor(DISTRIBUTION.top50.tokens * ((51 - rank) / 465) * 0.2), tier: 'Top 50', mult: '0.2x' };
    return { tokens: 0, tier: 'Below 50', mult: '-' };
  };

  // Card wrapper with 3D effect
  const Card3D = ({ children, className = '', glow = 'sky' }) => {
    const glowColors = {
      sky: 'rgba(56,189,248,0.08)',
      yellow: 'rgba(250,204,21,0.08)',
      emerald: 'rgba(52,211,153,0.08)',
    };
    return (
      <div className={`rounded-2xl border border-white/[0.06] bg-[#111827]/80 backdrop-blur-sm ${className}`}
        style={{
          boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 40px ${glowColors[glow] || glowColors.sky}, inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}>
        {children}
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
      <div className="text-center">
        <Trophy className="w-16 h-16 text-sky-400 animate-bounce mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">Loading Leaderboard...</h2>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-5xl mb-4">😔</div>
        <h2 className="text-xl font-bold text-white mb-3">Unable to Load Leaderboard</h2>
        <p className="text-slate-400 mb-6">{error}</p>
        <Button onClick={loadLeaderboard} className="bg-sky-600 hover:bg-sky-500 text-white">Try Again</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white" data-testid="leaderboard-page">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-sky-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-sky-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto p-4 sm:p-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-white/5" data-testid="back-btn">
                <ArrowLeft className="w-4 h-4 mr-1" /> Menu
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
                <Trophy className="w-7 h-7 text-sky-400" /> Leaderboard
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">Top Scientists competing for $LAB</p>
            </div>
          </div>
          <Badge className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs" data-testid="season-badge">
            Season 1
          </Badge>
        </div>

        {/* Season Countdown */}
        <div className="mb-6">
          <SeasonCountdown />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Rewards', value: '20M $LAB', color: 'text-yellow-400', glow: 'yellow' },
            { label: 'Active Players', value: leaderboard.length, color: 'text-sky-400', glow: 'sky' },
            { label: 'NFT Minting', value: 'Soon', color: 'text-emerald-400', glow: 'emerald' },
          ].map((s, i) => (
            <Card3D key={i} glow={s.glow} className="p-4 text-center">
              <div className={`text-lg sm:text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{s.label}</div>
            </Card3D>
          ))}
        </div>

        {/* Distribution Breakdown */}
        <Card3D className="p-4 mb-6">
          <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <CircleDot className="w-4 h-4 text-sky-400" /> $LAB Distribution
          </h4>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            <div className="rounded-xl p-2.5 text-center border border-sky-500/15 bg-sky-500/5" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
              <div className="text-[10px] text-sky-400 font-semibold mb-0.5">Top 10</div>
              <div className="text-base font-black text-white">30%</div>
              <div className="text-[9px] text-sky-400/70">{fmt(DISTRIBUTION.top10.tokens)}</div>
              <div className="text-[9px] text-sky-300 font-bold mt-0.5">1.5x</div>
            </div>
            <div className="rounded-xl p-2.5 text-center border border-sky-500/15 bg-sky-500/5" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
              <div className="text-[10px] text-sky-400 font-semibold mb-0.5">Top 20</div>
              <div className="text-base font-black text-white">20%</div>
              <div className="text-[9px] text-sky-400/70">{fmt(DISTRIBUTION.top20.tokens)}</div>
              <div className="text-[9px] text-sky-300 font-bold mt-0.5">0.7x</div>
            </div>
            <div className="rounded-xl p-2.5 text-center border border-sky-500/15 bg-sky-500/5" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
              <div className="text-[10px] text-sky-400 font-semibold mb-0.5">Top 50</div>
              <div className="text-base font-black text-white">20%</div>
              <div className="text-[9px] text-sky-400/70">{fmt(DISTRIBUTION.top50.tokens)}</div>
              <div className="text-[9px] text-sky-300 font-bold mt-0.5">0.2x</div>
            </div>
            <div className="rounded-xl p-2.5 text-center border border-emerald-500/15 bg-emerald-500/5" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
              <div className="text-[10px] text-emerald-400 font-semibold mb-0.5">NFT</div>
              <div className="text-base font-black text-white">20%</div>
              <div className="text-[9px] text-emerald-400/70">{fmt(DISTRIBUTION.nftHolders.tokens)}</div>
              <div className="text-[9px] text-emerald-300 font-bold mt-0.5">Base</div>
            </div>
            <div className="rounded-xl p-2.5 text-center border border-yellow-500/15 bg-yellow-500/5" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
              <div className="text-[10px] text-yellow-400 font-semibold mb-0.5">Events</div>
              <div className="text-base font-black text-white">10%</div>
              <div className="text-[9px] text-yellow-400/70">{fmt(DISTRIBUTION.specialEvents.tokens)}</div>
              <div className="text-[9px] text-yellow-300 font-bold mt-0.5">Special</div>
            </div>
          </div>
        </Card3D>

        {/* Your Performance */}
        {playerAddress && (
          <Card3D className="p-4 mb-6" glow="sky">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" /> Your Performance
            </h4>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Rank', value: currentUserRank ? `#${currentUserRank}` : 'Unranked', color: 'text-sky-400' },
                { label: 'Points', value: currentUserPoints.toLocaleString(), color: 'text-emerald-400' },
                { label: 'Level', value: `Lv ${currentLevel}`, color: 'text-sky-300' },
                { label: 'Est. Rewards', value: currentUserRank && currentUserRank <= 50 ? `${fmt(calcRewards(currentUserRank).tokens)} $LAB` : '0', color: 'text-yellow-400' },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className={`text-lg sm:text-xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-slate-400">{s.label}</div>
                </div>
              ))}
            </div>
          </Card3D>
        )}

        {/* Leaderboard Table */}
        <Card3D className="overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">Top 50 VIP Scientists</h3>
          </div>

          {!leaderboard.length ? (
            <div className="text-center py-16 px-4">
              <div className="text-5xl mb-4">🦗</div>
              <h3 className="text-lg font-bold text-white mb-2">It's Quiet Here...</h3>
              <p className="text-slate-400 mb-6 text-sm">Be the first to start competing!</p>
              <Link to="/lab">
                <Button className="bg-sky-600 hover:bg-sky-500 text-white">Start Creating Treats</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {leaderboard.map((entry, index) => {
                const rank = index + 1;
                const isCurrentUser = playerAddress && entry.address?.toLowerCase() === playerAddress.toLowerCase();
                const rankEmoji = getRankIcon(rank);
                const rewards = calcRewards(rank);
                const isTopThree = rank <= 3;

                return (
                  <div
                    key={entry.address}
                    data-testid={`leaderboard-row-${rank}`}
                    className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 transition-colors hover:bg-white/[0.02] ${
                      isCurrentUser ? 'bg-sky-500/10 border-l-2 border-l-sky-400' : ''
                    } ${isTopThree ? 'bg-gradient-to-r from-sky-500/5 to-transparent' : ''}`}
                  >
                    {/* Rank */}
                    <div className="w-7 sm:w-10 text-center flex-shrink-0">
                      {rankEmoji ? (
                        <span className="text-xl sm:text-2xl">{rankEmoji}</span>
                      ) : (
                        <span className="text-xs sm:text-sm font-bold text-slate-400">#{rank}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex-shrink-0 border border-sky-500/20"
                      style={{ boxShadow: isTopThree ? '0 0 12px rgba(56,189,248,0.2)' : '0 2px 8px rgba(0,0,0,0.3)' }}>
                      {entry.character_image ? (
                        <img src={entry.character_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-sky-600 to-sky-800 flex items-center justify-center">
                          <Beaker className="w-5 h-5 text-sky-200" />
                        </div>
                      )}
                    </div>

                    {/* Name + Badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={() => setSelectedPlayerAddress(entry.address)}
                          className="font-bold text-sm text-white hover:text-sky-400 transition-colors truncate"
                          data-testid={`player-name-${rank}`}
                          style={{ maxWidth: 'calc(100% - 60px)' }}
                        >
                          {entry.nickname || `Scientist #${rank}`}
                        </button>
                        {isCurrentUser && (
                          <Badge className="bg-sky-500/20 text-sky-300 text-[9px] px-1.5 py-0 border border-sky-500/20">You</Badge>
                        )}
                        {entry.is_nft_holder && (
                          <Badge className="bg-white/15 text-white text-[8px] px-1 py-0 border border-white/20" data-testid={`vip-badge-${rank}`}>VIP</Badge>
                        )}
                        {entry.is_dogeonews_holder && (
                          <Badge className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-amber-300 text-[8px] px-1 py-0 border border-amber-500/20 flex items-center gap-0.5" data-testid={`holder-badge-${rank}`}>
                            <img src="/dogeonews-token.png" alt="$DOGEONEWS" className="w-3 h-3" />
                            HOLDER
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {entry.character_name && (
                          <span className="text-[10px] text-sky-400/60 truncate max-w-[80px] sm:max-w-none">{entry.character_name}</span>
                        )}
                        <span className="font-mono text-[10px] text-slate-500 hidden sm:inline">{formatAddr(entry.address)}</span>
                        <Badge variant="outline" className="text-[9px] text-slate-300 border-white/10 px-1 py-0 sm:hidden">
                          Lv {entry.level}
                        </Badge>
                      </div>
                    </div>

                    {/* Level - desktop only */}
                    <div className="hidden sm:block">
                      <Badge variant="outline" className="text-[10px] text-slate-300 border-white/10">
                        Lv {entry.level}
                      </Badge>
                    </div>

                    {/* Points */}
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-sm sm:text-base text-sky-400">{entry.points.toLocaleString()}</div>
                      <div className="text-[9px] text-slate-500">pts</div>
                    </div>

                    {/* Rewards */}
                    <div className="hidden sm:block text-right flex-shrink-0 min-w-[90px]">
                      <div className="text-xs font-bold text-yellow-400">
                        {rank <= 50 ? `${fmt(rewards.tokens)} $LAB` : '-'}
                      </div>
                      {rank <= 50 && <div className="text-[9px] text-slate-500">{rewards.mult}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card3D>

        {/* Reward Tiers */}
        <Card3D className="p-4 mt-6">
          <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-400" /> Reward Tiers
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl border border-sky-500/15 bg-sky-500/5"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
              <div className="text-3xl mb-1">🥇</div>
              <h5 className="font-bold text-sm text-sky-400">Top 10</h5>
              <p className="text-[11px] text-slate-400">30% Pool</p>
              <p className="text-xs font-bold text-sky-300">1.5x Multiplier</p>
            </div>
            <div className="text-center p-3 rounded-xl border border-sky-500/15 bg-sky-500/5"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
              <div className="text-3xl mb-1">🥈</div>
              <h5 className="font-bold text-sm text-sky-400">Top 20</h5>
              <p className="text-[11px] text-slate-400">20% Pool</p>
              <p className="text-xs font-bold text-sky-300">0.7x Multiplier</p>
            </div>
            <div className="text-center p-3 rounded-xl border border-sky-500/15 bg-sky-500/5"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
              <div className="text-3xl mb-1">🥉</div>
              <h5 className="font-bold text-sm text-sky-400">Top 50</h5>
              <p className="text-[11px] text-slate-400">20% Pool</p>
              <p className="text-xs font-bold text-sky-300">0.2x Multiplier</p>
            </div>
          </div>
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-center">
            <p className="text-emerald-300 text-xs">
              <strong>NFT Holders:</strong> 20% baseline pool (4M $LAB) &nbsp;|&nbsp; <strong>Events:</strong> 10% (2M $LAB)
            </p>
          </div>
        </Card3D>
      </div>

      {selectedPlayerAddress && (
        <PlayerStatsModal playerAddress={selectedPlayerAddress} onClose={() => setSelectedPlayerAddress(null)} />
      )}
      <MusicPlayer />
    </div>
  );
};

export default Leaderboard;
