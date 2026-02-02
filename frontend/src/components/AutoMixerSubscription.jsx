import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { format, addDays, isBefore, isAfter, startOfDay } from 'date-fns';
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
  Sparkles,
  CalendarDays,
  X
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

const AutoMixerSubscription = ({ playerAddress, playerNickname, isDarkMode = false }) => {
  const [config, setConfig] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [fundsStats, setFundsStats] = useState(null);
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
      // Fetch config, subscription, and stats in parallel
      const [configRes, subRes, statsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/auto-mixer/config`),
        fetch(`${BACKEND_URL}/api/auto-mixer/subscription/${playerAddress}`),
        fetch(`${BACKEND_URL}/api/auto-mixer/funds-stats`)
      ]);

      if (configRes.ok) {
        setConfig(await configRes.json());
      }

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

      if (statsRes.ok) {
        setFundsStats(await statsRes.json());
      }

      // Fetch mix history if there's an active subscription
      if (subscription?.status === 'active') {
        const historyRes = await fetch(`${BACKEND_URL}/api/auto-mixer/history/${playerAddress}`);
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setMixHistory(historyData.history || []);
        }
      }
    } catch (err) {
      console.error('Error fetching auto-mixer data:', err);
    } finally {
      setLoading(false);
    }
  }, [playerAddress, subscription?.status]);

  useEffect(() => {
    if (playerAddress) {
      fetchData();
    }
  }, [playerAddress, fetchData]);

  // Poll for funds stats every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const statsRes = await fetch(`${BACKEND_URL}/api/auto-mixer/funds-stats`);
        if (statsRes.ok) {
          setFundsStats(await statsRes.json());
        }
      } catch (err) {
        console.error('Error polling stats:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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
              <Sparkles className="w-5 h-5" />
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
                        <span className="text-2xl">🍪</span>
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
              Send exactly {config.monthly_fee_doge} DOGE to activate your subscription
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
              <div className={`text-3xl font-bold ${isDark ? 'text-sky-300' : 'text-sky-800'}`}>{config.monthly_fee_doge} DOGE</div>
              <div className={`text-sm ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>Exact Amount Required</div>
            </div>

            {/* Transaction Hash Input */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>
                Transaction Hash
              </label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Enter your DOGE transaction hash..."
                className={`w-full p-3 rounded-xl border-2 transition-all ${
                  isDark 
                    ? 'bg-slate-800 border-sky-700 text-white placeholder-slate-500 focus:border-sky-500' 
                    : 'border-sky-200 focus:border-sky-500 focus:ring-sky-200'
                }`}
                data-testid="tx-hash-input"
              />
              <p className={`text-xs mt-2 ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>
                After sending payment, paste the transaction hash here to verify
              </p>
            </div>

            <Button
              onClick={handleVerifyPayment}
              disabled={verifying || !txHash.trim()}
              className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 py-6 text-lg"
              data-testid="verify-payment-btn"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Verifying Payment...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Verify Payment
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

      {/* New Subscription View */}
      {!hasActiveSubscription && !hasPendingSubscription && (
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

      {/* Funds Breakdown */}
      {fundsStats && <FundsBreakdown stats={fundsStats} isDark={isDark} />}
    </div>
  );
};

export default AutoMixerSubscription;
