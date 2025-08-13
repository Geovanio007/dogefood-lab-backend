import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const WalletRegistration = ({ onRegistrationComplete, registeredPlayers = [] }) => {
  const { address, isConnected } = useAccount();
  const [nickname, setNickname] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationStep, setRegistrationStep] = useState('connect'); // 'connect', 'nickname', 'complete'

  const isAlreadyRegistered = registeredPlayers.some(player => 
    player.walletAddress?.toLowerCase() === address?.toLowerCase()
  );

  const handleNicknameSubmit = async (e) => {
    e.preventDefault();
    if (!nickname.trim() || !address) return;

    setIsRegistering(true);
    
    try {
      // Call backend to register player
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/player`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address: address,
          nickname: nickname.trim(),
          level: 1,
          xp: 0,
          points: 0
        }),
      });

      if (response.ok) {
        const playerData = await response.json();
        setRegistrationStep('complete');
        
        // Notify parent component
        onRegistrationComplete && onRegistrationComplete({
          walletAddress: address,
          nickname: nickname.trim(),
          ...playerData
        });
      } else {
        console.error('Registration failed');
        alert('Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  React.useEffect(() => {
    if (isConnected && address) {
      if (isAlreadyRegistered) {
        setRegistrationStep('complete');
        // Get existing player data
        const existingPlayer = registeredPlayers.find(player => 
          player.walletAddress?.toLowerCase() === address?.toLowerCase()
        );
        onRegistrationComplete && onRegistrationComplete(existingPlayer);
      } else {
        setRegistrationStep('nickname');
      }
    } else {
      setRegistrationStep('connect');
    }
  }, [isConnected, address, isAlreadyRegistered]);

  if (registrationStep === 'complete' && isAlreadyRegistered) {
    const player = registeredPlayers.find(p => 
      p.walletAddress?.toLowerCase() === address?.toLowerCase()
    );
    
    return (
      <div className="wallet-registration-complete">
        <div className="registration-success">
          <div className="success-icon">🎉</div>
          <h3 className="success-title">Welcome back, {player?.nickname || 'Scientist'}!</h3>
          <p className="success-message">
            Your wallet is connected and you're ready to create treats!
          </p>
          <div className="player-stats">
            <div className="stat-item">
              <span className="stat-label">Level:</span>
              <span className="stat-value">{player?.level || 1}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">XP:</span>
              <span className="stat-value">{player?.xp || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Points:</span>
              <span className="stat-value">{player?.points || 0}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-registration">
      <div className="registration-container">
        {registrationStep === 'connect' && (
          <div className="connect-step">
            <div className="step-header">
              <h2 className="step-title">🔗 Connect Your Wallet</h2>
              <p className="step-description">
                Connect your wallet to save your progress and compete on the leaderboard!
              </p>
            </div>
            
            <div className="connect-button-container">
              <ConnectButton />
            </div>
            
            <div className="benefits-list">
              <h4>With wallet connection you get:</h4>
              <ul>
                <li>✅ Save your progress and treats</li>
                <li>✅ Compete on the leaderboard</li>
                <li>✅ Create treats with 3-hour timers</li>
                <li>✅ Earn points and level up</li>
                <li>✅ Unlock more ingredients</li>
              </ul>
            </div>
          </div>
        )}

        {registrationStep === 'nickname' && isConnected && (
          <div className="nickname-step">
            <div className="step-header">
              <h2 className="step-title">👤 Choose Your Scientist Name</h2>
              <p className="step-description">
                Pick a nickname that will appear on the leaderboard!
              </p>
            </div>
            
            <form onSubmit={handleNicknameSubmit} className="nickname-form">
              <div className="form-group">
                <label htmlFor="nickname" className="form-label">
                  Scientist Nickname:
                </label>
                <input
                  type="text"
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Enter your lab name..."
                  className="nickname-input"
                  maxLength={20}
                  required
                />
                <div className="character-count">
                  {nickname.length}/20 characters
                </div>
              </div>
              
              <div className="wallet-info">
                <p className="wallet-address">
                  Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
              </div>
              
              <button 
                type="submit" 
                className="register-button"
                disabled={!nickname.trim() || isRegistering}
              >
                {isRegistering ? (
                  <span className="loading-text">
                    <span className="spinner"></span>
                    Registering...
                  </span>
                ) : (
                  <span>🧪 Start Lab Journey!</span>
                )}
              </button>
            </form>
          </div>
        )}

        {registrationStep === 'complete' && !isAlreadyRegistered && (
          <div className="registration-complete">
            <div className="success-animation">
              <div className="success-icon">🎉</div>
              <h3 className="success-title">Welcome to the Lab, {nickname}!</h3>
              <p className="success-message">
                Your registration is complete! You can now create treats and compete on the leaderboard.
              </p>
              <div className="start-button">
                <button 
                  className="doge-button"
                  onClick={() => window.location.reload()}
                >
                  Start Creating Treats! 🧪
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletRegistration;