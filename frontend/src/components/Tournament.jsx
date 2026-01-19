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
  ChevronRight, Beaker, Star, Timer, Award, Zap
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Tournament Logo
const TournamentLogo = () => (
  <img 
    src="https://customer-assets.emergentagent.com/job_audiorank-verify/artifacts/hv29xyhs_file_000000005ed071f8953e51b83d154e97.png"
    alt="Treat Masters Champions League"
    className="w-full max-w-[200px] mx-auto"
  />
);

// Countdown Timer Component
const CountdownTimer = ({ targetDate, label }) => {
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
    return <span className="text-red-400 font-bold">ENDED</span>;
  }
  
  return (
    <div className="text-center">
      {label && <div className="text-xs text-white/60 mb-1">{label}</div>}
      <div className="flex gap-1 justify-center">
        {timeLeft.days > 0 && (
          <div className="bg-slate-700/50 rounded px-2 py-1">
            <span className="text-lg font-bold text-white">{timeLeft.days}</span>
            <span className="text-xs text-white/60 ml-0.5">d</span>
          </div>
        )}
        <div className="bg-slate-700/50 rounded px-2 py-1">
          <span className="text-lg font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
          <span className="text-xs text-white/60 ml-0.5">h</span>
        </div>
        <div className="bg-slate-700/50 rounded px-2 py-1">
          <span className="text-lg font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
          <span className="text-xs text-white/60 ml-0.5">m</span>
        </div>
        <div className="bg-slate-700/50 rounded px-2 py-1">
          <span className="text-lg font-bold text-white">{String(timeLeft.seconds).padStart(2, '0')}</span>
          <span className="text-xs text-white/60 ml-0.5">s</span>
        </div>
      </div>
    </div>
  );
};

