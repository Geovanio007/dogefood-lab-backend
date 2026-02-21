import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useTelegram } from '../contexts/TelegramContext';
import { useAccount } from 'wagmi';
import MusicPlayer from './MusicPlayer';
import { 
  ArrowLeft, Trophy, Clock, Users, Swords, Crown, 
  ChevronRight, Beaker, Star, Timer, Award, Zap, Shield
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Tournament Logo
const TournamentLogo = () => (
  <img 
    src="https://customer-assets.emergentagent.com/job_audiorank-verify/artifacts/hv29xyhs_file_000000005ed071f8953e51b83d154e97.png"
    alt="Treat Masters Champions League"
    className="w-32 h-32 sm:w-40 sm:h-40 mx-auto object-contain"
  />
);

// Countdown Timer Component
const CountdownTimer = ({ targetDate, label, compact = false }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const target = new Date(targetDate).getTime();
      const diff = target - now;
      
      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
      }
      
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        ended: false
      };
    };
    
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);
  
  if (timeLeft.ended) {
    return <span className="text-red-400 font-bold text-sm">ENDED</span>;
  }
  
  if (compact) {
    return (
      <span className="text-xs text-white/70">
        {timeLeft.days > 0 && `${timeLeft.days}d `}
        {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
      </span>
    );
  }
  
  return (
    <div className="text-center">
      {label && <div className="text-xs text-white/60 mb-2">{label}</div>}
      <div className="flex gap-2 justify-center">
        {timeLeft.days > 0 && (
          <div className="bg-slate-800/80 rounded-lg px-3 py-2 min-w-[50px]">
            <span className="text-xl font-bold text-white">{timeLeft.days}</span>
            <span className="text-xs text-white/50 block">days</span>
          </div>
        )}
        <div className="bg-slate-800/80 rounded-lg px-3 py-2 min-w-[50px]">
          <span className="text-xl font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
          <span className="text-xs text-white/50 block">hrs</span>
        </div>
        <div className="bg-slate-800/80 rounded-lg px-3 py-2 min-w-[50px]">
          <span className="text-xl font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
          <span className="text-xs text-white/50 block">min</span>
        </div>
        <div className="bg-slate-800/80 rounded-lg px-3 py-2 min-w-[50px]">
          <span className="text-xl font-bold text-white">{String(timeLeft.seconds).padStart(2, '0')}</span>
          <span className="text-xs text-white/50 block">sec</span>
        </div>
      </div>
    </div>
  );
};

