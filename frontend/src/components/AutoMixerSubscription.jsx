import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Bot, 
  Clock, 
  Calendar, 
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
  Sparkles
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Time slots for the 24-hour clock selector
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const formatHour = (hour) => {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${ampm}`;
};

const TimeWindowSelector = ({ startHour, endHour, onStartChange, onEndChange, disabled }) => {
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
          <label className="block text-sm font-medium mb-2 text-amber-700">Start Time (UTC)</label>
          <select
            value={startHour}
            onChange={(e) => onStartChange(parseInt(e.target.value))}
            disabled={disabled}
            className="w-full p-3 rounded-xl border-2 border-amber-200 bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all disabled:opacity-50"
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
          <label className="block text-sm font-medium mb-2 text-amber-700">End Time (UTC)</label>
          <select
            value={endHour}
            onChange={(e) => onEndChange(parseInt(e.target.value))}
            disabled={disabled}
            className="w-full p-3 rounded-xl border-2 border-amber-200 bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all disabled:opacity-50"
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
      <div className="relative h-12 bg-gradient-to-r from-slate-100 to-slate-200 rounded-xl overflow-hidden">
        <div 
          className={`absolute h-full transition-all duration-300 ${isValid ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-red-400'}`}
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

const FundsBreakdown = ({ stats }) => {
  return (
    <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-emerald-800">
          <TrendingUp className="w-5 h-5" />
          Fund Distribution (Real-time)
        </CardTitle>
        <CardDescription className="text-emerald-600">
          Transparent allocation of subscription fees
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-xl border border-emerald-200 text-center">
            <DollarSign className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
            <div className="text-2xl font-bold text-emerald-800">{stats.total_received_doge}</div>
            <div className="text-xs text-emerald-600">Total DOGE</div>
          </div>
          
          <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200 text-center">
            <Flame className="w-6 h-6 mx-auto mb-2 text-orange-600" />
            <div className="text-2xl font-bold text-orange-800">{stats.buy_burn_amount}</div>
            <div className="text-xs text-orange-600">Buy & Burn ({stats.buy_burn_percent}%)</div>
          </div>
          
          <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 text-center">
            <Users className="w-6 h-6 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold text-purple-800">{stats.dev_amount}</div>
            <div className="text-xs text-purple-600">Dev Fund ({stats.dev_percent}%)</div>
          </div>
          
          <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 text-center">
            <Bot className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold text-blue-800">{stats.total_auto_mixes}</div>
            <div className="text-xs text-blue-600">Total Auto-Mixes</div>
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between text-sm text-emerald-700 bg-emerald-100 rounded-lg p-3">
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

const AutoMixerSubscription = ({ playerAddress, playerNickname }) => {
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
          window_end_hour: windowEnd
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
          window_end_hour: windowEnd
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to update window');
      }

      setSubscription(data.subscription);
      setSuccess('Mixing window updated successfully!');
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
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-8 text-slate-500">
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
      <Card className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-2 border-amber-200 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-amber-200/30 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-amber-900">Auto-Mixer Agent</CardTitle>
                <CardDescription className="text-amber-700">
                  Let your AI agent mix treats for you automatically
                </CardDescription>
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
            <div className="flex items-center gap-3 p-4 bg-white/60 rounded-xl">
              <DollarSign className="w-6 h-6 text-amber-600" />
              <div>
                <div className="text-xl font-bold text-amber-900">{config.monthly_fee_doge} DOGE</div>
                <div className="text-sm text-amber-600">Monthly Fee</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/60 rounded-xl">
              <Clock className="w-6 h-6 text-amber-600" />
              <div>
                <div className="text-xl font-bold text-amber-900">{config.max_window_hours}h</div>
                <div className="text-sm text-amber-600">Max Daily Window</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/60 rounded-xl">
              <Zap className="w-6 h-6 text-amber-600" />
              <div>
                <div className="text-xl font-bold text-amber-900">{config.mixes_per_hour}/hr</div>
                <div className="text-sm text-amber-600">Auto-Mixes</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Active Subscription View */}
      {hasActiveSubscription && (
        <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-800">
              <Sparkles className="w-5 h-5" />
              Your Active Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-xl text-center">
                <Timer className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                <div className="text-lg font-bold text-emerald-800">
                  {formatHour(subscription.window_start_hour)} - {formatHour(subscription.window_end_hour)}
                </div>
                <div className="text-xs text-emerald-600">Current Window</div>
              </div>
              <div className="p-4 bg-white rounded-xl text-center">
                <Bot className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                <div className="text-lg font-bold text-emerald-800">{subscription.total_auto_mixes}</div>
                <div className="text-xs text-emerald-600">Total Mixes</div>
              </div>
              <div className="p-4 bg-white rounded-xl text-center">
                <Calendar className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                <div className="text-lg font-bold text-emerald-800">
                  {subscription.subscription_end ? new Date(subscription.subscription_end).toLocaleDateString() : '-'}
                </div>
                <div className="text-xs text-emerald-600">Expires</div>
              </div>
              <div className="p-4 bg-white rounded-xl text-center">
                <Clock className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                <div className="text-lg font-bold text-emerald-800">
                  {subscription.last_auto_mix ? new Date(subscription.last_auto_mix).toLocaleTimeString() : 'N/A'}
                </div>
                <div className="text-xs text-emerald-600">Last Mix</div>
              </div>
            </div>

            {/* Update Window Section */}
            <div className="border-t border-emerald-200 pt-6">
              <h4 className="font-semibold text-emerald-800 mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Adjust Mixing Window
              </h4>
              <TimeWindowSelector
                startHour={windowStart}
                endHour={windowEnd}
                onStartChange={setWindowStart}
                onEndChange={setWindowEnd}
                disabled={updating}
              />
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
                    Update Window
                  </>
                )}
              </Button>
            </div>

            {/* Recent Mix History */}
            {mixHistory.length > 0 && (
              <div className="border-t border-emerald-200 pt-6">
                <h4 className="font-semibold text-emerald-800 mb-4">Recent Auto-Mixes</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {mixHistory.slice(0, 5).map((mix) => (
                    <div key={mix.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🍪</span>
                        <div>
                          <div className="font-medium text-slate-800">{mix.treat_name}</div>
                          <div className="text-xs text-slate-500">
                            {new Date(mix.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={
                          mix.treat_rarity === 'Mythic' ? 'border-pink-500 text-pink-600' :
                          mix.treat_rarity === 'Legendary' ? 'border-amber-500 text-amber-600' :
                          mix.treat_rarity === 'Epic' ? 'border-purple-500 text-purple-600' :
                          mix.treat_rarity === 'Rare' ? 'border-blue-500 text-blue-600' :
                          'border-slate-300 text-slate-600'
                        }>
                          {mix.treat_rarity}
                        </Badge>
                        <div className="text-xs text-emerald-600 mt-1">+{mix.points_earned} pts</div>
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
        <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <CreditCard className="w-5 h-5" />
              Complete Payment
            </CardTitle>
            <CardDescription className="text-amber-600">
              Send exactly {config.monthly_fee_doge} DOGE to activate your subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Payment Address */}
            <div className="p-4 bg-white rounded-xl border-2 border-amber-200">
              <label className="block text-sm font-medium text-amber-700 mb-2">Payment Address</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-amber-50 rounded-lg text-amber-900 font-mono text-sm break-all">
                  {config.payment_address}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(config.payment_address)}
                  className="flex-shrink-0"
                  data-testid="copy-address-btn"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Amount */}
            <div className="p-4 bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl text-center">
              <div className="text-3xl font-bold text-amber-800">{config.monthly_fee_doge} DOGE</div>
              <div className="text-sm text-amber-600">Exact Amount Required</div>
            </div>

            {/* Transaction Hash Input */}
            <div>
              <label className="block text-sm font-medium text-amber-700 mb-2">
                Transaction Hash
              </label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Enter your DOGE transaction hash..."
                className="w-full p-3 rounded-xl border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                data-testid="tx-hash-input"
              />
              <p className="text-xs text-amber-600 mt-2">
                After sending payment, paste the transaction hash here to verify
              </p>
            </div>

            <Button
              onClick={handleVerifyPayment}
              disabled={verifying || !txHash.trim()}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 py-6 text-lg"
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
                className="text-amber-600 hover:text-amber-700 text-sm inline-flex items-center gap-1"
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
        <Card className="border-2 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              Set Your Mixing Schedule
            </CardTitle>
            <CardDescription>
              Choose a 6-hour window when your AI agent will automatically mix treats for you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <TimeWindowSelector
              startHour={windowStart}
              endHour={windowEnd}
              onStartChange={setWindowStart}
              onEndChange={setWindowEnd}
              disabled={creating}
            />

            <div className="p-4 bg-slate-50 rounded-xl space-y-2">
              <h4 className="font-medium text-slate-700">What you get:</h4>
              <ul className="space-y-1 text-sm text-slate-600">
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
                  AI selects optimal ingredient combinations
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
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 py-6 text-lg"
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
      {fundsStats && <FundsBreakdown stats={fundsStats} />}
    </div>
  );
};

export default AutoMixerSubscription;