// Match Card Component
const MatchCard = ({ match, stage }) => {
  const stageColors = {
    quarterfinal: 'from-blue-500/20 to-cyan-500/20 border-blue-400/30',
    semifinal: 'from-purple-500/20 to-pink-500/20 border-purple-400/30',
    final: 'from-amber-500/20 to-orange-500/20 border-amber-400/30'
  };
  
  const isActive = match.status === 'active';
  const isCompleted = match.status === 'completed';
  
  return (
    <div className={`bg-gradient-to-br ${stageColors[stage]} rounded-xl border p-3 ${isActive ? 'ring-2 ring-green-400 animate-pulse-slow' : ''}`}>
      {/* Match Header */}
      <div className="flex justify-between items-center mb-2">
        <Badge variant="outline" className={`text-xs ${isActive ? 'bg-green-500/20 text-green-400 border-green-400' : isCompleted ? 'bg-slate-500/20 text-slate-400' : 'bg-slate-700/50 text-slate-300'}`}>
          {isActive ? '🔴 LIVE' : isCompleted ? '✓ Complete' : '⏳ Upcoming'}
        </Badge>
        {match.match_number && (
          <span className="text-xs text-white/50">Match {match.match_number}</span>
        )}
      </div>
      
      {/* Players */}
      <div className="space-y-2">
        {/* Player 1 */}
        <div className={`flex items-center justify-between p-2 rounded-lg ${match.winner_id === match.player1?.id ? 'bg-green-500/20 border border-green-400/30' : 'bg-slate-700/30'}`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-400">#{match.player1?.seed || '?'}</span>
            <span className="text-white font-medium text-sm truncate max-w-[100px]">
              {match.player1?.nickname || 'TBD'}
            </span>
            {match.winner_id === match.player1?.id && <Crown className="w-4 h-4 text-amber-400" />}
          </div>
          <div className="text-right">
            <div className="text-xs text-white/60">
              {match.player1_treats || 0} <Beaker className="w-3 h-3 inline" />
            </div>
            <div className="text-sm font-bold text-white">{match.player1_points || 0} pts</div>
          </div>
        </div>
        
        {/* VS Divider */}
        <div className="flex items-center justify-center">
          <div className="flex-1 h-px bg-white/10" />
          <span className="px-2 text-xs text-white/40 font-bold">VS</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        
        {/* Player 2 */}
        <div className={`flex items-center justify-between p-2 rounded-lg ${match.winner_id === match.player2?.id ? 'bg-green-500/20 border border-green-400/30' : 'bg-slate-700/30'}`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-400">#{match.player2?.seed || '?'}</span>
            <span className="text-white font-medium text-sm truncate max-w-[100px]">
              {match.player2?.nickname || 'TBD'}
            </span>
            {match.winner_id === match.player2?.id && <Crown className="w-4 h-4 text-amber-400" />}
          </div>
          <div className="text-right">
            <div className="text-xs text-white/60">
              {match.player2_treats || 0} <Beaker className="w-3 h-3 inline" />
            </div>
            <div className="text-sm font-bold text-white">{match.player2_points || 0} pts</div>
          </div>
        </div>
      </div>
      
      {/* Match Timer */}
      {isActive && match.end_time && (
        <div className="mt-3 pt-2 border-t border-white/10">
          <CountdownTimer targetDate={match.end_time} label="Match ends in" />
        </div>
      )}
    </div>
  );
};

// Qualification Card
const QualificationCard = ({ rank, player, isQualified, isCurrentUser }) => (
  <div className={`flex items-center justify-between p-3 rounded-xl ${
    isCurrentUser ? 'bg-amber-500/20 border border-amber-400/50' : 
    isQualified ? 'bg-green-500/10 border border-green-400/30' : 'bg-slate-700/30 border border-slate-600/30'
  }`}>
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
        rank <= 3 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' : 
        isQualified ? 'bg-green-500/30 text-green-400' : 'bg-slate-600 text-slate-300'
      }`}>
        {rank}
      </div>
      <div>
        <div className="text-white font-medium text-sm">{player.nickname || 'Anonymous'}</div>
        <div className="text-xs text-white/50">{player.points?.toLocaleString()} pts</div>
      </div>
    </div>
    {isQualified && (
      <Badge className="bg-green-500/20 text-green-400 border-green-400/50">
        Qualified
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
      
      // Fetch current tournament
      const tournamentRes = await fetch(`${BACKEND_URL}/api/tournament/current`);
      if (tournamentRes.ok) {
        const data = await tournamentRes.json();
        setTournament(data);
      }
      
      // Fetch qualified players (top 8 from leaderboard)
      const leaderboardRes = await fetch(`${BACKEND_URL}/api/leaderboard`);
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
    // Refresh every 30 seconds
    const interval = setInterval(fetchTournamentData, 30000);
    return () => clearInterval(interval);
  }, [fetchTournamentData]);

  // Check if current user is qualified
  const userQualificationRank = qualifiedPlayers.findIndex(p => 
    p.address?.toLowerCase() === playerAddress?.toLowerCase()
  ) + 1;
  const isUserQualified = userQualificationRank > 0 && userQualificationRank <= 8;

  return (
    <div className="lab-container min-h-screen p-4 sm:p-8">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 opacity-90" />
      
      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </Link>
        </div>

        {/* Tournament Hero */}
        <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-amber-500/30 mb-6 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9IjAuMDMiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50" />
          
          <CardContent className="p-6 relative">
            <div className="text-center mb-4">
              <TournamentLogo />
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 mb-2">
              Treat Masters Champions League
            </h1>
            <p className="text-white/60 text-center text-sm mb-4">
              In-Season Knockout Tournament | Only the Top 8 Qualify
            </p>
            
            {/* Tournament Status */}
            <div className="flex flex-wrap justify-center gap-3 mb-4">
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-400/50 px-3 py-1">
                <Trophy className="w-3 h-3 mr-1" /> Season 1
              </Badge>
              <Badge className={`px-3 py-1 ${tournament?.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-400/50' : 'bg-blue-500/20 text-blue-400 border-blue-400/50'}`}>
                <Clock className="w-3 h-3 mr-1" /> {tournament?.status === 'active' ? 'In Progress' : 'Qualification Phase'}
              </Badge>
            </div>
            
            {/* Prize Pool */}
            <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 rounded-xl p-4 border border-amber-400/30">
              <div className="text-center">
                <div className="text-xs text-amber-300/70 uppercase tracking-wider mb-1">Grand Prize</div>
                <div className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                  🏆 $LAB / DOGE Rewards
                </div>
                <div className="text-xs text-white/50 mt-1">+ Treat Masters Champion Title</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Qualification Status */}
        {playerAddress && (
          <Card className={`mb-6 ${isUserQualified ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-green-400/30' : 'bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-600/30'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isUserQualified ? (
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Star className="w-6 h-6 text-green-400" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                      <Users className="w-6 h-6 text-slate-400" />
                    </div>
                  )}
                  <div>
                    <div className="text-white font-bold">
                      {isUserQualified ? "You're Qualified!" : "Not Yet Qualified"}
                    </div>
                    <div className="text-sm text-white/60">
                      {isUserQualified 
                        ? `Rank #${userQualificationRank} - You're in the Top 8!` 
                        : 'Climb to Top 8 on the leaderboard to qualify'}
                    </div>
                  </div>
                </div>
                {!isUserQualified && (
                  <Link to="/lab">
                    <Button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                      <Beaker className="w-4 h-4 mr-1" /> Play Now
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Qualified Players */}
        <Card className="bg-slate-800/90 border-slate-600/30 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Qualified Scientists
              <Badge variant="outline" className="ml-2 text-xs">Top 8</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-white/60 text-sm">Loading...</p>
              </div>
            ) : (
              <div className="grid gap-2">
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
                  <div className="text-center py-8 text-white/50">
                    No players on the leaderboard yet
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tournament Bracket */}
        {tournament?.matches && tournament.matches.length > 0 && (
          <Card className="bg-slate-800/90 border-slate-600/30 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-purple-400" />
                Tournament Bracket
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Quarterfinals */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
                  <Beaker className="w-4 h-4" /> Quarterfinals
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tournament.matches.filter(m => m.stage === 'quarterfinal').map((match, i) => (
                    <MatchCard key={match.id || i} match={match} stage="quarterfinal" />
                  ))}
                </div>
              </div>
              
              {/* Semifinals */}
              {tournament.matches.some(m => m.stage === 'semifinal') && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-purple-400 mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Semifinals
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tournament.matches.filter(m => m.stage === 'semifinal').map((match, i) => (
                      <MatchCard key={match.id || i} match={match} stage="semifinal" />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Final */}
              {tournament.matches.some(m => m.stage === 'final') && (
                <div>
                  <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                    <Crown className="w-4 h-4" /> Grand Final
                  </h3>
                  <div className="max-w-md mx-auto">
                    {tournament.matches.filter(m => m.stage === 'final').map((match, i) => (
                      <MatchCard key={match.id || i} match={match} stage="final" />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tournament Rules */}
        <Card className="bg-slate-800/90 border-slate-600/30 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-cyan-400" />
              Tournament Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Format */}
            <div className="bg-slate-700/30 rounded-xl p-4">
              <h4 className="text-white font-bold mb-2 flex items-center gap-2">
                <Swords className="w-4 h-4 text-purple-400" /> Knockout Format
              </h4>
              <div className="text-sm text-white/70 space-y-1">
                <p>• #1 vs #8 | #2 vs #7 | #3 vs #6 | #4 vs #5</p>
                <p>• Higher seeds earn placement, but advancement must be earned</p>
              </div>
            </div>
            
            {/* Match Rules */}
            <div className="bg-slate-700/30 rounded-xl p-4">
              <h4 className="text-white font-bold mb-2 flex items-center gap-2">
                <Timer className="w-4 h-4 text-blue-400" /> 48-Hour Battles
              </h4>
              <div className="text-sm text-white/70 space-y-1">
                <p>• Each matchup runs for 48 hours</p>
                <p>• Both Treats created AND Points earned count</p>
                <p>• Counters reset at the start of each matchup</p>
              </div>
            </div>
            
            {/* Winner Determination */}
            <div className="bg-slate-700/30 rounded-xl p-4">
              <h4 className="text-white font-bold mb-2 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" /> Winner Determination
              </h4>
              <div className="text-sm text-white/70 space-y-1">
                <p>• Higher combined performance (Treats + Points) wins</p>
                <p>• No luck. No retries. Pure execution.</p>
              </div>
            </div>
            
            {/* Stages */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">🧪</div>
                <div className="text-xs text-blue-400 font-bold">Quarterfinals</div>
                <div className="text-xs text-white/50">8 → 4</div>
              </div>
              <div className="bg-purple-500/10 border border-purple-400/30 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">⚗️</div>
                <div className="text-xs text-purple-400 font-bold">Semifinals</div>
                <div className="text-xs text-white/50">4 → 2</div>
              </div>
              <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">🧠</div>
                <div className="text-xs text-amber-400 font-bold">Grand Final</div>
                <div className="text-xs text-white/50">2 → 👑</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-white/40 text-xs">
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
