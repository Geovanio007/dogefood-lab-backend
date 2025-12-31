import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../config/firebase';
import { User, Mail, Lock, Chrome } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState('select'); // 'select', 'guest', 'email', 'login'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGuestRegister = async () => {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    
    if (username.length < 3 || username.length > 20) {
      setError('Username must be 3-20 characters');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/players/guest-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed');
      }
      
      // Store player info in localStorage
      const playerData = {
        id: data.player_id,
        username: data.username,
        guest_id: data.guest_id,
        auth_type: 'guest'
      };
      localStorage.setItem('dogefood_player', JSON.stringify(playerData));
      
      // Dispatch custom event to notify MainMenu of registration
      window.dispatchEvent(new Event('dogefood_player_registered'));
      
      onSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      
      // Register with backend
      const response = await fetch(`${BACKEND_URL}/api/players/firebase-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, username })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed');
      }
      
      // Store player info
      const playerData = {
        id: data.player_id,
        username: data.username,
        email: data.email,
        firebase_uid: data.firebase_uid,
        auth_type: 'firebase'
      };
      localStorage.setItem('dogefood_player', JSON.stringify(playerData));
      
      // Dispatch custom event to notify MainMenu of registration
      window.dispatchEvent(new Event('dogefood_player_registered'));
      
      onSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (isSignUp) => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      let result;
      if (isSignUp) {
        result = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        result = await signInWithEmailAndPassword(auth, email, password);
      }
      
      const idToken = await result.user.getIdToken();
      
      // Register with backend
      const response = await fetch(`${BACKEND_URL}/api/players/firebase-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, username })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed');
      }
      
      // Store player info
      const playerData = {
        id: data.player_id,
        username: data.username,
        email: data.email,
        firebase_uid: data.firebase_uid,
        auth_type: 'firebase'
      };
      localStorage.setItem('dogefood_player', JSON.stringify(playerData));
      
      // Dispatch custom event to notify MainMenu of registration
      window.dispatchEvent(new Event('dogefood_player_registered'));
      
      onSuccess(data);
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <Card className="w-full max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-sky-400/30">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-sky-400 via-emerald-400 to-yellow-400 bg-clip-text text-transparent">
            🧪 Join DogeFood Lab
          </CardTitle>
          <p className="text-slate-400 text-sm mt-2">
            Create an account to start mixing treats!
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
          
          {mode === 'select' && (
            <div className="space-y-3">
              {/* Guest Registration */}
              <Button
                onClick={() => setMode('guest')}
                className="w-full bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white py-6"
              >
                <User className="w-5 h-5 mr-2" />
                Quick Play (Guest)
              </Button>
              
              {/* Google Sign In */}
              <Button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-white hover:bg-gray-100 text-gray-800 py-6"
              >
                <Chrome className="w-5 h-5 mr-2" />
                {loading ? 'Signing in...' : 'Continue with Google'}
              </Button>
              
              {/* Email Sign In */}
              <Button
                onClick={() => setMode('email')}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-6"
              >
                <Mail className="w-5 h-5 mr-2" />
                Sign up with Email
              </Button>
              
              {/* Already have account */}
              <div className="text-center">
                <button
                  onClick={() => setMode('login')}
                  className="text-sky-400 hover:text-sky-300 text-sm underline"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </div>
          )}
          
          {mode === 'guest' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Choose your username</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="bg-white/10 border-white/20 text-white"
                  maxLength={20}
                />
                <p className="text-xs text-slate-500 mt-1">3-20 characters, letters, numbers, underscores only</p>
              </div>
              
              <Button
                onClick={handleGuestRegister}
                disabled={loading}
                className="w-full bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 py-6"
              >
                {loading ? 'Creating account...' : '🚀 Start Playing'}
              </Button>
              
              <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-300 text-xs">
                  💡 <strong>Note:</strong> Guest accounts can play and appear on leaderboard! 
                  Connect a wallet with DogeFood NFT later to convert points to $LAB tokens.
                </p>
              </div>
              
              <button
                onClick={() => setMode('select')}
                className="w-full text-slate-400 hover:text-white text-sm"
              >
                ← Back to options
              </button>
            </div>
          )}
          
          {(mode === 'email' || mode === 'login') && (
            <div className="space-y-4">
              {mode === 'email' && (
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Username (optional)</label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    className="bg-white/10 border-white/20 text-white"
                    maxLength={20}
                  />
                </div>
              )}
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              
              <Button
                onClick={() => handleEmailAuth(mode === 'email')}
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 py-6"
              >
                {loading ? 'Please wait...' : mode === 'email' ? '🚀 Create Account' : '🔓 Sign In'}
              </Button>
              
              <div className="text-center">
                <button
                  onClick={() => setMode(mode === 'email' ? 'login' : 'email')}
                  className="text-sky-400 hover:text-sky-300 text-sm underline"
                >
                  {mode === 'email' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
              
              <button
                onClick={() => setMode('select')}
                className="w-full text-slate-400 hover:text-white text-sm"
              >
                ← Back to options
              </button>
            </div>
          )}
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full text-slate-500 hover:text-white text-sm mt-4"
          >
            Cancel
          </button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthModal;
