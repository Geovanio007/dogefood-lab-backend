import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { useGame } from '../contexts/GameContext';
import { useNFTVerification } from '../hooks/useNFTVerification';
import { useTelegram } from '../contexts/TelegramContext';
import DogeFoodLogo from './DogeFoodLogo';
import MusicPlayer from './MusicPlayer';
import ScientistChat from './ScientistChat';
import { useMusic } from '../contexts/MusicContext';
import {
  Beaker, Trophy, Settings, Palette, Clock, User, Check, Edit2, X,
  Wallet, UserPlus, Crown, Store, Camera, Zap, ChevronRight,
  BookOpen, Activity, TrendingUp
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const SEASON_1_END = new Date('2026-03-31T00:00:00Z').getTime();

// ─── Compact Season Countdown ────────────────────────────────
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
        seconds: Math.floor((diff % 60000) / 1000)
      };
    };
    setTimeLeft(calc());
    const t = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(t);
  }, []);

  const units = [
    { val: timeLeft.days, label: 'D', color: 'text-yellow-400' },
    { val: String(timeLeft.hours).padStart(2, '0'), label: 'H', color: 'text-sky-400' },
    { val: String(timeLeft.minutes).padStart(2, '0'), label: 'M', color: 'text-sky-400' },
    { val: String(timeLeft.seconds).padStart(2, '0'), label: 'S', color: 'text-slate-400' }
  ];

  return (
    <div className="flex gap-1.5">
      {units.map((u, i) => (
        <div key={i} className="text-center">
          <div className="bg-slate-800 rounded px-1.5 py-0.5 min-w-[28px] border border-white/5">
            <span className={`text-xs font-bold tabular-nums ${u.color}`}>{u.val}</span>
          </div>
          <span className="text-[8px] text-white/30 uppercase">{u.label}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Live Activity Feed ──────────────────────────────────────
const LiveActivityFeed = () => {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/activity/recent?limit=15`);
      if (res.ok) {
        const data = await res.json();
        setActivity(data.activity || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  const rarityColor = {
    Common: 'text-slate-400', Uncommon: 'text-green-400', Rare: 'text-blue-400',
    Epic: 'text-purple-400', Legendary: 'text-amber-400', Mythic: 'text-pink-400'
  };

  const rarityBg = {
    Common: 'bg-slate-500/10', Uncommon: 'bg-green-500/10', Rare: 'bg-blue-500/10',
    Epic: 'bg-purple-500/10', Legendary: 'bg-amber-500/10', Mythic: 'bg-pink-500/10'
  };

  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="live-activity-feed">
      {activity.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
        >
          <div className={`w-7 h-7 rounded-lg ${rarityBg[item.rarity] || 'bg-slate-500/10'} flex items-center justify-center shrink-0`}>
            <Beaker className={`w-3.5 h-3.5 ${rarityColor[item.rarity] || 'text-slate-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-white text-xs font-medium truncate">{item.player_nickname}</span>
              <span className={`text-[10px] font-medium ${rarityColor[item.rarity] || 'text-slate-400'}`}>
                {item.rarity}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {item.treat_name || 'Unnamed treat'}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs font-bold text-yellow-400">+{item.points_reward}</div>
            <div className="text-[9px] text-slate-500">{timeAgo(item.created_at)}</div>
          </div>
        </div>
      ))}
      {activity.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-xs">No recent activity</div>
      )}
    </div>
  );
};

