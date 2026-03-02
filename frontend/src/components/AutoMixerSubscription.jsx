import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { format, addDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { INGREDIENT_ICONS, getIngredientIcon } from '../config/ingredientIcons';
import { 
  Bot, 
  Clock, 
  Calendar as CalendarIcon, 
  CreditCard, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  TrendingUp,
  Flame,
  Users,
  DollarSign,
  Timer,
  Settings,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Beaker,
  CalendarDays,
  X,
  Bell
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Time slots for the 24-hour clock selector
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const formatHour = (hour) => {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${ampm}`;
};

const TimeWindowSelector = ({ startHour, endHour, onStartChange, onEndChange, disabled, isDark }) => {
  const calculateDuration = () => {
    if (endHour > startHour) {
      return endHour - startHour;
    }
    return (24 - startHour) + endHour;
  };

  const duration = calculateDuration();
  const isValid = duration >= 1 && duration <= 6;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>Start Time (UTC)</label>
          <select
            value={startHour}
            onChange={(e) => onStartChange(parseInt(e.target.value))}
            disabled={disabled}
            className={`w-full p-3 rounded-xl border-2 transition-all disabled:opacity-50 ${
              isDark 
                ? 'border-sky-700 bg-slate-800 text-white focus:border-sky-500 focus:ring-sky-800' 
                : 'border-sky-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-sky-200'
            }`}
            data-testid="auto-mixer-start-hour"
          >
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {formatHour(hour)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>End Time (UTC)</label>
          <select
            value={endHour}
            onChange={(e) => onEndChange(parseInt(e.target.value))}
            disabled={disabled}
            className={`w-full p-3 rounded-xl border-2 transition-all disabled:opacity-50 ${
              isDark 
                ? 'border-sky-700 bg-slate-800 text-white focus:border-sky-500 focus:ring-sky-800' 
                : 'border-sky-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-sky-200'
            }`}
            data-testid="auto-mixer-end-hour"
          >
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {formatHour(hour)}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Visual timeline */}
      <div className={`relative h-12 rounded-xl overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-gradient-to-r from-slate-100 to-slate-200'}`}>
        <div 
          className={`absolute h-full transition-all duration-300 ${isValid ? 'bg-gradient-to-r from-sky-400 to-blue-500' : 'bg-red-400'}`}
          style={{
            left: `${(startHour / 24) * 100}%`,
            width: endHour > startHour 
              ? `${((endHour - startHour) / 24) * 100}%`
              : `${((24 - startHour + endHour) / 24) * 100}%`
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${isValid ? 'text-white' : 'text-red-800'}`}>
            {duration}h window
          </span>
        </div>
      </div>
      
      {!isValid && (
        <p className="text-red-500 text-sm flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          Window must be 1-6 hours
        </p>
      )}
    </div>
  );
};

const DateSelector = ({ selectedDates, onDatesChange, isDark }) => {
  const [isOpen, setIsOpen] = useState(false);
  const today = startOfDay(new Date());
  const maxDate = addDays(today, 30); // Can schedule up to 30 days ahead

  const handleSelect = (dates) => {
    onDatesChange(dates || []);
  };

  const removeDate = (dateToRemove) => {
    onDatesChange(selectedDates.filter(d => d.getTime() !== dateToRemove.getTime()));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className={`text-sm font-medium ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>
          Schedule Specific Days (Optional)
        </label>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`gap-2 ${isDark ? 'border-sky-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-sky-200 hover:bg-sky-50'}`}
              data-testid="open-calendar-btn"
            >
              <CalendarIcon className="w-4 h-4" />
              Select Dates
            </Button>
          </PopoverTrigger>
          <PopoverContent className={`w-auto p-0 ${isDark ? 'bg-slate-800 border-slate-700' : ''}`} align="end">
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={handleSelect}
              disabled={(date) => isBefore(date, today) || isAfter(date, maxDate)}
              className={isDark ? 'bg-slate-800 text-white' : ''}
              data-testid="date-calendar"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected dates display */}
      {selectedDates.length > 0 && (
        <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-sky-50 border border-sky-200'}`}>
          <div className={`text-sm font-medium mb-2 ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>
            Selected Days ({selectedDates.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedDates.sort((a, b) => a - b).map((date) => (
              <Badge
                key={date.toISOString()}
                variant="secondary"
                className={`gap-1 ${isDark ? 'bg-sky-900 text-sky-200 hover:bg-sky-800' : 'bg-sky-100 text-sky-800 hover:bg-sky-200'}`}
              >
                {format(date, 'MMM d')}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => removeDate(date)}
                />
              </Badge>
            ))}
          </div>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Auto-mixing will only run on these specific days during your time window.
            Leave empty to run every day.
          </p>
        </div>
      )}

      {selectedDates.length === 0 && (
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          No specific days selected. Auto-mixing will run every day during your time window.
        </p>
      )}
    </div>
  );
};

const FundsBreakdown = ({ stats, isDark }) => {
  return (
    <Card className={`border-2 ${isDark ? 'bg-emerald-900/30 border-emerald-700' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
          <TrendingUp className="w-5 h-5" />
          Fund Distribution (Real-time)
        </CardTitle>
        <p className={`text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
          Transparent allocation of subscription fees
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-slate-800 border-emerald-700' : 'bg-white border-emerald-200'}`}>
            <DollarSign className={`w-6 h-6 mx-auto mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <div className={`text-2xl font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>{stats.total_received_doge}</div>
            <div className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Total DOGE</div>
          </div>
          
          <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-rose-900/30 border-rose-700' : 'bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200'}`}>
            <Flame className={`w-6 h-6 mx-auto mb-2 ${isDark ? 'text-rose-400' : 'text-rose-600'}`} />
            <div className={`text-2xl font-bold ${isDark ? 'text-rose-300' : 'text-rose-800'}`}>{stats.buy_burn_amount}</div>
            <div className={`text-xs ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>Buy & Burn ({stats.buy_burn_percent}%)</div>
          </div>
          
          <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-purple-900/30 border-purple-700' : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200'}`}>
            <Users className={`w-6 h-6 mx-auto mb-2 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <div className={`text-2xl font-bold ${isDark ? 'text-purple-300' : 'text-purple-800'}`}>{stats.dev_amount}</div>
            <div className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Dev Fund ({stats.dev_percent}%)</div>
          </div>
          
          <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-blue-900/30 border-blue-700' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200'}`}>
            <Bot className={`w-6 h-6 mx-auto mb-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <div className={`text-2xl font-bold ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>{stats.total_auto_mixes}</div>
            <div className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Total Auto-Mixes</div>
          </div>
        </div>
        
        <div className={`mt-4 flex items-center justify-between text-sm p-3 rounded-lg ${isDark ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            Active Subscribers: {stats.active_subscribers}
          </span>
          <span>Total Subscribers: {stats.total_subscribers}</span>
        </div>
      </CardContent>
    </Card>
  );
};

// Rarity colors for badges
const RARITY_COLORS = {
  Common: { bg: 'bg-gray-100', text: 'text-gray-700', dark_bg: 'bg-gray-800', dark_text: 'text-gray-300' },
  Uncommon: { bg: 'bg-green-100', text: 'text-green-700', dark_bg: 'bg-green-900/50', dark_text: 'text-green-300' },
  Rare: { bg: 'bg-blue-100', text: 'text-blue-700', dark_bg: 'bg-blue-900/50', dark_text: 'text-blue-300' },
  Epic: { bg: 'bg-purple-100', text: 'text-purple-700', dark_bg: 'bg-purple-900/50', dark_text: 'text-purple-300' },
  Legendary: { bg: 'bg-amber-100', text: 'text-amber-700', dark_bg: 'bg-amber-900/50', dark_text: 'text-amber-300' },
  Mythic: { bg: 'bg-rose-100', text: 'text-rose-700', dark_bg: 'bg-rose-900/50', dark_text: 'text-rose-300' }
};

// Agent Stats Card Component - Professional detailed view
const AgentStatsCard = ({ agentStatus, playerStats, isDark }) => {
  if (!agentStatus) return null;

  const statusColor = agentStatus.agent_status === 'ACTIVE' 
    ? (isDark ? 'text-green-400' : 'text-green-600')
    : (isDark ? 'text-red-400' : 'text-red-600');

  return (
    <Card className={`border-2 ${isDark ? 'bg-slate-900/80 border-sky-700' : 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200'}`} data-testid="agent-stats-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-sky-300' : 'text-sky-800'}`}>
            <Bot className="w-6 h-6" />
            Auto-Mixer Agent Status
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
              agentStatus.agent_status === 'ACTIVE' 
                ? (isDark ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700')
                : (isDark ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700')
            }`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${
                agentStatus.agent_status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'
              }`}></span>
              {agentStatus.agent_status}
            </span>
          </div>
        </div>
        <p className={`text-sm ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>
          Real-time monitoring of the mixing automation system
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Agent Performance Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-slate-800 border-sky-700' : 'bg-white border-sky-200'}`}>
            <Timer className={`w-5 h-5 mx-auto mb-2 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
            <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{agentStatus.run_interval_minutes}min</div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Run Interval</div>
          </div>
          
          <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-slate-800 border-sky-700' : 'bg-white border-sky-200'}`}>
            <Users className={`w-5 h-5 mx-auto mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <div className={`text-xl font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{agentStatus.subscribers?.total_active || 0}</div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Active Subs</div>
          </div>
          
          <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-slate-800 border-sky-700' : 'bg-white border-sky-200'}`}>
            <Zap className={`w-5 h-5 mx-auto mb-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            <div className={`text-xl font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{agentStatus.subscribers?.currently_in_window || 0}</div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>In Window Now</div>
          </div>
          
          <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-slate-800 border-sky-700' : 'bg-white border-sky-200'}`}>
            <Beaker className={`w-5 h-5 mx-auto mb-2 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <div className={`text-xl font-bold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{agentStatus.activity_24h?.total_mixes || 0}</div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Mixes (24h)</div>
          </div>
        </div>

        {/* Activity Stats */}
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h4 className={`font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <TrendingUp className="w-4 h-4" />
            24-Hour Activity
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className={`text-2xl font-bold ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>
                {agentStatus.activity_24h?.total_mixes || 0}
              </div>
              <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Total Mixes</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                {agentStatus.activity_24h?.total_points_awarded || 0}
              </div>
              <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Points Awarded</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                {agentStatus.activity_24h?.total_xp_awarded || 0}
              </div>
              <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>XP Awarded</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                {agentStatus.activity_24h?.avg_mixes_per_hour || 0}
              </div>
              <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Avg/Hour</div>
            </div>
          </div>
        </div>

        {/* Rarity Distribution */}
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h4 className={`font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Rarity Distribution (24h)
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(agentStatus.rarity_distribution_24h || {}).map(([rarity, count]) => {
              const colors = RARITY_COLORS[rarity] || RARITY_COLORS.Common;
              return (
                <span 
                  key={rarity}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    isDark ? `${colors.dark_bg} ${colors.dark_text}` : `${colors.bg} ${colors.text}`
                  }`}
                >
                  {rarity}: {count}
                </span>
              );
            })}
          </div>
        </div>

        {/* Top Ingredients */}
        {agentStatus.top_ingredients_7d && agentStatus.top_ingredients_7d.length > 0 && (
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h4 className={`font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Flame className="w-4 h-4" />
              Most Used Ingredients (7 Days)
            </h4>
            <div className="space-y-2">
              {agentStatus.top_ingredients_7d.slice(0, 5).map((item, idx) => {
                const ingredientIcon = getIngredientIcon(item.ingredient_id);
                const ingredientData = INGREDIENT_ICONS[item.ingredient_id];
                return (
                  <div key={item.ingredient_id} className="flex items-center gap-2">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                      isDark ? 'bg-sky-900 text-sky-300' : 'bg-sky-100 text-sky-700'
                    }`}>
                      {idx + 1}
                    </span>
                    {ingredientIcon ? (
                      <img 
                        src={ingredientIcon} 
                        alt={ingredientData?.name || item.name || item.ingredient_id}
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="w-8 h-8 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-lg text-sm">
                        ?
                      </span>
                    )}
                    <span className={`flex-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {ingredientData?.name || item.name || item.ingredient_id}
                    </span>
                    <span className={`font-semibold ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>
                      {item.usage_count}x
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* System Info */}
        <div className={`p-3 rounded-lg text-sm ${isDark ? 'bg-slate-800/30 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Current: {agentStatus.current_hour_utc}:00 UTC
            </span>
            <span className="flex items-center gap-1">
              <RefreshCw className="w-4 h-4" />
              Next run: {new Date(agentStatus.next_run_time_utc).toLocaleTimeString()}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              {agentStatus.performance?.uptime_status || 'healthy'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Player's Personal Auto-Mixer Stats
const PlayerMixerStats = ({ stats, isDark }) => {
  if (!stats || !stats.has_subscription) return null;

  return (
    <Card className={`border-2 ${isDark ? 'bg-indigo-900/30 border-indigo-700' : 'bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200'}`} data-testid="player-mixer-stats">
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>
          <TrendingUp className="w-5 h-5" />
          Your Auto-Mixer Performance
        </CardTitle>
        <p className={`text-sm ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
          Personal mixing statistics and history
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subscription Status Bar */}
        <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800 border-indigo-700' : 'bg-white border-indigo-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
              Subscription Progress
            </span>
            <span className={`text-sm ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
              {stats.subscription?.days_remaining || 0} days left
            </span>
          </div>
          <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-indigo-100'}`}>
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
              style={{ width: `${100 - (stats.subscription?.progress_percent || 0)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className={`flex items-center gap-1 ${
              stats.subscription?.currently_in_window 
                ? (isDark ? 'text-green-400' : 'text-green-600')
                : (isDark ? 'text-slate-400' : 'text-slate-500')
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                stats.subscription?.currently_in_window ? 'bg-green-500 animate-pulse' : 'bg-slate-400'
              }`}></span>
              {stats.subscription?.currently_in_window ? 'Mixing Active' : 'Outside Window'}
            </span>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              Window: {stats.subscription?.window_start || 0}:00 - {stats.subscription?.window_end || 6}:00 UTC
            </span>
          </div>
        </div>

        {/* Lifetime Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800 border-indigo-700' : 'bg-white border-indigo-200'}`}>
            <div className={`text-2xl font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
              {stats.lifetime_stats?.total_mixes || 0}
            </div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Total Mixes</div>
          </div>
          <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800 border-indigo-700' : 'bg-white border-indigo-200'}`}>
            <div className={`text-2xl font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
              {stats.lifetime_stats?.total_points_earned || 0}
            </div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Points Earned</div>
          </div>
          <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800 border-indigo-700' : 'bg-white border-indigo-200'}`}>
            <div className={`text-2xl font-bold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
              {stats.lifetime_stats?.total_xp_earned || 0}
            </div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>XP Earned</div>
          </div>
          <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800 border-indigo-700' : 'bg-white border-indigo-200'}`}>
            <div className={`text-2xl font-bold ${
              isDark 
                ? RARITY_COLORS[stats.lifetime_stats?.best_rarity]?.dark_text || 'text-white'
                : RARITY_COLORS[stats.lifetime_stats?.best_rarity]?.text || 'text-slate-700'
            }`}>
              {stats.lifetime_stats?.best_rarity || 'None'}
            </div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Best Rarity</div>
          </div>
        </div>

        {/* Rarity Breakdown */}
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h4 className={`font-semibold mb-3 text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Your Rarity Collection
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.rarity_breakdown || {}).map(([rarity, count]) => {
              const colors = RARITY_COLORS[rarity] || RARITY_COLORS.Common;
              return (
                <span 
                  key={rarity}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    isDark ? `${colors.dark_bg} ${colors.dark_text}` : `${colors.bg} ${colors.text}`
                  }`}
                >
                  {rarity}: {count}
                </span>
              );
            })}
          </div>
        </div>

        {/* Recent Mixes */}
        {stats.recent_mixes && stats.recent_mixes.length > 0 && (
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h4 className={`font-semibold mb-3 text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Recent Auto-Mixes
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {stats.recent_mixes.slice(0, 5).map((mix, idx) => {
                const colors = RARITY_COLORS[mix.treat_rarity] || RARITY_COLORS.Common;
                return (
                  <div 
                    key={mix.id || idx}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      isDark ? 'bg-slate-700/50' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        isDark ? `${colors.dark_bg} ${colors.dark_text}` : `${colors.bg} ${colors.text}`
                      }`}>
                        {mix.treat_rarity}
                      </span>
                      <span className={`text-sm ${isDark ? 'text-white' : 'text-slate-700'}`}>
                        {mix.treat_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>
                        +{mix.points_earned} pts
                      </span>
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                        {mix.time_ago}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AutoMixerSubscription = ({ playerAddress, playerNickname, isDarkMode = false }) => {
  const [config, setConfig] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [fundsStats, setFundsStats] = useState(null);
  const [agentStatus, setAgentStatus] = useState(null);
  const [playerStats, setPlayerStats] = useState(null);
  const [mixHistory, setMixHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Window selection state
  const [windowStart, setWindowStart] = useState(9);  // Default 9 AM
  const [windowEnd, setWindowEnd] = useState(15);     // Default 3 PM
  const [selectedDates, setSelectedDates] = useState([]);

  const isDark = isDarkMode;

  const fetchData = useCallback(async () => {
    try {
      // Always fetch config, stats, and agent status
      const [configRes, statsRes, agentRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/auto-mixer/config`),
        fetch(`${BACKEND_URL}/api/auto-mixer/funds-stats`),
        fetch(`${BACKEND_URL}/api/auto-mixer/agent-status`)
      ]);

      if (configRes.ok) {
        setConfig(await configRes.json());
      }

      if (statsRes.ok) {
        setFundsStats(await statsRes.json());
      }

      if (agentRes.ok) {
        setAgentStatus(await agentRes.json());
      }

      // Only fetch player-specific data if playerAddress is provided
      if (playerAddress) {
        const subRes = await fetch(`${BACKEND_URL}/api/auto-mixer/subscription/${playerAddress}`);
        if (subRes.ok) {
          const subData = await subRes.json();
          setSubscription(subData.subscription);
          if (subData.subscription) {
            setWindowStart(subData.subscription.window_start_hour);
            setWindowEnd(subData.subscription.window_end_hour);
            if (subData.subscription.scheduled_dates) {
              setSelectedDates(subData.subscription.scheduled_dates.map(d => new Date(d)));
            }
          }
        }

        // Fetch player-specific detailed stats if there's an active subscription
        if (subscription?.status === 'active') {
          const [historyRes, playerStatsRes] = await Promise.all([
            fetch(`${BACKEND_URL}/api/auto-mixer/history/${playerAddress}`),
            fetch(`${BACKEND_URL}/api/auto-mixer/detailed-stats/${playerAddress}`)
          ]);
          
          if (historyRes.ok) {
            const historyData = await historyRes.json();
            setMixHistory(historyData.history || []);
          }
          
          if (playerStatsRes.ok) {
            setPlayerStats(await playerStatsRes.json());
          }
        }
      }
    } catch (err) {
      console.error('Error fetching auto-mixer data:', err);
    } finally {
      setLoading(false);
    }
  }, [playerAddress, subscription?.status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for stats every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [statsRes, agentRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/auto-mixer/funds-stats`),
          fetch(`${BACKEND_URL}/api/auto-mixer/agent-status`)
        ]);
        
        if (statsRes.ok) {
          setFundsStats(await statsRes.json());
        }
        if (agentRes.ok) {
          setAgentStatus(await agentRes.json());
        }
        
        // Update player stats if subscribed
        if (playerAddress && subscription?.status === 'active') {
          const playerStatsRes = await fetch(`${BACKEND_URL}/api/auto-mixer/detailed-stats/${playerAddress}`);
          if (playerStatsRes.ok) {
            setPlayerStats(await playerStatsRes.json());
          }
        }
      } catch (err) {
        console.error('Error polling stats:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [playerAddress, subscription?.status]);

  const handleCreateSubscription = async () => {
    setCreating(true);
    setError('');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/auto-mixer/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_address: playerAddress,
          window_start_hour: windowStart,
          window_end_hour: windowEnd,
          scheduled_dates: selectedDates.map(d => d.toISOString())
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create subscription');
      }

      setSubscription(data.subscription);
      setSuccess('Subscription created! Please send payment to activate.');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!txHash.trim()) {
      setError('Please enter the transaction hash');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/auto-mixer/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_id: subscription.id,
          tx_hash: txHash.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Payment verification failed');
      }

      setSubscription(data.subscription);
      
      if (data.is_confirmed) {
        setSuccess('Payment verified! Your auto-mixer is now active.');
      } else {
        setSuccess(`Payment found with ${data.confirmations}/${data.required_confirmations} confirmations. Please wait for more confirmations.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleUpdateWindow = async () => {
    setUpdating(true);
    setError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/auto-mixer/update-window`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_id: subscription.id,
          player_address: playerAddress,
          window_start_hour: windowStart,
          window_end_hour: windowEnd,
          scheduled_dates: selectedDates.map(d => d.toISOString())
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to update window');
      }

      setSubscription(data.subscription);
      setSuccess('Mixing schedule updated successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const calculateWindowDuration = () => {
    if (windowEnd > windowStart) {
      return windowEnd - windowStart;
    }
    return (24 - windowStart) + windowEnd;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Failed to load auto-mixer configuration
      </div>
    );
  }

  const isWindowValid = calculateWindowDuration() >= 1 && calculateWindowDuration() <= 6;
  const hasActiveSubscription = subscription?.status === 'active';
  const hasPendingSubscription = subscription?.status === 'pending';
  const isConnected = !!playerAddress;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className={`border-2 overflow-hidden relative ${isDark ? 'bg-slate-800/50 border-sky-700' : 'bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 border-sky-200'}`}>
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full -translate-y-1/2 translate-x-1/2 ${isDark ? 'bg-sky-900/20' : 'bg-gradient-to-bl from-sky-200/30 to-transparent'}`} />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl shadow-lg">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div>
                <CardTitle className={`text-2xl ${isDark ? 'text-sky-300' : 'text-sky-900'}`}>Auto-Mixer Agent</CardTitle>
                <p className={isDark ? 'text-sky-400' : 'text-sky-700'}>
                  Let your AI agent mix treats for you automatically
                </p>
              </div>
            </div>
            {hasActiveSubscription && (
              <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-2">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-slate-800/80' : 'bg-white/60'}`}>
              <DollarSign className={`w-6 h-6 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
              <div>
                <div className={`text-xl font-bold ${isDark ? 'text-sky-300' : 'text-sky-900'}`}>{config.monthly_fee_doge} DOGE</div>
                <div className={`text-sm ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>Monthly Fee</div>
              </div>
            </div>
            <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-slate-800/80' : 'bg-white/60'}`}>
              <Clock className={`w-6 h-6 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
              <div>
                <div className={`text-xl font-bold ${isDark ? 'text-sky-300' : 'text-sky-900'}`}>{config.max_window_hours}h</div>
                <div className={`text-sm ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>Max Daily Window</div>
              </div>
            </div>
            <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-slate-800/80' : 'bg-white/60'}`}>
              <Zap className={`w-6 h-6 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
              <div>
                <div className={`text-xl font-bold ${isDark ? 'text-sky-300' : 'text-sky-900'}`}>{config.mixes_per_hour}/hr</div>
                <div className={`text-sm ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>Auto-Mixes</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error/Success Messages */}
      {error && (
        <div className={`p-4 rounded-xl flex items-center gap-2 ${isDark ? 'bg-red-900/50 border border-red-700 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className={`p-4 rounded-xl flex items-center gap-2 ${isDark ? 'bg-emerald-900/50 border border-emerald-700 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Active Subscription View */}
      {hasActiveSubscription && (
        <Card className={`border-2 ${isDark ? 'bg-emerald-900/30 border-emerald-700' : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200'}`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
              <CheckCircle2 className="w-5 h-5" />
              Your Active Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                <Timer className={`w-6 h-6 mx-auto mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <div className={`text-lg font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                  {formatHour(subscription.window_start_hour)} - {formatHour(subscription.window_end_hour)}
                </div>
                <div className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Current Window</div>
              </div>
              <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                <Bot className={`w-6 h-6 mx-auto mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <div className={`text-lg font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>{subscription.total_auto_mixes}</div>
                <div className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Total Mixes</div>
              </div>
              <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                <CalendarDays className={`w-6 h-6 mx-auto mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <div className={`text-lg font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                  {subscription.subscription_end ? format(new Date(subscription.subscription_end), 'MMM d') : '-'}
                </div>
                <div className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Expires</div>
              </div>
              <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                <Clock className={`w-6 h-6 mx-auto mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <div className={`text-lg font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                  {subscription.last_auto_mix ? format(new Date(subscription.last_auto_mix), 'h:mm a') : 'N/A'}
                </div>
                <div className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Last Mix</div>
              </div>
            </div>

            {/* Update Window Section */}
            <div className={`border-t pt-6 ${isDark ? 'border-emerald-700' : 'border-emerald-200'}`}>
              <h4 className={`font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                <Settings className="w-4 h-4" />
                Adjust Mixing Schedule
              </h4>
              <TimeWindowSelector
                startHour={windowStart}
                endHour={windowEnd}
                onStartChange={setWindowStart}
                onEndChange={setWindowEnd}
                disabled={updating}
                isDark={isDark}
              />
              <div className="mt-4">
                <DateSelector 
                  selectedDates={selectedDates}
                  onDatesChange={setSelectedDates}
                  isDark={isDark}
                />
              </div>
              <Button
                onClick={handleUpdateWindow}
                disabled={updating || !isWindowValid}
                className="mt-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                data-testid="update-window-btn"
              >
                {updating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Update Schedule
                  </>
                )}
              </Button>
            </div>

            {/* Recent Mix History */}
            {mixHistory.length > 0 && (
              <div className={`border-t pt-6 ${isDark ? 'border-emerald-700' : 'border-emerald-200'}`}>
                <h4 className={`font-semibold mb-4 ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>Recent Auto-Mixes</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {mixHistory.slice(0, 5).map((mix) => (
                    <div key={mix.id} className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-emerald-500">T</span>
                        <div>
                          <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{mix.treat_name}</div>
                          <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {format(new Date(mix.created_at), 'MMM d, h:mm a')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={
                          mix.treat_rarity === 'Mythic' ? 'border-pink-500 text-pink-500' :
                          mix.treat_rarity === 'Legendary' ? 'border-yellow-500 text-yellow-500' :
                          mix.treat_rarity === 'Epic' ? 'border-purple-500 text-purple-500' :
                          mix.treat_rarity === 'Rare' ? 'border-blue-500 text-blue-500' :
                          isDark ? 'border-slate-500 text-slate-400' : 'border-slate-300 text-slate-600'
                        }>
                          {mix.treat_rarity}
                        </Badge>
                        <div className={`text-xs mt-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>+{mix.points_earned} pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending Payment View */}
      {hasPendingSubscription && (
        <Card className={`border-2 ${isDark ? 'bg-sky-900/30 border-sky-700' : 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-300'}`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-sky-300' : 'text-sky-800'}`}>
              <CreditCard className="w-5 h-5" />
              Complete Payment
            </CardTitle>
            <p className={isDark ? 'text-sky-400' : 'text-sky-600'}>
              Send exactly {subscription?.unique_amount || config.monthly_fee_doge} DOGE to activate your subscription
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Payment Address */}
            <div className={`p-4 rounded-xl border-2 ${isDark ? 'bg-slate-800 border-sky-700' : 'bg-white border-sky-200'}`}>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>Payment Address</label>
              <div className="flex items-center gap-2">
                <code className={`flex-1 p-3 rounded-lg font-mono text-sm break-all ${isDark ? 'bg-slate-900 text-sky-300' : 'bg-sky-50 text-sky-900'}`}>
                  {config.payment_address}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(config.payment_address)}
                  className={`flex-shrink-0 ${isDark ? 'border-sky-700 hover:bg-sky-900' : ''}`}
                  data-testid="copy-address-btn"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Amount */}
            <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-sky-900/50' : 'bg-gradient-to-r from-sky-100 to-blue-100'}`}>
              <div className={`text-3xl font-bold ${isDark ? 'text-sky-300' : 'text-sky-800'}`}>{subscription?.unique_amount || config.monthly_fee_doge} DOGE</div>
              <div className={`text-sm ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>Send this EXACT amount for auto-detection</div>
            </div>

            {/* Auto-detection notice */}
            <div className={`p-4 rounded-xl border-2 ${isDark ? 'bg-green-900/30 border-green-700/50' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'} animate-spin`} />
                <span className={`font-bold ${isDark ? 'text-green-300' : 'text-green-700'}`}>Auto-Payment Detection Active</span>
              </div>
              <p className={`text-sm ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                Just send the exact amount to the address above. Your subscription will activate automatically once the payment is confirmed (1 block). No transaction hash needed!
              </p>
            </div>

            <Button
              onClick={async () => {
                setVerifying(true);
                try {
                  await fetch(`${BACKEND_URL}/api/payments/check-pending`, { method: 'POST' });
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  await fetchData();
                  setSuccess('Payment check triggered. If you sent payment, it should activate shortly.');
                } catch (err) {
                  setError('Error checking payment. Please try again.');
                } finally {
                  setVerifying(false);
                }
              }}
              disabled={verifying}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 py-6 text-lg"
              data-testid="check-payment-btn"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Checking for Payment...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Check Payment Status
                </>
              )}
            </Button>

            <div className="text-center">
              <a
                href={`https://dogechain.info/address/${config.payment_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-sm inline-flex items-center gap-1 ${isDark ? 'text-sky-400 hover:text-sky-300' : 'text-sky-600 hover:text-sky-700'}`}
              >
                View address on DogeChain
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connect Wallet Prompt - Show when not connected */}
      {!isConnected && (
        <Card className={`border-2 border-dashed ${isDark ? 'border-sky-700 bg-slate-800/50' : 'border-sky-300 bg-sky-50/50'}`}>
          <CardContent className="py-8 text-center">
            <div className="p-4 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Connect to Subscribe
            </h3>
            <p className={`mb-4 max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Connect your wallet to subscribe and let the Auto-Mixer agent work for you. 
              Check out the live agent stats below to see it in action!
            </p>
          </CardContent>
        </Card>
      )}

      {/* New Subscription View - Only show when connected but not subscribed */}
      {isConnected && !hasActiveSubscription && !hasPendingSubscription && (
        <Card className={`border-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'border-slate-200'}`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-white' : ''}`}>
              <CalendarIcon className={`w-5 h-5 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
              Set Your Mixing Schedule
            </CardTitle>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-muted-foreground'}`}>
              Choose a 6-hour window when your AI agent will automatically mix treats for you
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <TimeWindowSelector
              startHour={windowStart}
              endHour={windowEnd}
              onStartChange={setWindowStart}
              onEndChange={setWindowEnd}
              disabled={creating}
              isDark={isDark}
            />

            <DateSelector 
              selectedDates={selectedDates}
              onDatesChange={setSelectedDates}
              isDark={isDark}
            />

            <div className={`p-4 rounded-xl space-y-2 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <h4 className={`font-medium ${isDark ? 'text-white' : 'text-slate-700'}`}>What you get:</h4>
              <ul className={`space-y-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Up to {config.mixes_per_hour * 6} auto-mixes per day during your window
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Flexible window - change it anytime
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Schedule specific days with the calendar
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Earn points even while you're away
                </li>
              </ul>
            </div>

            <Button
              onClick={handleCreateSubscription}
              disabled={creating || !isWindowValid}
              className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 py-6 text-lg"
              data-testid="create-subscription-btn"
            >
              {creating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Subscribe for {config.monthly_fee_doge} DOGE/month
                  <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Agent Stats Card - Shows global agent status */}
      <AgentStatsCard agentStatus={agentStatus} playerStats={playerStats} isDark={isDark} />

      {/* Player's Personal Stats - Only show if subscribed */}
      {playerStats?.has_subscription && <PlayerMixerStats stats={playerStats} isDark={isDark} />}

      {/* Funds Breakdown */}
      {fundsStats && <FundsBreakdown stats={fundsStats} isDark={isDark} />}
    </div>
  );
};

export default AutoMixerSubscription;
