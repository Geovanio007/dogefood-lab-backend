import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useGame } from '../contexts/GameContext';
import { useNFTVerification } from '../hooks/useNFTVerification';
import { useTelegram } from '../contexts/TelegramContext';
import DogeFoodLogo from './DogeFoodLogo';
import MusicPlayer from './MusicPlayer';
import ThemeToggle from './ThemeToggle';
import { useMusic } from '../contexts/MusicContext';
import {
  Beaker, Trophy, Settings, Palette, Clock, User, Check, Edit2, X,
  Wallet, UserPlus, Crown, Store, Camera, Zap, ChevronRight,
  BookOpen, Activity, TrendingUp, Share2, Home, Star,
  ArrowRight, ChevronLeft, Users, MessageCircle, Send,
  Rocket, Reply, Smile
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const SEASON_1_END = new Date('2026-03-31T00:00:00Z').getTime();

// ─── Season Countdown ────────────────────────────────────────
const SeasonCountdown = ({ compact }) => {
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

  if (compact) {
    return (
      <span className="text-xs font-mono text-yellow-400 tabular-nums">
        {timeLeft.days}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m
      </span>
    );
  }

  return (
    <div className="flex gap-1.5">
      {[
        { val: timeLeft.days, label: 'D', color: 'text-yellow-400' },
        { val: String(timeLeft.hours).padStart(2, '0'), label: 'H', color: 'text-sky-400' },
        { val: String(timeLeft.minutes).padStart(2, '0'), label: 'M', color: 'text-sky-400' },
        { val: String(timeLeft.seconds).padStart(2, '0'), label: 'S', color: 'text-slate-400' }
      ].map((u, i) => (
        <div key={i} className="text-center">
          <div className="bg-[#0d1117] rounded px-1.5 py-0.5 min-w-[28px] border border-white/5">
            <span className={`text-xs font-bold tabular-nums ${u.color}`}>{u.val}</span>
          </div>
          <span className="text-[8px] text-white/30 uppercase">{u.label}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Emoji Picker (simple) ───────────────────────────────────
const QUICK_EMOJIS = ['😀','😂','🔥','❤️','👍','👏','🎉','💎','✨','🐶','🏆','💪','🤩','😎','🚀','⭐','💛','🎯','🪄','🎮'];

const EmojiPicker = ({ onSelect, onClose }) => (
  <div className="absolute bottom-full mb-2 left-0 bg-[#1a2035] border border-white/10 rounded-xl p-2 shadow-xl z-50" data-testid="emoji-picker">
    <div className="grid grid-cols-10 gap-1">
      {QUICK_EMOJIS.map((e) => (
        <button key={e} onClick={() => { onSelect(e); onClose(); }} className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded text-base transition-colors">
          {e}
        </button>
      ))}
    </div>
  </div>
);

// ─── Live Chat Component ─────────────────────────────────────
const LiveChat = ({ isLoggedIn, effectiveAddress, username }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const chatContainerRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/messages?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages]);

  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const handleSend = async () => {
    if (!msgInput.trim() || !effectiveAddress || sending) return;
    setSending(true);
    try {
      const body = {
        player_id: effectiveAddress,
        message: msgInput.trim()
      };
      if (replyTo) {
        body.reply_to = replyTo.message_id;
        body.reply_nickname = replyTo.player_nickname;
        body.reply_text = replyTo.message;
      }
      const res = await fetch(`${BACKEND_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setMsgInput('');
        setReplyTo(null);
        setShowEmoji(false);
        fetchMessages();
      }
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="live-chat">
      {/* Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 text-xs">No messages yet. Be the first to say hello!</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={msg.message_id || idx} className="group px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                {msg.player_image ? (
                  <img src={msg.player_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-3 h-3 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-sky-400 truncate">{msg.player_nickname || 'Anonymous'}</span>
                  <span className="text-[9px] text-slate-600">{timeAgo(msg.created_at)}</span>
                  {isLoggedIn && (
                    <button
                      onClick={() => setReplyTo(msg)}
                      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-white/10 rounded"
                      title="Reply"
                    >
                      <Reply className="w-3 h-3 text-slate-500" />
                    </button>
                  )}
                </div>
                {msg.reply_nickname && (
                  <div className="flex items-center gap-1 mt-0.5 mb-0.5 pl-2 border-l-2 border-sky-500/30">
                    <Reply className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                    <span className="text-[9px] text-slate-500 truncate">
                      <span className="font-medium text-sky-400/70">{msg.reply_nickname}</span>: {msg.reply_text}
                    </span>
                  </div>
                )}
                <p className={`text-[12px] text-slate-300 break-words leading-relaxed ${msg.emoji_only ? 'text-xl' : ''}`}>
                  {msg.message}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="border-t border-white/[0.06] p-2">
        {replyTo && (
          <div className="flex items-center gap-1.5 mb-1.5 px-2 py-1 bg-sky-500/10 rounded-lg border border-sky-500/20">
            <Reply className="w-3 h-3 text-sky-400 shrink-0" />
            <span className="text-[10px] text-sky-400 truncate flex-1">
              Replying to <span className="font-semibold">{replyTo.player_nickname}</span>
            </span>
            <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        {isLoggedIn ? (
          <div className="relative flex items-center gap-1.5">
            <div className="relative">
              <button
                onClick={() => setShowEmoji(!showEmoji)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-yellow-400"
                data-testid="emoji-btn"
              >
                <Smile className="w-4 h-4" />
              </button>
              {showEmoji && <EmojiPicker onSelect={(e) => setMsgInput(prev => prev + e)} onClose={() => setShowEmoji(false)} />}
            </div>
            <input
              type="text"
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              maxLength={500}
              className="flex-1 bg-[#0d1117] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/30"
              data-testid="chat-input"
            />
            <button
              onClick={handleSend}
              disabled={!msgInput.trim() || sending}
              className="p-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-colors text-white"
              data-testid="chat-send-btn"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-[10px] text-slate-500">Connect wallet or sign up to chat</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Live Activity Table ─────────────────────────────────────
const LiveActivityTable = () => {
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
    Epic: 'text-purple-400', Legendary: 'text-yellow-400', Mythic: 'text-pink-400'
  };

  const rarityBg = {
    Common: 'bg-slate-500/10', Uncommon: 'bg-green-500/10', Rare: 'bg-blue-500/10',
    Epic: 'bg-purple-500/10', Legendary: 'bg-yellow-500/10', Mythic: 'bg-pink-500/10'
  };

  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div data-testid="live-activity-table">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] text-slate-500 uppercase tracking-wider border-b border-white/5">
              <th className="px-4 py-3 font-medium">Treat</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Time</th>
              <th className="px-4 py-3 font-medium">Scientist</th>
              <th className="px-4 py-3 font-medium">Rarity</th>
              <th className="px-4 py-3 font-medium text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((item, idx) => (
              <tr key={idx} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg ${rarityBg[item.rarity] || 'bg-slate-500/10'} flex items-center justify-center shrink-0`}>
                      <Beaker className={`w-3.5 h-3.5 ${rarityColor[item.rarity] || 'text-slate-400'}`} />
                    </div>
                    <span className="text-xs text-white truncate max-w-[120px]">{item.treat_name || 'Unnamed'}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 hidden sm:table-cell">
                  <span className="text-[11px] text-slate-500">{timeAgo(item.created_at)}</span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center shrink-0">
                      <User className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="text-xs text-slate-300 truncate max-w-[100px]">{item.player_nickname}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-[11px] font-medium ${rarityColor[item.rarity] || 'text-slate-400'}`}>
                    {item.rarity}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="text-xs font-bold text-emerald-400">+{item.points_reward}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {activity.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-xs">No recent activity</div>
      )}
    </div>
  );
};

// ─── Navigation Items ────────────────────────────────────────
const navItems = [
  { path: '/', icon: Home, label: 'Home', color: 'text-sky-400', bgColor: 'bg-sky-500/10' },
  { path: '/lab', icon: Beaker, label: 'Lab', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', needsAuth: true },
  { path: '/nfts', icon: Palette, label: 'My Treats', color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  { path: '/marketplace', icon: Store, label: 'Marketplace', color: 'text-sky-400', bgColor: 'bg-sky-500/10' },
  { path: '/tournament', icon: Crown, label: 'Tournament', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  { path: '/settings', icon: Settings, label: 'Settings', color: 'text-slate-400', bgColor: 'bg-slate-500/10' },
];

// ─── Left Sidebar ────────────────────────────────────────────
const Sidebar = ({ onAuthRequired }) => (
  <nav className="hidden lg:flex flex-col w-52 shrink-0 py-4" data-testid="menu-sidebar">
    {/* Share / Invite button */}
    <button className="mx-3 mb-4 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 transition-all text-white text-sm font-semibold shadow-lg shadow-sky-500/20">
      <Share2 className="w-4 h-4" />
      <span>Share & Earn</span>
    </button>

    <div className="space-y-0.5 px-2 flex-1">
      {navItems.map((item) => {
        const isActive = item.path === '/';
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={item.needsAuth ? onAuthRequired : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative
              ${isActive
                ? 'bg-white/[0.06] border-l-2 border-sky-400'
                : 'hover:bg-white/[0.04] border-l-2 border-transparent'
              }`}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
          >
            <div className={`w-8 h-8 rounded-lg ${item.bgColor} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <span className={`text-sm transition-colors ${isActive ? 'text-white font-semibold' : 'text-slate-400 group-hover:text-white'}`}>
              {item.label}
            </span>
          </Link>
        );
      })}

      <div className="my-3 mx-3 h-px bg-white/5" />

      <a
        href="/game-mechanisms.html"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all group border-l-2 border-transparent"
      >
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <BookOpen className="w-4 h-4 text-indigo-400" />
        </div>
        <span className="text-sm text-slate-400 group-hover:text-white transition-colors">Game Guide</span>
      </a>
    </div>

    {/* Logo at bottom of sidebar */}
    <div className="px-3 mt-4 mb-2 flex flex-col items-center">
      <DogeFoodLogo size="medium" showText={false} showBeta={false} />
      <div className="text-[10px] text-white mt-2 text-center">Built with love for the Dogecoin community</div>
    </div>
  </nav>
);

// ─── Mobile Navigation Strip (horizontal scrollable) ─────────
const MobileNavStrip = ({ onAuthRequired }) => (
  <div className="lg:hidden overflow-x-auto scrollbar-hide border-b border-white/[0.06] bg-[#0d1117]" data-testid="mobile-nav-strip">
    <div className="flex items-center gap-1 px-3 py-2 min-w-max">
      {navItems.map((item) => {
        const isActive = item.path === '/';
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={item.needsAuth ? onAuthRequired : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-nowrap transition-all shrink-0
              ${isActive ? 'bg-white/[0.06] border border-sky-500/20' : 'hover:bg-white/[0.04] border border-transparent'}`}
            data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
          >
            <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
            <span className={`text-[11px] ${isActive ? 'text-white font-semibold' : 'text-slate-400'}`}>{item.label}</span>
          </Link>
        );
      })}
      <a
        href="/game-mechanisms.html"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/[0.04] border border-transparent shrink-0"
      >
        <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[11px] text-slate-400">Guide</span>
      </a>
    </div>
  </div>
);

// ─── Promotional Banner Card (3D Gamish) ─────────────────────
const PromoBanner = ({ icon: Icon, iconBg, title, subtitle, borderColor, gradientFrom, gradientTo, onClick, testId }) => (
  <button
    onClick={onClick}
    className={`relative overflow-hidden rounded-2xl p-4 border ${borderColor} bg-gradient-to-br ${gradientFrom} ${gradientTo} text-left w-full group hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-200 shadow-lg hover:shadow-xl`}
    style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)' }}
    data-testid={testId}
  >
    {/* Shine effect */}
    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.07] to-transparent rounded-2xl pointer-events-none" />
    <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/[0.04] rounded-full blur-2xl group-hover:bg-white/[0.08] transition-colors" />
    <div className="relative flex items-start gap-3">
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-lg`}
        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
        <Icon className="w-5 h-5 text-white drop-shadow-md" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-white mb-0.5 tracking-wide uppercase drop-shadow-sm">{title}</h3>
        <p className="text-[11px] text-white/60 leading-relaxed">{subtitle}</p>
      </div>
      <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center shrink-0 group-hover:bg-white/15 transition-colors mt-0.5 backdrop-blur-sm"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
        <ArrowRight className="w-4 h-4 text-white/70 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  </button>
);

// ─── Feature Card (3D Game-style) ────────────────────────────
const FeatureCard = ({ icon: Icon, label, gradient, iconColor, borderColor, to, onClick, badge, testId }) => (
  <Link to={to} onClick={onClick} className="block group" data-testid={testId}>
    <div className={`relative overflow-hidden rounded-2xl border ${borderColor} bg-gradient-to-b ${gradient} p-4 sm:p-5 text-center hover:scale-[1.05] hover:-translate-y-1 transition-all duration-200`}
      style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
      {/* Top shine */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.05] to-transparent rounded-t-2xl pointer-events-none" />
      {badge && (
        <div className="absolute top-2 right-2 z-10">
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase backdrop-blur-sm border border-emerald-500/20">{badge}</span>
        </div>
      )}
      <div className={`relative w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-2.5 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-200 border border-white/10`}
        style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.1)' }}>
        <Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${iconColor} drop-shadow-lg`} />
      </div>
      <h4 className="text-sm font-bold text-white drop-shadow-sm">{label}</h4>
    </div>
  </Link>
);

// ═══════════════════════════════════════════════════════════════
// MAIN MENU COMPONENT
// ═══════════════════════════════════════════════════════════════
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
  const [activityTab, setActivityTab] = useState('live');

  const [guestUser, setGuestUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dogefood_player')); } catch { return null; }
  });
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerPoints, setPlayerPoints] = useState(0);

  const isLoggedIn = isConnected || guestUser || (isTelegram && telegramUser);
  const effectiveAddress = address || guestUser?.guest_id || guestUser?.id || (telegramUser ? `tg_${telegramUser.id}` : null);
  const effectiveLevel = (isConnected && currentLevel) ? currentLevel : playerLevel;
  const effectivePoints = (isConnected && points) ? points : playerPoints;
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
        .then(p => {
          if (p) {
            setUsername(p.nickname || '');
            setProfileImage(p.profile_image || null);
            setPlayerLevel(p.level || 1);
            setPlayerPoints(p.points || 0);
          }
        })
        .catch(() => {});
    }
  }, [isConnected, address]);

  // Load Telegram user profile
  useEffect(() => {
    if (isTelegram && telegramUser) {
      const tgAddress = `tg_${telegramUser.id}`;
      fetch(`${BACKEND_URL}/api/player/${tgAddress}/profile`)
        .then(r => r.ok ? r.json() : null)
        .then(p => {
          if (p) {
            setUsername(p.nickname || p.telegram_first_name || telegramUser.first_name || '');
            setProfileImage(p.profile_image || null);
            setPlayerLevel(p.level || 1);
            setPlayerPoints(p.points || 0);
          } else {
            setUsername(telegramUser.first_name || telegramUser.username || '');
          }
        })
        .catch(() => {
          setUsername(telegramUser.first_name || telegramUser.username || '');
        });
    }
  }, [isTelegram, telegramUser]);

  useEffect(() => {
    if (isConnected && address && !nftLoading) {
      dispatch({ type: 'SET_USER', payload: { address, isNFTHolder, nftBalance } });
      loadPlayerData(address);
    } else if (!isConnected) {
      dispatch({ type: 'SET_USER', payload: null });
    }
  }, [isConnected, address, isNFTHolder, nftBalance, nftLoading, dispatch, loadPlayerData]);

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
    <div className="min-h-screen bg-[#0d1117]" data-testid="main-menu">

      {/* ─── Top Header ──────────────────────────────────── */}
      <header className="z-40 bg-[#0d1117] border-b border-white/[0.06]">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-[56px] flex items-center justify-between gap-2">
          {/* Left: Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <DogeFoodLogo size="small" showText={false} showBeta={false} className="shrink-0" />
          </div>
          <div className="hidden lg:block" />

          {/* Right: Stats + Wallet */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {gameStats && (
              <div className="hidden sm:flex items-center gap-3 bg-[#151b28] rounded-xl px-3 py-1.5 border border-white/[0.06]">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-xs font-semibold text-white">{gameStats.total_players}</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <Beaker className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-xs font-semibold text-white">{(gameStats.total_treats || 0).toLocaleString()}</span>
                </div>
              </div>
            )}

            {isLoggedIn && (
              <div className="flex items-center gap-1.5 bg-[#151b28] rounded-xl px-2.5 py-1.5 border border-white/[0.06]">
                {isNFTHolder && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
                <span className="text-xs font-bold text-sky-400 tabular-nums">{(effectivePoints || 0).toLocaleString()}</span>
                <span className="text-[10px] text-slate-500">pts</span>
              </div>
            )}

            {/* Theme Toggle */}
            <ThemeToggle className="!p-1.5 !w-8 !h-8" />

            <ConnectButton.Custom>
              {({ account, chain, openAccountModal, openConnectModal, openChainModal, mounted, authenticationStatus }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');
                if (!ready) return <div style={{ opacity: 0, pointerEvents: 'none' }} />;
                if (!connected) return (
                  <button
                    onClick={() => {
                      if (typeof openConnectModal === 'function') {
                        openConnectModal();
                      }
                    }}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold h-8 sm:h-9 px-3 sm:px-4 rounded-xl transition-colors"
                    data-testid="connect-wallet-btn"
                    title={isTelegram ? 'Connect wallet' : 'Connect wallet'}
                  >
                    <Wallet className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Connect</span>
                  </button>
                );
                if (chain.unsupported) return (
                  <button
                    onClick={() => {
                      if (typeof openChainModal === 'function') {
                        openChainModal();
                      } else if (typeof openAccountModal === 'function') {
                        openAccountModal();
                      }
                    }}
                    className="bg-red-500/20 text-red-400 text-xs font-semibold h-8 sm:h-9 px-3 rounded-xl border border-red-500/30"
                    data-testid="switch-network-btn"
                    title="Switch to DogeOS Chikyū Testnet"
                  >
                    Switch Network
                  </button>
                );
                return (
                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-1.5 bg-[#151b28] hover:bg-white/[0.06] border border-white/[0.06] text-white text-xs font-semibold h-8 sm:h-9 px-3 rounded-xl transition-colors"
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center">
                      <User className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="font-mono text-slate-300 hidden sm:inline">{account.address.slice(0, 4)}...{account.address.slice(-3)}</span>
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </header>

      {/* ─── Mobile Navigation Strip ─────────────────────── */}
      <MobileNavStrip onAuthRequired={handleLabAccess} />

      {/* ─── Main Layout (3-column) ──────────────────────── */}
      <div className="max-w-[1600px] mx-auto flex">

        <Sidebar onAuthRequired={handleLabAccess} />

        {/* CENTER CONTENT */}
        <main className="flex-1 min-w-0 px-3 sm:px-5 py-4 space-y-4 sm:space-y-5">

          {/* ── Mobile: Share & Earn + Quick Stats ── */}
          <div className="lg:hidden space-y-3">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 transition-all text-white text-sm font-semibold shadow-lg shadow-sky-500/20" data-testid="mobile-share-earn">
              <Share2 className="w-4 h-4" />
              <span>Share & Earn</span>
            </button>
            {gameStats && (
              <div className="flex items-center gap-2 overflow-x-auto">
                <div className="flex items-center gap-1.5 bg-[#151b28] rounded-lg px-3 py-1.5 border border-white/[0.06] shrink-0">
                  <Users className="w-3 h-3 text-sky-400" />
                  <span className="text-[11px] font-semibold text-white">{gameStats.total_players}</span>
                  <span className="text-[9px] text-slate-500">players</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#151b28] rounded-lg px-3 py-1.5 border border-white/[0.06] shrink-0">
                  <Beaker className="w-3 h-3 text-yellow-400" />
                  <span className="text-[11px] font-semibold text-white">{(gameStats.total_treats || 0).toLocaleString()}</span>
                  <span className="text-[9px] text-slate-500">treats</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#151b28] rounded-lg px-3 py-1.5 border border-white/[0.06] shrink-0">
                  <Crown className="w-3 h-3 text-yellow-400" />
                  <span className="text-[11px] font-semibold text-white">{gameStats.nft_holders}</span>
                  <span className="text-[9px] text-slate-500">VIP</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Player Profile Card ── */}
          {isLoggedIn && (
            <div className="bg-[#151b28] rounded-xl border border-white/[0.06] overflow-hidden" data-testid="player-profile-card">
              <div className="h-0.5 bg-gradient-to-r from-yellow-400 via-sky-400 to-purple-400" />
              <div className="p-3 sm:p-4 flex items-center gap-3">
                <label htmlFor="profile-upload" className="cursor-pointer block relative group shrink-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 border-sky-500/20">
                    {profileImage ? (
                      <img src={profileImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-sky-600 to-indigo-700 flex items-center justify-center">
                        <User className="w-5 h-5 text-white/70" />
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

                <div className="flex-1 min-w-0">
                  <div className="text-[9px] text-sky-400/70 uppercase tracking-widest font-semibold">Scientist</div>
                  {!isEditingUsername ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm sm:text-base text-white truncate">{username || 'Set username'}</span>
                      {!username && (
                        <button onClick={() => { setUsernameInput(username); setIsEditingUsername(true); setUsernameError(''); }} className="p-0.5 hover:bg-white/10 rounded">
                          <Edit2 className="w-3 h-3 text-sky-400/50" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Input value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="Username" className="w-28 h-7 text-xs bg-[#0d1117] border-sky-400/30 text-white" maxLength={20} />
                      <Button size="sm" onClick={handleSaveUsername} disabled={savingUsername} className="bg-sky-500 h-7 px-2"><Check className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingUsername(false)} className="h-7 px-1 text-white/50"><X className="w-3 h-3" /></Button>
                      {usernameError && <span className="text-[9px] text-red-400">{usernameError}</span>}
                    </div>
                  )}
                </div>

                <div className="hidden sm:flex items-center gap-3 bg-[#0d1117] rounded-xl px-4 py-2 border border-white/[0.06]">
                  <div className="text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Level</div>
                    <div className="text-sm font-bold text-yellow-400">{effectiveLevel || 1}</div>
                  </div>
                  <div className="w-px h-6 bg-white/10" />
                  <div className="text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Points</div>
                    <div className="text-sm font-bold text-sky-400 tabular-nums">{(effectivePoints || 0).toLocaleString()}</div>
                  </div>
                  {isNFTHolder && (
                    <>
                      <div className="w-px h-6 bg-white/10" />
                      <div className="text-center">
                        <Crown className="w-4 h-4 text-yellow-400 mx-auto" />
                        <div className="text-[9px] text-yellow-400 font-bold">VIP</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Three Promotional Banners ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PromoBanner
              icon={Crown}
              iconBg="bg-gradient-to-br from-purple-500 to-indigo-600"
              title="VIP Club"
              subtitle="Hold DogeFood NFT for 500 bonus points & VIP status!"
              borderColor="border-purple-500/20"
              gradientFrom="from-purple-900/30"
              gradientTo="to-indigo-900/20"
              onClick={() => navigate('/nfts')}
              testId="promo-vip-club"
            />
            <PromoBanner
              icon={Trophy}
              iconBg="bg-gradient-to-br from-emerald-500 to-green-600"
              title="Leaderboard"
              subtitle="Become one of the top 50 scientists!"
              borderColor="border-emerald-500/20"
              gradientFrom="from-emerald-900/30"
              gradientTo="to-green-900/20"
              onClick={() => navigate('/leaderboard')}
              testId="promo-leaderboard"
            />
            <PromoBanner
              icon={UserPlus}
              iconBg="bg-gradient-to-br from-emerald-600 to-green-700"
              title="Refer & Earn"
              subtitle="Invite friends & earn bonus rewards together!"
              borderColor="border-emerald-600/20"
              gradientFrom="from-emerald-950/40"
              gradientTo="to-green-950/30"
              onClick={() => navigate('/tournament')}
              testId="promo-refer-earn"
            />
          </div>

          {/* ── Featured Banner (Lab CTA + Happy Hour) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link to="/lab" onClick={handleLabAccess}>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2744] to-[#151b28] border border-sky-500/15 p-5 sm:p-6 hover:border-sky-400/30 hover:-translate-y-0.5 transition-all duration-200 group"
                style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}
                data-testid="enter-lab-btn">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent rounded-2xl pointer-events-none" />
                <div className="absolute top-0 right-0 w-40 h-40 bg-sky-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-200"
                    style={{ boxShadow: '0 8px 24px rgba(234,179,8,0.3)' }}>
                    <Beaker className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-0.5">Enter the Lab</h3>
                    <p className="text-xs text-slate-400">Mix ingredients & create magical dogetreats</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-sky-400 font-medium flex items-center gap-1">
                        Start mixing <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            <div className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 border transition-all duration-200 hover:-translate-y-0.5 ${
              happyHour?.active
                ? 'bg-gradient-to-br from-[#2a2a0d] to-[#1a1a08] border-yellow-500/20'
                : 'bg-gradient-to-br from-[#151b28] to-[#0d1117] border-white/[0.06]'
            }`}
              style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent rounded-2xl pointer-events-none" />
              <div className="relative flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  happyHour?.active
                    ? 'bg-gradient-to-br from-yellow-400 to-yellow-500'
                    : 'bg-gradient-to-br from-slate-600 to-slate-700'
                }`}
                  style={{ boxShadow: happyHour?.active ? '0 8px 24px rgba(234,179,8,0.3)' : '0 4px 12px rgba(0,0,0,0.3)' }}>
                  <Clock className={`w-8 h-8 ${happyHour?.active ? 'text-white' : 'text-slate-300'} drop-shadow-md`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-lg font-bold text-white">Happy Hour</h3>
                    {happyHour?.active && (
                      <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold animate-pulse">LIVE</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">+25% bonus points daily at 15:00 UTC</p>
                  <div className="mt-2">
                    {happyHour?.active ? (
                      <span className="text-xs text-yellow-400 font-semibold">Bonus active now!</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] text-slate-500">Next: {happyHour?.start_hour_utc || 15}:00 UTC</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Feature Cards ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wide">Features</h2>
              </div>
              <Link to="/settings" className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1">
                See All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              <FeatureCard
                icon={Beaker}
                label="Lab"
                gradient="from-yellow-500/20 to-yellow-600/10"
                iconColor="text-yellow-300"
                borderColor="border-yellow-500/15"
                to="/lab"
                onClick={handleLabAccess}
                testId="feature-lab"
              />
              <FeatureCard
                icon={Settings}
                label="Auto-Mix"
                gradient="from-sky-500/20 to-indigo-600/10"
                iconColor="text-sky-300"
                borderColor="border-sky-500/15"
                to="/auto-mixer"
                badge="AI"
                testId="feature-auto-mixer"
              />
              <FeatureCard
                icon={Palette}
                label="Treats"
                gradient="from-purple-500/20 to-pink-600/10"
                iconColor="text-purple-300"
                borderColor="border-purple-500/15"
                to="/nfts"
                testId="feature-treats"
              />
              <FeatureCard
                icon={Store}
                label="Market"
                gradient="from-sky-500/20 to-cyan-600/10"
                iconColor="text-sky-300"
                borderColor="border-sky-500/15"
                to="/marketplace"
                testId="feature-market"
              />
              <FeatureCard
                icon={Crown}
                label="Tourney"
                gradient="from-yellow-500/20 to-yellow-600/10"
                iconColor="text-yellow-300"
                borderColor="border-yellow-500/15"
                to="/tournament"
                testId="feature-tournament"
              />
            </div>
          </div>

          {/* ── Live Activity Table ── */}
          <div className="bg-[#151b28] rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="flex items-center gap-0 border-b border-white/[0.06]">
              {[
                { key: 'live', label: 'Live Activity', color: 'text-emerald-400' },
                { key: 'stats', label: 'Game Stats', color: 'text-sky-400' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActivityTab(tab.key)}
                  className={`px-4 py-3 text-xs font-semibold transition-colors relative ${
                    activityTab === tab.key ? `${tab.color}` : 'text-slate-500 hover:text-slate-300'
                  }`}
                  data-testid={`activity-tab-${tab.key}`}
                >
                  <div className="flex items-center gap-1.5">
                    {tab.key === 'live' && (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-500" />
                      </span>
                    )}
                    {tab.label}
                  </div>
                  {activityTab === tab.key && (
                    <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${tab.key === 'live' ? 'bg-emerald-400' : 'bg-sky-400'}`} />
                  )}
                </button>
              ))}
            </div>

            {activityTab === 'live' ? (
              <LiveActivityTable />
            ) : (
              <div className="p-4">
                {gameStats ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-[#0d1117] rounded-xl p-3 border border-white/[0.04] text-center">
                      <Users className="w-5 h-5 text-sky-400 mx-auto mb-1.5" />
                      <div className="text-lg font-bold text-white">{gameStats.total_players}</div>
                      <div className="text-[10px] text-slate-500">Total Players</div>
                    </div>
                    <div className="bg-[#0d1117] rounded-xl p-3 border border-white/[0.04] text-center">
                      <Crown className="w-5 h-5 text-yellow-400 mx-auto mb-1.5" />
                      <div className="text-lg font-bold text-yellow-400">{gameStats.nft_holders}</div>
                      <div className="text-[10px] text-slate-500">VIP Holders</div>
                    </div>
                    <div className="bg-[#0d1117] rounded-xl p-3 border border-white/[0.04] text-center">
                      <Beaker className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
                      <div className="text-lg font-bold text-emerald-400">{(gameStats.total_treats || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500">Total Treats</div>
                    </div>
                    <div className="bg-[#0d1117] rounded-xl p-3 border border-white/[0.04] text-center">
                      <Clock className="w-5 h-5 text-purple-400 mx-auto mb-1.5" />
                      <div className="text-lg font-bold text-white"><SeasonCountdown compact /></div>
                      <div className="text-[10px] text-slate-500">Season Ends</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 text-xs">Loading stats...</div>
                )}
              </div>
            )}
          </div>

          {/* ── Mobile Live Chat (inline, visible on mobile) ── */}
          <div className="lg:hidden bg-[#151b28] rounded-xl border border-white/[0.06] overflow-hidden" data-testid="mobile-inline-chat">
            {/* Chat Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-white flex-1">Live Chat</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            {/* Season Countdown */}
            <div className="mx-3 mt-3 p-2.5 rounded-xl bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-500/15">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shrink-0">
                  <span className="text-white font-black text-xs leading-none">S1</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Season 1 Countdown</div>
                  <div className="text-[10px] text-indigo-300/70 mt-0.5"><SeasonCountdown compact /></div>
                </div>
              </div>
            </div>
            {/* Chat Messages */}
            <div className="h-[350px] overflow-hidden">
              <LiveChat isLoggedIn={isLoggedIn} effectiveAddress={effectiveAddress} username={username} />
            </div>
          </div>

          {/* ── Mobile Logo ── */}
          <div className="lg:hidden py-4 flex flex-col items-center">
            <DogeFoodLogo size="medium" showText={false} showBeta={false} />
            <div className="text-[10px] text-white mt-2 text-center">Built with love for the Dogecoin community</div>
          </div>

          {/* ── Powered By Footer ── */}
          <div className="text-center py-6">
            <div className="text-[10px] text-white uppercase tracking-widest mb-3">Powered by</div>
            <img
              src="https://customer-assets.emergentagent.com/job_dogefoodlab/artifacts/ckey490s_20250812_154617.jpg"
              alt="DOGEOS" className="max-w-[220px] sm:max-w-[380px] mx-auto rounded-lg border border-white/10"
            />
          </div>
        </main>

        {/* RIGHT SIDEBAR — Live Chat (Desktop only) */}
        <aside className="hidden lg:flex flex-col w-80 shrink-0 border-l border-white/[0.06]" data-testid="chat-sidebar">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white flex-1">Live Chat</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            {gameStats && (
              <span className="text-[10px] text-slate-500 ml-1">{gameStats.total_players} players</span>
            )}
          </div>
          <div className="mx-3 mt-3 p-3 rounded-xl bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-500/15">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shrink-0">
                <span className="text-white font-black text-sm leading-none">S1</span>
              </div>
              <div>
                <div className="text-xs font-bold text-white">Season 1 Countdown</div>
                <div className="text-[10px] text-indigo-300/70 mt-0.5"><SeasonCountdown compact /></div>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-hidden mt-2">
            <LiveChat isLoggedIn={isLoggedIn} effectiveAddress={effectiveAddress} username={username} />
          </div>
        </aside>
      </div>

      {/* Mobile Nav */}
      <MusicPlayer />

      {/* ─── Auth Modal ───────────────────────────────────── */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" data-testid="auth-modal">
          <div className="bg-[#151b28] rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/[0.06] relative">
            <button onClick={() => { setShowAuthModal(false); setShowGuestSignup(false); }} className="absolute top-4 right-4 text-slate-400 hover:text-white" data-testid="auth-modal-close">
              <X className="w-5 h-5" />
            </button>
            {!showGuestSignup ? (
              <>
                <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"><Beaker className="w-7 h-7 text-white" /></div>
                <h3 className="text-lg font-bold text-white text-center mb-1">Join the Lab!</h3>
                <p className="text-slate-400 text-xs text-center mb-5">Connect wallet or sign up to start mixing</p>
                <div className="space-y-3">
                  <ConnectButton.Custom>
                    {({ openConnectModal }) => (
                      <button onClick={() => { setShowAuthModal(false); openConnectModal(); }} className="w-full py-2.5 px-4 rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-500 transition-colors flex items-center justify-center gap-2 text-sm" data-testid="auth-connect-wallet">
                        <Wallet className="w-4 h-4" /> Connect Wallet
                      </button>
                    )}
                  </ConnectButton.Custom>
                  <div className="flex items-center gap-3"><div className="flex-1 h-px bg-white/10" /><span className="text-slate-500 text-xs">or</span><div className="flex-1 h-px bg-white/10" /></div>
                  <button onClick={() => setShowGuestSignup(true)} className="w-full py-2.5 px-4 rounded-xl bg-[#0d1117] text-white font-semibold hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-2 text-sm border border-white/[0.06]" data-testid="auth-guest-signup">
                    <UserPlus className="w-4 h-4" /> Sign Up as Guest
                  </button>
                </div>
              </>
            ) : (
              <>
                <button onClick={() => setShowGuestSignup(false)} className="text-slate-400 hover:text-white text-sm mb-3 flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg"><UserPlus className="w-6 h-6 text-white" /></div>
                <h3 className="text-base font-bold text-white text-center mb-1">Guest Account</h3>
                <p className="text-slate-400 text-[11px] text-center mb-4">Choose a username to get started</p>
                <div className="space-y-3">
                  <div>
                    <Input type="text" placeholder="Username" value={guestUsername} onChange={(e) => setGuestUsername(e.target.value)} className="w-full bg-[#0d1117] border-white/10 text-white" maxLength={20} data-testid="guest-username-input" />
                    {guestSignupError && <p className="text-red-400 text-xs mt-1">{guestSignupError}</p>}
                  </div>
                  <button onClick={handleGuestSignup} disabled={guestSignupLoading || !guestUsername} className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm" data-testid="guest-create-btn">
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