// ─── Navigation Sidebar (Desktop) ────────────────────────────
const navItems = [
  { path: '/lab', icon: Beaker, label: 'Lab', color: 'text-yellow-400', needsAuth: true },
  { path: '/nfts', icon: Palette, label: 'My Treats', color: 'text-purple-400' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard', color: 'text-emerald-400' },
  { path: '/marketplace', icon: Store, label: 'Marketplace', color: 'text-sky-400' },
  { path: '/tournament', icon: Crown, label: 'Tournament', color: 'text-amber-400' },
  { path: '/settings', icon: Settings, label: 'Settings', color: 'text-slate-400' },
];

const Sidebar = ({ onAuthRequired }) => (
  <nav className="hidden lg:flex flex-col w-48 shrink-0 sticky top-4 self-start" data-testid="menu-sidebar">
    <div className="space-y-0.5">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          onClick={item.needsAuth ? onAuthRequired : undefined}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors group"
        >
          <item.icon className={`w-4 h-4 ${item.color} group-hover:scale-110 transition-transform`} />
          <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
          <ChevronRight className="w-3 h-3 text-slate-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ))}
      <div className="my-2 mx-3 h-px bg-white/5" />
      <a
        href="/game-mechanisms.html"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors group"
      >
        <BookOpen className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Game Guide</span>
      </a>
    </div>
  </nav>
);

// ─── Mobile Bottom Nav ───────────────────────────────────────
const MobileNav = ({ onAuthRequired }) => (
  <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-white/5" data-testid="mobile-nav">
    <div className="flex items-center justify-around px-2 py-1.5 max-w-md mx-auto">
      {navItems.slice(0, 5).map((item) => (
        <Link
          key={item.path}
          to={item.path}
          onClick={item.needsAuth ? onAuthRequired : undefined}
          className="flex flex-col items-center gap-0.5 px-2 py-1"
        >
          <item.icon className={`w-5 h-5 ${item.color}`} />
          <span className="text-[9px] text-slate-400">{item.label.split(' ')[0]}</span>
        </Link>
      ))}
      <Link to="/settings" className="flex flex-col items-center gap-0.5 px-2 py-1">
        <Settings className="w-5 h-5 text-slate-400" />
        <span className="text-[9px] text-slate-400">More</span>
      </Link>
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════
// MAIN MENU COMPONENT
// ═════════════════════════════════════════════════════════════
const MainMenu = () => {
  const { address, isConnected } = useAccount();
  const { nftBalance, isNFTHolder, loading: nftLoading } = useNFTVerification();
  const { user, currentLevel, points, dispatch, loadPlayerData } = useGame();
  const { telegramUser, isTelegram } = useTelegram();
  const { showPlayer } = useMusic();
  const navigate = useNavigate();

  useEffect(() => { showPlayer(); }, [showPlayer]);

  // ─── Auth & User State ─────────────────────────────────────
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showGuestSignup, setShowGuestSignup] = useState(false);
  const [guestUsername, setGuestUsername] = useState('');
  const [guestSignupError, setGuestSignupError] = useState('');
  const [guestSignupLoading, setGuestSignupLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [gameStats, setGameStats] = useState(null);
  const [happyHour, setHappyHour] = useState(null);

  const [guestUser, setGuestUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dogefood_player')); } catch { return null; }
  });
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerPoints, setPlayerPoints] = useState(0);

  const isLoggedIn = isConnected || guestUser;
  const effectiveAddress = address || guestUser?.guest_id || guestUser?.id;
  const effectiveLevel = isConnected ? currentLevel : playerLevel;
  const effectivePoints = isConnected ? points : playerPoints;
  const isAuthenticated = isConnected || isTelegram || guestUser;

  // ─── Data Loading ──────────────────────────────────────────
  const loadGuestProfile = async (playerId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/player/${playerId}/profile`);
      if (res.ok) {
        const p = await res.json();
        setUsername(p.nickname || '');
        setProfileImage(p.profile_image || null);
        setPlayerLevel(p.level || 1);
        setPlayerPoints(p.points || 0);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const load = () => {
      try {
        const p = JSON.parse(localStorage.getItem('dogefood_player'));
        if (p) {
          setGuestUser(p);
          setUsername(p.username || '');
          const id = p.guest_id || p.id || p.address;
          if (id) loadGuestProfile(id);
        }
      } catch {}
    };
    load();
    const onStorage = (e) => { if (e.key === 'dogefood_player') load(); };
    const onReg = () => load();
    window.addEventListener('storage', onStorage);
    window.addEventListener('dogefood_player_registered', onReg);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('dogefood_player_registered', onReg); };
  }, []);

  useEffect(() => {
    if (isConnected && address) {
      fetch(`${BACKEND_URL}/api/player/${address}/profile`)
        .then(r => r.ok ? r.json() : null)
        .then(p => { if (p) { setUsername(p.nickname || ''); setProfileImage(p.profile_image || null); } })
        .catch(() => {});
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (isConnected && address && !nftLoading) {
      dispatch({ type: 'SET_USER', payload: { address, isNFTHolder, nftBalance } });
      loadPlayerData(address);
    } else if (!isConnected) {
      dispatch({ type: 'SET_USER', payload: null });
    }
  }, [isConnected, address, isNFTHolder, nftBalance, nftLoading, dispatch, loadPlayerData]);

  // Fetch game stats & happy hour
  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/api/stats`).then(r => r.ok ? r.json() : null),
      fetch(`${BACKEND_URL}/api/happy-hour/status`).then(r => r.ok ? r.json() : null)
    ]).then(([stats, hh]) => {
      if (stats) setGameStats(stats);
      if (hh) setHappyHour(hh);
    }).catch(() => {});
  }, []);

  // ─── Handlers ──────────────────────────────────────────────
  const handleLabAccess = (e) => { if (!isAuthenticated) { e.preventDefault(); setShowAuthModal(true); } };

  const handleProfileImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.size > 2 * 1024 * 1024) { if (file) alert('Image must be less than 2MB'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setProfileImage(ev.target.result);
      try { await fetch(`${BACKEND_URL}/api/player/${effectiveAddress}/profile-image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: ev.target.result }) }); } catch {}
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUsername = async () => {
    if (!usernameInput.trim()) { setUsernameError('Username cannot be empty'); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(usernameInput)) { setUsernameError('3-20 chars, alphanumeric + underscores'); return; }
    setSavingUsername(true); setUsernameError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/player/${effectiveAddress}/update-username?username=${encodeURIComponent(usernameInput)}`, { method: 'POST' });
      if (r.ok) { setUsername(usernameInput); setIsEditingUsername(false); }
      else { const d = await r.json(); setUsernameError(d.detail || 'Failed'); }
    } catch { setUsernameError('Failed to save'); }
    finally { setSavingUsername(false); }
  };

  const handleGuestSignup = async () => {
    if (!guestUsername || guestUsername.length < 3) { setGuestSignupError('Min 3 characters'); return; }
    if (guestUsername.length > 20) { setGuestSignupError('Max 20 characters'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(guestUsername)) { setGuestSignupError('Letters, numbers, underscores only'); return; }
    setGuestSignupLoading(true); setGuestSignupError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/players/guest-register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: guestUsername }) });
      const d = await r.json();
      if (!r.ok) { setGuestSignupError(d.detail || 'Failed'); setGuestSignupLoading(false); return; }
      localStorage.setItem('dogefood_player', JSON.stringify({ id: d.player_id, guest_id: d.guest_id, username: d.username, auth_type: 'guest' }));
      setGuestUser({ id: d.player_id, guest_id: d.guest_id, username: d.username, auth_type: 'guest' });
      window.dispatchEvent(new Event('dogefood_player_registered'));
      setShowAuthModal(false); setShowGuestSignup(false); setGuestSignupLoading(false);
      navigate('/lab');
    } catch { setGuestSignupError('Network error'); setGuestSignupLoading(false); }
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0c1220] pb-20 lg:pb-0" data-testid="main-menu">

      {/* ─── Top Header ──────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0c1220]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <DogeFoodLogo size="sm" showText={false} showBeta={true} className="shrink-0" />

          <div className="flex items-center gap-2 sm:gap-3">
            {isLoggedIn && (
              <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-2.5 py-1.5 border border-white/5">
                <span className="text-[10px] text-slate-400">Lv</span>
                <span className="text-xs font-bold text-yellow-400">{effectiveLevel || 1}</span>
                <div className="w-px h-3 bg-white/10" />
                <span className="text-xs font-bold text-sky-400 tabular-nums">{(effectivePoints || 0).toLocaleString()}</span>
                <span className="text-[10px] text-slate-400">pts</span>
                {isNFTHolder && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
              </div>
            )}

            <ConnectButton.Custom>
              {({ account, chain, openAccountModal, openConnectModal, mounted, authenticationStatus }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');
                if (!ready) return <div style={{ opacity: 0, pointerEvents: 'none' }} />;
                if (!connected) return (
                  <Button onClick={openConnectModal} size="sm" className="bg-sky-600 hover:bg-sky-500 text-white text-xs h-8 px-3">
                    <Wallet className="w-3.5 h-3.5 mr-1.5" /> Connect
                  </Button>
                );
                if (chain.unsupported) return <Button onClick={openAccountModal} size="sm" className="bg-red-500 text-white text-xs h-8 px-3">Wrong Network</Button>;
                return (
                  <Button onClick={openAccountModal} size="sm" variant="outline" className="border-sky-500/30 text-sky-400 text-xs h-8 px-3 font-mono hover:bg-sky-500/10">
                    {account.address.slice(0, 4)}...{account.address.slice(-3)}
                  </Button>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </header>

      {/* ─── Main Layout ─────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 pt-4 flex gap-5">

        {/* LEFT SIDEBAR (Desktop only) */}
        <Sidebar onAuthRequired={handleLabAccess} />

        {/* CENTER CONTENT */}
        <main className="flex-1 min-w-0 space-y-4">

          {/* ── Player Profile (if logged in) ── */}
          {isLoggedIn && (
            <Card className="border-0 bg-slate-800/50 overflow-hidden" data-testid="player-profile-card">
              <div className="h-0.5 bg-gradient-to-r from-yellow-400 via-sky-400 to-yellow-400" />
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <label htmlFor="profile-upload" className="cursor-pointer block relative group shrink-0">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 border-sky-400/20">
                      {profileImage ? (
                        <img src={profileImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                          <User className="w-5 h-5 text-sky-300/60" />
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="w-3.5 h-3.5 text-white" />
                    </div>
                    {isNFTHolder && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                        <Crown className="w-2.5 h-2.5 text-yellow-900" />
                      </div>
                    )}
                  </label>
                  <input id="profile-upload" type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />

                  {/* Name & edit */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] text-sky-400/70 uppercase tracking-widest font-semibold">Scientist</div>
                    {!isEditingUsername ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm sm:text-base text-white truncate">{username || 'Set username'}</span>
                        <button onClick={() => { setUsernameInput(username); setIsEditingUsername(true); setUsernameError(''); }} className="p-0.5 hover:bg-white/10 rounded">
                          <Edit2 className="w-3 h-3 text-sky-400/50" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Input value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="Username" className="w-28 h-7 text-xs bg-slate-700 border-sky-400/30 text-white" maxLength={20} />
                        <Button size="sm" onClick={handleSaveUsername} disabled={savingUsername} className="bg-sky-500 h-7 px-2"><Check className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setIsEditingUsername(false)} className="h-7 px-1 text-white/50"><X className="w-3 h-3" /></Button>
                        {usernameError && <span className="text-[9px] text-red-400">{usernameError}</span>}
                      </div>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="hidden sm:flex items-center gap-3 bg-slate-800/80 rounded-lg px-3 py-2 border border-white/5">
                    <div className="text-center"><div className="text-[9px] text-white/30 uppercase">Level</div><div className="text-sm font-bold text-yellow-400">{effectiveLevel || 1}</div></div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="text-center"><div className="text-[9px] text-white/30 uppercase">Points</div><div className="text-sm font-bold text-sky-400 tabular-nums">{(effectivePoints || 0).toLocaleString()}</div></div>
                    {isNFTHolder && (<><div className="w-px h-6 bg-white/10" /><div className="text-center"><Crown className="w-4 h-4 text-yellow-400 mx-auto" /><div className="text-[9px] text-yellow-400 font-bold">VIP</div></div></>)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Promotional Banners Row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Season 1 */}
            <div className="bg-gradient-to-br from-sky-600/20 to-sky-900/30 rounded-xl p-3 border border-sky-500/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center"><Beaker className="w-4 h-4 text-sky-400" /></div>
                  <div>
                    <div className="text-xs font-bold text-white">Season 1: Beta</div>
                    <div className="text-[10px] text-sky-300/70">Earn points for $LAB airdrop</div>
                  </div>
                </div>
              </div>
              <SeasonCountdown />
            </div>

            {/* Happy Hour */}
            <div className={`rounded-xl p-3 border flex flex-col justify-between ${happyHour?.active ? 'bg-gradient-to-br from-yellow-600/20 to-amber-900/30 border-yellow-500/30' : 'bg-gradient-to-br from-slate-700/30 to-slate-800/30 border-white/5'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${happyHour?.active ? 'bg-yellow-500/20' : 'bg-slate-600/30'}`}>
                  <Zap className={`w-4 h-4 ${happyHour?.active ? 'text-yellow-400' : 'text-slate-400'}`} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    Happy Hour
                    {happyHour?.active && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                  </div>
                  <div className="text-[10px] text-slate-400">+25% bonus at 15:00 UTC daily</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500">{happyHour?.active ? 'LIVE NOW' : `Next: ${happyHour?.start_hour_utc || 15}:00 UTC`}</div>
            </div>

            {/* NFT Rewards */}
            <div className="bg-gradient-to-br from-amber-600/20 to-orange-900/30 rounded-xl p-3 border border-amber-500/20 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center"><Crown className="w-4 h-4 text-amber-400" /></div>
                <div>
                  <div className="text-xs font-bold text-white">NFT Holder Rewards</div>
                  <div className="text-[10px] text-amber-300/70">500 bonus + VIP status</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500">{gameStats?.nft_holders || 0} VIP holders</div>
            </div>
          </div>

          {/* ── Quick Action Cards (Enter Lab + Auto-Mixer) ── */}
          <div className="grid grid-cols-2 gap-2.5">
            <Link to="/lab" onClick={handleLabAccess} className="block">
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-600/10 border border-yellow-500/20 p-4 sm:p-5 hover:border-yellow-400/40 transition-all group h-full" data-testid="enter-lab-btn">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                    <Beaker className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <h3 className="text-sm sm:text-lg font-bold text-white">Enter Lab</h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 hidden sm:block">Mix ingredients & create treats</p>
                </div>
              </div>
            </Link>

            <Link to="/settings" state={{ tab: 'auto-mixer' }} className="block">
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-500/10 to-indigo-600/10 border border-sky-500/20 p-4 sm:p-5 hover:border-sky-400/40 transition-all group h-full" data-testid="auto-mixer-btn">
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative rounded-full h-2 w-2 bg-emerald-500" /></span>
                  <span className="text-emerald-300 text-[9px] font-bold hidden sm:inline">LIVE</span>
                </div>
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                    <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <h3 className="text-sm sm:text-lg font-bold text-white">Auto-Mixer</h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 hidden sm:block">AI mixes treats for you</p>
                </div>
              </div>
            </Link>
          </div>

          {/* ── Quick Nav Grid (Mobile-friendly) ── */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { path: '/nfts', icon: Palette, label: 'Treats', gradient: 'from-purple-500/10 to-pink-500/10', border: 'border-purple-500/20', iconColor: 'text-purple-400' },
              { path: '/leaderboard', icon: Trophy, label: 'Ranks', gradient: 'from-emerald-500/10 to-green-500/10', border: 'border-emerald-500/20', iconColor: 'text-emerald-400' },
              { path: '/marketplace', icon: Store, label: 'Market', gradient: 'from-sky-500/10 to-cyan-500/10', border: 'border-sky-500/20', iconColor: 'text-sky-400' },
              { path: '/tournament', icon: Crown, label: 'Tourney', gradient: 'from-amber-500/10 to-orange-500/10', border: 'border-amber-500/20', iconColor: 'text-amber-400' },
            ].map((item) => (
              <Link key={item.path} to={item.path} className="block">
                <div className={`bg-gradient-to-br ${item.gradient} rounded-xl border ${item.border} p-2.5 sm:p-3 text-center hover:scale-[1.03] transition-transform`}>
                  <item.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${item.iconColor} mx-auto mb-1`} />
                  <div className="text-[10px] sm:text-xs text-white font-medium">{item.label}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Game Stats Bar ── */}
          {gameStats && (
            <div className="flex items-center justify-around bg-white/[0.02] rounded-xl border border-white/5 py-2.5 px-4" data-testid="game-stats-bar">
              <div className="text-center">
                <div className="text-sm sm:text-lg font-bold text-white">{gameStats.total_players}</div>
                <div className="text-[9px] text-slate-500 uppercase">Players</div>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="text-center">
                <div className="text-sm sm:text-lg font-bold text-yellow-400">{gameStats.nft_holders}</div>
                <div className="text-[9px] text-slate-500 uppercase">VIP</div>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="text-center">
                <div className="text-sm sm:text-lg font-bold text-sky-400">{(gameStats.total_treats || 0).toLocaleString()}</div>
                <div className="text-[9px] text-slate-500 uppercase">Treats</div>
              </div>
            </div>
          )}

          {/* ── Live Activity Feed ── */}
          <div className="lg:hidden">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Live Activity</span>
              <span className="relative flex h-2 w-2 ml-1"><span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative rounded-full h-2 w-2 bg-emerald-500" /></span>
            </div>
            <div className="bg-slate-800/40 rounded-xl border border-white/5 p-2 max-h-[300px] overflow-y-auto">
              <LiveActivityFeed />
            </div>
          </div>

          {/* ── Powered By + Footer ── */}
          <div className="text-center py-6">
            <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-3">Powered by</div>
            <img
              src="https://customer-assets.emergentagent.com/job_dogefoodlab/artifacts/ckey490s_20250812_154617.jpg"
              alt="DOGEOS" className="max-w-[280px] sm:max-w-[400px] mx-auto rounded-lg border border-white/5 opacity-80 hover:opacity-100 transition-opacity" />
            <p className="text-slate-600 text-[10px] mt-4">Built for the Dogecoin community</p>
          </div>
        </main>

        {/* RIGHT SIDEBAR (Desktop only) — Live Activity */}
        <aside className="hidden lg:block w-72 shrink-0 sticky top-16 self-start" data-testid="activity-sidebar">
          <div className="bg-slate-800/40 rounded-xl border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white">Live Treats Activity</span>
              <span className="relative flex h-1.5 w-1.5 ml-auto"><span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative rounded-full h-1.5 w-1.5 bg-emerald-500" /></span>
            </div>
            <div className="max-h-[calc(100vh-100px)] overflow-y-auto p-1.5">
              <LiveActivityFeed />
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Nav */}
      <MobileNav onAuthRequired={handleLabAccess} />
      <MusicPlayer />
      <ScientistChat />

      {/* ─── Auth Modal ───────────────────────────────────── */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-700 relative">
            <button onClick={() => { setShowAuthModal(false); setShowGuestSignup(false); }} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            {!showGuestSignup ? (
              <>
                <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"><Beaker className="w-7 h-7 text-white" /></div>
                <h3 className="text-lg font-bold text-white text-center mb-1">Join the Lab!</h3>
                <p className="text-slate-400 text-xs text-center mb-5">Connect wallet or sign up to start mixing</p>
                <div className="space-y-3">
                  <ConnectButton.Custom>
                    {({ openConnectModal }) => (
                      <button onClick={() => { setShowAuthModal(false); openConnectModal(); }} className="w-full py-2.5 px-4 rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-500 transition-colors flex items-center justify-center gap-2 text-sm">
                        <Wallet className="w-4 h-4" /> Connect Wallet
                      </button>
                    )}
                  </ConnectButton.Custom>
                  <div className="flex items-center gap-3"><div className="flex-1 h-px bg-slate-600" /><span className="text-slate-500 text-xs">or</span><div className="flex-1 h-px bg-slate-600" /></div>
                  <button onClick={() => setShowGuestSignup(true)} className="w-full py-2.5 px-4 rounded-xl bg-slate-700 text-white font-semibold hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 text-sm">
                    <UserPlus className="w-4 h-4" /> Sign Up as Guest
                  </button>
                </div>
              </>
            ) : (
              <>
                <button onClick={() => setShowGuestSignup(false)} className="text-slate-400 hover:text-white text-sm mb-3 flex items-center gap-1">← Back</button>
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg"><UserPlus className="w-6 h-6 text-white" /></div>
                <h3 className="text-base font-bold text-white text-center mb-1">Guest Account</h3>
                <p className="text-slate-400 text-[11px] text-center mb-4">Choose a username to get started</p>
                <div className="space-y-3">
                  <div>
                    <Input type="text" placeholder="Username" value={guestUsername} onChange={(e) => setGuestUsername(e.target.value)} className="w-full bg-slate-700 border-slate-600 text-white" maxLength={20} />
                    {guestSignupError && <p className="text-red-400 text-xs mt-1">{guestSignupError}</p>}
                  </div>
                  <button onClick={handleGuestSignup} disabled={guestSignupLoading || !guestUsername} className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                    {guestSignupLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check className="w-4 h-4" /> Create Account</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MainMenu;