// Bracket Player Slot
const BracketSlot = ({ player, seed, score, isWinner, isActive, position }) => {
  const isEmpty = !player;
  
  return (
    <div className={`
      flex items-center gap-2 p-2 rounded-lg transition-all duration-300
      ${isEmpty ? 'bg-slate-800/40 border border-dashed border-slate-600' : 
        isWinner ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/50' :
        isActive ? 'bg-slate-700/60 border border-amber-400/50' : 
        'bg-slate-800/60 border border-slate-600/50'}
      ${position === 'top' ? 'rounded-b-none border-b-0' : position === 'bottom' ? 'rounded-t-none' : ''}
    `}>
      {/* Seed */}
      <div className={`
        w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
        ${seed <= 2 ? 'bg-amber-500/30 text-amber-400' : 
          seed <= 4 ? 'bg-slate-600 text-slate-300' : 'bg-slate-700 text-slate-400'}
      `}>
        {seed || '?'}
      </div>
      
      {/* Player Name */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium truncate block ${isEmpty ? 'text-slate-500 italic' : 'text-white'}`}>
          {player?.nickname || 'TBD'}
        </span>
      </div>
      
      {/* Score */}
      {score !== undefined && (
        <div className="text-right">
          <span className={`text-sm font-bold ${isWinner ? 'text-green-400' : 'text-white/70'}`}>
            {score}
          </span>
        </div>
      )}
      
      {/* Winner Crown */}
      {isWinner && <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />}
    </div>
  );
};

// Single Match in Bracket
const BracketMatch = ({ match, showConnector = true, isLast = false }) => {
  const isActive = match?.status === 'active';
  const isCompleted = match?.status === 'completed';
  
  const player1Score = (match?.player1_treats || 0) * 10 + (match?.player1_points || 0);
  const player2Score = (match?.player2_treats || 0) * 10 + (match?.player2_points || 0);
  
  return (
    <div className="relative">
      {/* Match Box */}
      <div className={`
        w-48 bg-slate-900/80 rounded-xl overflow-hidden
        ${isActive ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-400/20' : 'border border-slate-700/50'}
      `}>
        {/* Match Header */}
        <div className={`
          px-3 py-1.5 text-xs font-medium flex items-center justify-between
          ${isActive ? 'bg-amber-500/20 text-amber-400' : 
            isCompleted ? 'bg-green-500/10 text-green-400' : 'bg-slate-800 text-slate-400'}
        `}>
          <span>{isActive ? '🔴 LIVE' : isCompleted ? '✓ Complete' : 'Upcoming'}</span>
          {isActive && match?.end_time && <CountdownTimer targetDate={match.end_time} compact />}
        </div>
        
        {/* Players */}
        <div className="p-1">
          <BracketSlot 
            player={match?.player1}
            seed={match?.player1_seed}
            score={isCompleted || isActive ? player1Score : undefined}
            isWinner={match?.winner_id === match?.player1?.id}
            isActive={isActive}
            position="top"
          />
          <div className="h-px bg-slate-700 mx-2" />
          <BracketSlot 
            player={match?.player2}
            seed={match?.player2_seed}
            score={isCompleted || isActive ? player2Score : undefined}
            isWinner={match?.winner_id === match?.player2?.id}
            isActive={isActive}
            position="bottom"
          />
        </div>
      </div>
      
      {/* Connector Line */}
      {showConnector && !isLast && (
        <div className="absolute right-0 top-1/2 w-8 h-px bg-slate-600 transform translate-x-full" />
      )}
    </div>
  );
};

// Full Tournament Bracket
const TournamentBracket = ({ matches }) => {
  const quarterfinals = matches?.filter(m => m.stage === 'quarterfinal') || [];
  const semifinals = matches?.filter(m => m.stage === 'semifinal') || [];
  const finals = matches?.filter(m => m.stage === 'final') || [];
  
  // Create placeholder matches if none exist
  const qfMatches = quarterfinals.length > 0 ? quarterfinals : [
    { id: 'qf1', status: 'upcoming', player1_seed: 1, player2_seed: 8 },
    { id: 'qf2', status: 'upcoming', player1_seed: 2, player2_seed: 7 },
    { id: 'qf3', status: 'upcoming', player1_seed: 3, player2_seed: 6 },
    { id: 'qf4', status: 'upcoming', player1_seed: 4, player2_seed: 5 },
  ];
  
  const sfMatches = semifinals.length > 0 ? semifinals : [
    { id: 'sf1', status: 'upcoming' },
    { id: 'sf2', status: 'upcoming' },
  ];
  
  const finalMatch = finals.length > 0 ? finals[0] : { id: 'final', status: 'upcoming' };
  
  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[800px] p-4">
        {/* Bracket Header */}
        <div className="flex justify-between mb-6 px-4">
          <div className="text-center flex-1">
            <h3 className="text-sm font-bold text-blue-400 flex items-center justify-center gap-2">
              <Beaker className="w-4 h-4" /> QUARTERFINALS
            </h3>
            <p className="text-xs text-slate-500">8 Scientists</p>
          </div>
          <div className="text-center flex-1">
            <h3 className="text-sm font-bold text-purple-400 flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" /> SEMIFINALS
            </h3>
            <p className="text-xs text-slate-500">4 Scientists</p>
          </div>
          <div className="text-center flex-1">
            <h3 className="text-sm font-bold text-amber-400 flex items-center justify-center gap-2">
              <Crown className="w-4 h-4" /> GRAND FINAL
            </h3>
            <p className="text-xs text-slate-500">Top 2 Scientists</p>
          </div>
          <div className="text-center w-32">
            <h3 className="text-sm font-bold text-green-400 flex items-center justify-center gap-2">
              <Trophy className="w-4 h-4" /> CHAMPION
            </h3>
          </div>
        </div>
        
        {/* Bracket Grid */}
        <div className="flex items-center">
          {/* Quarterfinals Column */}
          <div className="flex flex-col gap-8">
            {/* QF Top Half */}
            <div className="flex flex-col gap-4">
              <BracketMatch match={qfMatches[0]} />
              <BracketMatch match={qfMatches[1]} />
            </div>
            {/* QF Bottom Half */}
            <div className="flex flex-col gap-4 mt-8">
              <BracketMatch match={qfMatches[2]} />
              <BracketMatch match={qfMatches[3]} />
            </div>
          </div>
          
          {/* Connectors QF to SF */}
          <div className="flex flex-col gap-8 mx-2">
            <svg width="40" height="140" className="text-slate-600">
              <path d="M0,35 H20 V70 H40" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M0,105 H20 V70 H40" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
            <div className="h-8" />
            <svg width="40" height="140" className="text-slate-600">
              <path d="M0,35 H20 V70 H40" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M0,105 H20 V70 H40" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </div>
          
          {/* Semifinals Column */}
          <div className="flex flex-col justify-center" style={{ gap: '180px' }}>
            <BracketMatch match={sfMatches[0]} />
            <BracketMatch match={sfMatches[1]} />
          </div>
          
          {/* Connectors SF to Final */}
          <div className="mx-2">
            <svg width="40" height="260" className="text-slate-600">
              <path d="M0,65 H20 V130 H40" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M0,195 H20 V130 H40" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </div>
          
          {/* Final Column */}
          <div className="flex items-center">
            <BracketMatch match={finalMatch} showConnector={false} isLast />
          </div>
          
          {/* Champion Display */}
          <div className="ml-4 flex items-center">
            <div className="w-8 h-px bg-slate-600" />
            <div className="w-32 h-32 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl border-2 border-amber-400/50 flex flex-col items-center justify-center">
              {finalMatch?.winner_id ? (
                <>
                  <Crown className="w-8 h-8 text-amber-400 mb-1" />
                  <span className="text-xs text-white font-bold text-center px-2 truncate w-full">
                    {finalMatch.player1?.id === finalMatch.winner_id 
                      ? finalMatch.player1?.nickname 
                      : finalMatch.player2?.nickname}
                  </span>
                </>
              ) : (
                <>
                  <Crown className="w-8 h-8 text-slate-600 mb-1" />
                  <span className="text-xs text-slate-500">TBD</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Qualification Card
const QualificationCard = ({ rank, player, isQualified, isCurrentUser }) => (
  <div className={`
    flex items-center justify-between p-3 rounded-xl transition-all duration-200
    ${isCurrentUser ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-400/50 ring-1 ring-amber-400/30' : 
      isQualified ? 'bg-slate-800/60 border border-green-500/30 hover:border-green-400/50' : 
      'bg-slate-800/40 border border-slate-700/50 opacity-60'}
  `}>
    <div className="flex items-center gap-3">
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
        ${rank === 1 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-900' : 
          rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900' :
          rank === 3 ? 'bg-gradient-to-br from-amber-600 to-orange-700 text-white' :
          isQualified ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 
          'bg-slate-700 text-slate-400'}
      `}>
        {rank}
      </div>
      <div>
        <div className={`font-medium text-sm ${isCurrentUser ? 'text-amber-400' : 'text-white'}`}>
          {player.nickname || 'Anonymous'}
          {isCurrentUser && <span className="ml-2 text-xs text-amber-400/70">(You)</span>}
        </div>
        <div className="text-xs text-slate-400">{player.points?.toLocaleString()} pts</div>
      </div>
    </div>
    {isQualified && (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/50 text-xs">
        <Shield className="w-3 h-3 mr-1" /> Qualified
      </Badge>
    )}
  </div>
);

const Tournament = () => {
  const { address } = useAccount();
  const { telegramUser } = useTelegram();
  const [tournament, setTournament] = useState(null);
  const [qualifiedPlayers, setQualifiedPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Get player address
  const guestData = localStorage.getItem('dogefood_player');
  let playerAddress = address;
  if (!playerAddress && guestData) {
    try {
      const parsed = JSON.parse(guestData);
      playerAddress = parsed.guest_id || parsed.address || parsed.id;
    } catch (e) {}
  }
  if (!playerAddress && telegramUser) {
    playerAddress = `TG_${telegramUser.id}`;
  }

  const fetchTournamentData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [tournamentRes, leaderboardRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/tournament/current`),
        fetch(`${BACKEND_URL}/api/leaderboard`)
      ]);
      
      if (tournamentRes.ok) {
        const data = await tournamentRes.json();
        setTournament(data);
      }
      
      if (leaderboardRes.ok) {
        const leaderboard = await leaderboardRes.json();
        setQualifiedPlayers(leaderboard.slice(0, 8));
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching tournament data:', err);
      setError('Failed to load tournament data');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTournamentData();
    const interval = setInterval(fetchTournamentData, 30000);
    return () => clearInterval(interval);
  }, [fetchTournamentData]);

  // Check if current user is qualified
  const userQualificationRank = qualifiedPlayers.findIndex(p => 
    p.address?.toLowerCase() === playerAddress?.toLowerCase()
  ) + 1;
  const isUserQualified = userQualificationRank > 0 && userQualificationRank <= 8;

  return (
    <div className="lab-container min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/10 via-transparent to-transparent" />
      
      <div className="relative z-10 p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back to Menu</span>
          </Link>
          <Badge className="bg-slate-800 text-slate-300 border-slate-600">
            Season 1
          </Badge>
        </div>

        {/* Tournament Hero */}
        <div className="text-center mb-8">
          <TournamentLogo />
          <h1 className="text-2xl sm:text-4xl font-bold text-white mt-4 mb-2">
            Treat Masters
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
              Champions League
            </span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto">
            The ultimate knockout tournament. Only the Top 8 qualify. Only one takes the crown.
          </p>
        </div>

        {/* Tournament Status & Prize */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Status Card */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Status</div>
                  <div className="text-white font-bold">
                    {tournament?.status === 'active' ? 'Tournament Active' : 'Qualification Phase'}
                  </div>
                </div>
              </div>
              {tournament?.tournament_starts && (
                <CountdownTimer 
                  targetDate={tournament.tournament_starts} 
                  label="Tournament Begins In"
                />
              )}
            </CardContent>
          </Card>

          {/* Prize Card - GREEN Theme */}
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <div className="text-xs text-green-400/70 uppercase tracking-wider">Grand Prize</div>
                  <div className="text-green-400 font-bold text-lg">$LAB / DOGE</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-300/70">
                <Crown className="w-4 h-4" />
                <span>+ Treat Masters Champion Title</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Qualification Status */}
        {playerAddress && (
          <Card className={`mb-8 ${
            isUserQualified 
              ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/5 border-green-500/30' 
              : 'bg-slate-800/50 border-slate-700/50'
          } backdrop-blur`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    isUserQualified ? 'bg-green-500/20' : 'bg-slate-700'
                  }`}>
                    {isUserQualified ? (
                      <CircleDot className="w-7 h-7 text-green-400" />
                    ) : (
                      <Users className="w-7 h-7 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${isUserQualified ? 'text-green-400' : 'text-white'}`}>
                      {isUserQualified ? "You're Qualified!" : "Not Yet Qualified"}
                    </div>
                    <div className="text-sm text-slate-400">
                      {isUserQualified 
                        ? `Seed #${userQualificationRank} — You're in the Top 8!` 
                        : 'Climb to Top 8 on the leaderboard to qualify'}
                    </div>
                  </div>
                </div>
                {!isUserQualified && (
                  <Link to="/lab">
                    <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold">
                      <Beaker className="w-4 h-4 mr-2" /> Play Now
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tournament Bracket */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur mb-8">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-white flex items-center gap-2">
              <Swords className="w-5 h-5 text-purple-400" />
              Tournament Bracket
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400">Loading bracket...</p>
              </div>
            ) : (
              <TournamentBracket matches={tournament?.matches || []} />
            )}
          </CardContent>
        </Card>

        {/* Qualified Players */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur mb-8">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-green-400" />
              Qualified Scientists
              <Badge variant="outline" className="ml-2 text-xs border-green-500/50 text-green-400">
                Top 8
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Loading...</p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {qualifiedPlayers.map((player, index) => (
                  <QualificationCard
                    key={player.address || index}
                    rank={index + 1}
                    player={player}
                    isQualified={index < 8}
                    isCurrentUser={player.address?.toLowerCase() === playerAddress?.toLowerCase()}
                  />
                ))}
                {qualifiedPlayers.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-slate-500">
                    No players on the leaderboard yet
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tournament Rules */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur mb-8">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid sm:grid-cols-3 gap-4">
              {/* Qualification */}
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <h4 className="text-white font-bold mb-2">Qualification</h4>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• Top 8 leaderboard players qualify</li>
                  <li>• Tournament starts 2 weeks before season end</li>
                  <li>• Higher seeds earn better matchups</li>
                </ul>
              </div>
              
              {/* Match Rules */}
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center mb-3">
                  <Timer className="w-5 h-5 text-purple-400" />
                </div>
                <h4 className="text-white font-bold mb-2">48h Battles</h4>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• Each match runs for 48 hours</li>
                  <li>• Treats created + Points earned count</li>
                  <li>• Counters reset each matchup</li>
                </ul>
              </div>
              
              {/* Winner */}
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center mb-3">
                  <Trophy className="w-5 h-5 text-green-400" />
                </div>
                <h4 className="text-white font-bold mb-2">Victory</h4>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• Higher combined score wins</li>
                  <li>• No luck. Pure execution.</li>
                  <li>• Champion crowned in finals</li>
                </ul>
              </div>
            </div>
            
            {/* Stage Progress */}
            <div className="mt-6 flex items-center justify-center gap-2 overflow-x-auto pb-2">
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-full px-4 py-2">
                <span className="text-lg">🧪</span>
                <span className="text-xs text-blue-400 font-medium whitespace-nowrap">Quarterfinals (8→4)</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
              <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-full px-4 py-2">
                <span className="text-lg">⚗️</span>
                <span className="text-xs text-purple-400 font-medium whitespace-nowrap">Semifinals (4→2)</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2">
                <span className="text-lg">👑</span>
                <span className="text-xs text-green-400 font-medium whitespace-nowrap">Grand Final</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-slate-500 text-xs">
            Treat Masters Champions League • Season 1 • DogeFood Lab
          </p>
        </div>
      </div>
      
      {/* Music Player */}
      <MusicPlayer />
    </div>
  );
};

export default Tournament;
