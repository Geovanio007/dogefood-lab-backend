import React, { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { User, Wallet, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from './ui/use-toast';

const UserRegistration = ({ onRegistrationComplete }) => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isPending: isSigningPending } = useSignMessage();
  const { toast } = useToast();
  
  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationStep, setRegistrationStep] = useState(1); // 1: Username, 2: Signature, 3: Complete

  const handleUsernameSubmit = async () => {
    if (!username || username.length < 3) {
      toast({
        title: "Invalid Username",
        description: "Username must be at least 3 characters long.",
        variant: "destructive"
      });
      return;
    }

    if (username.length > 20) {
      toast({
        title: "Username Too Long",
        description: "Username must be 20 characters or less.",
        variant: "destructive"
      });
      return;
    }

    // Check for valid username (alphanumeric + underscore only)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      toast({
        title: "Invalid Characters",
        description: "Username can only contain letters, numbers, and underscores.",
        variant: "destructive"
      });
      return;
    }

    setRegistrationStep(2);
  };

  const handleSignatureAndRegistration = async () => {
    if (!address || !isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to continue registration.",
        variant: "destructive"
      });
      return;
    }

    setIsRegistering(true);

    try {
      // Create signature message
      const message = `DogeFood Lab Registration\n\nWallet: ${address}\nUsername: ${username}\nTimestamp: ${new Date().toISOString()}\n\nBy signing this message, I register my wallet with the username "${username}" for DogeFood Lab.`;

      console.log("🔏 Requesting wallet signature...");
      
      // Request signature from wallet
      const signature = await signMessageAsync({ message });

      console.log("✅ Signature received, registering with backend...");

      // Register with backend
      const registrationData = {
        address: address,
        username: username,
        signature: signature,
        message: message,
        timestamp: new Date().toISOString()
      };

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/players/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData)
      });

      if (response.ok) {
        const result = await response.json();
        
        console.log("✅ Registration successful:", result);

        setRegistrationStep(3);
        
        toast({
          title: "🎉 Registration Complete!",
          description: `Welcome to DogeFood Lab, ${username}! Your wallet is now registered.`,
          className: "bg-green-100 border-green-400"
        });

        // Complete registration after showing success
        setTimeout(() => {
          onRegistrationComplete({
            address: address,
            username: username,
            signature: signature,
            registeredAt: new Date().toISOString()
          });
        }, 2000);

      } else {
        const error = await response.text();
        throw new Error(`Registration failed: ${error}`);
      }

    } catch (error) {
      console.error("Registration error:", error);
      
      let errorMessage = "Registration failed. Please try again.";
      
      if (error.message.includes("User rejected")) {
        errorMessage = "Signature was cancelled. Please try again.";
      } else if (error.message.includes("already registered")) {
        errorMessage = "This wallet is already registered. Please use a different wallet or username.";
      } else if (error.message.includes("Username taken")) {
        errorMessage = "This username is already taken. Please choose a different one.";
        setRegistrationStep(1); // Go back to username entry
      }

      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive"
      });

      if (!error.message.includes("Username taken")) {
        setRegistrationStep(2); // Stay on signature step for most errors
      }
    } finally {
      setIsRegistering(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className="glass-panel max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 shadow-xl">
            <Wallet size={32} className="text-white drop-shadow-lg" />
          </div>
          <CardTitle className="playful-title text-white text-2xl">
            Connect Wallet First
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-white/90 mb-4">
            Please connect your wallet to start the registration process.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-lg">
        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${registrationStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${registrationStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                {registrationStep > 1 ? <CheckCircle size={20} /> : '1'}
              </div>
              <span className="ml-2 font-medium">Username</span>
            </div>
            <div className="w-8 h-1 bg-gray-300">
              <div className={`h-full ${registrationStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`} style={{width: registrationStep >= 2 ? '100%' : '0%'}}></div>
            </div>
            <div className={`flex items-center ${registrationStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${registrationStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                {registrationStep > 2 ? <CheckCircle size={20} /> : '2'}
              </div>
              <span className="ml-2 font-medium">Signature</span>
            </div>
            <div className="w-8 h-1 bg-gray-300">
              <div className={`h-full ${registrationStep >= 3 ? 'bg-green-600' : 'bg-gray-300'}`} style={{width: registrationStep >= 3 ? '100%' : '0%'}}></div>
            </div>
            <div className={`flex items-center ${registrationStep >= 3 ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${registrationStep >= 3 ? 'bg-green-600 text-white' : 'bg-gray-300'}`}>
                {registrationStep >= 3 ? <CheckCircle size={20} /> : '3'}
              </div>
              <span className="ml-2 font-medium">Complete</span>
            </div>
          </div>
        </div>

        {/* Registration Card */}
        <Card className="glass-panel">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mb-4 shadow-xl">
              <User size={32} className="text-white drop-shadow-lg" />
            </div>
            <CardTitle className="playful-title text-white text-3xl">
              🎮 Join DogeFood Lab
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Connected Wallet Display */}
            <div className="bg-white/10 rounded-lg p-4 border-2 border-green-400/50">
              <div className="flex items-center gap-2 text-green-300">
                <CheckCircle size={20} />
                <span className="font-medium">Wallet Connected</span>
              </div>
              <div className="text-sm text-white/80 mt-1 font-mono">
                {`${address?.slice(0, 6)}...${address?.slice(-4)}`}
              </div>
            </div>

            {/* Step 1: Username Entry */}
            {registrationStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="username" className="text-white font-medium">
                    Choose Your Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username (3-20 characters)"
                    className="mt-1 bg-white/10 border-white/30 text-white placeholder-white/50"
                    maxLength={20}
                  />
                  <p className="text-xs text-white/60 mt-1">
                    Letters, numbers, and underscores only
                  </p>
                </div>

                <Button
                  onClick={handleUsernameSubmit}
                  disabled={!username || username.length < 3}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3"
                >
                  Continue to Signature
                </Button>
              </div>
            )}

            {/* Step 2: Signature Request */}
            {registrationStep === 2 && (
              <div className="space-y-4">
                <div className="bg-white/10 rounded-lg p-4">
                  <h4 className="font-medium text-white mb-2">Registration Details:</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/70">Username:</span>
                      <span className="text-white font-medium">{username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Wallet:</span>
                      <span className="text-white font-mono text-xs">{`${address?.slice(0, 8)}...${address?.slice(-6)}`}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-100/10 border border-yellow-400/50 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={20} className="text-yellow-400 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-yellow-200 font-medium mb-1">Signature Required</p>
                      <p className="text-yellow-100/80">
                        You'll be asked to sign a message to verify ownership of this wallet. 
                        This creates a secure link between your wallet and username.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handleSignatureAndRegistration}
                    disabled={isRegistering || isSigningPending}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
                  >
                    {isRegistering || isSigningPending ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {isSigningPending ? 'Waiting for signature...' : 'Registering...'}
                      </div>
                    ) : (
                      'Sign & Register'
                    )}
                  </Button>

                  <Button
                    onClick={() => setRegistrationStep(1)}
                    variant="outline"
                    className="w-full"
                    disabled={isRegistering}
                  >
                    Back to Username
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Registration Complete */}
            {registrationStep === 3 && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={32} className="text-white" />
                </div>
                
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">🎉 Welcome to DogeFood Lab!</h3>
                  <p className="text-white/80">
                    Your registration is complete, <strong>{username}</strong>!
                  </p>
                </div>

                <Badge className="bg-green-500 text-white px-4 py-2 text-lg">
                  ✅ Registered Successfully
                </Badge>

                <p className="text-sm text-white/70">
                  You'll be redirected to the game in a moment...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserRegistration;