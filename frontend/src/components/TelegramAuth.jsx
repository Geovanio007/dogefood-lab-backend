import React, { useState, useEffect } from 'react';
import { useTelegram } from '../contexts/TelegramContext';
import { useToast } from './ui/use-toast';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { User, CheckCircle, Loader2 } from 'lucide-react';

const TelegramAuth = ({ onAuthComplete }) => {
  const { telegramUser, isAuthenticated, registerTelegramUser } = useTelegram();
  const { toast } = useToast();
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  useEffect(() => {
    // Auto-register if authenticated but not registered yet
    if (isAuthenticated && !registrationComplete && !isRegistering) {
      handleAutoRegister();
    }
  }, [isAuthenticated, registrationComplete, isRegistering]);

  const handleAutoRegister = async () => {
    setIsRegistering(true);
    
    try {
      const result = await registerTelegramUser();
      
      setRegistrationComplete(true);
      
      toast({
        title: "🎉 Welcome to DogeFood Lab!",
        description: `Welcome ${telegramUser?.first_name || 'Doge Scientist'}! Your Telegram account is ready to play.`,
        className: "bg-green-100 border-green-400"
      });

      // Complete authentication after showing success message
      setTimeout(() => {
        onAuthComplete({
          telegramId: telegramUser?.id,
          username: telegramUser?.username,
          firstName: telegramUser?.first_name,
          lastName: telegramUser?.last_name,
          authType: 'telegram',
          registeredAt: new Date().toISOString()
        });
      }, 2000);

    } catch (error) {
      console.error('Auto-registration error:', error);
      
      toast({
        title: "Registration Error",
        description: error.message || "Failed to register with Telegram. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRegistering(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <Card className="glass-panel max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center mb-4 shadow-xl">
              <User size={32} className="text-white drop-shadow-lg" />
            </div>
            <CardTitle className="playful-title text-white text-2xl">
              🤖 Telegram Authentication Error
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-white/90">
              Unable to authenticate with Telegram. Please make sure you're opening this app from within Telegram.
            </p>
            <Badge variant="destructive" className="px-4 py-2">
              Authentication Failed
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isRegistering) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <Card className="glass-panel max-w-md mx-auto">
          <CardContent className="text-center py-8 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            <h3 className="text-xl font-bold text-white">Setting up your account...</h3>
            <p className="text-white/80">
              Welcome {telegramUser?.first_name}! We're preparing your DogeFood Lab experience.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (registrationComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4 flex items-center justify-center">
        <Card className="glass-panel max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-xl">
              <CheckCircle size={32} className="text-white" />
            </div>
            <CardTitle className="playful-title text-white text-3xl">
              🎉 Welcome to DogeFood Lab!
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-300 justify-center mb-2">
                <CheckCircle size={20} />
                <span className="font-medium">Telegram Account Connected</span>
              </div>
              <div className="text-white/80">
                <p className="font-medium">{telegramUser?.first_name} {telegramUser?.last_name}</p>
                {telegramUser?.username && (
                  <p className="text-sm">@{telegramUser.username}</p>
                )}
              </div>
            </div>

            <Badge className="bg-green-500 text-white px-4 py-2 text-lg">
              ✅ Ready to Play!
            </Badge>

            <p className="text-sm text-white/70">
              You'll be redirected to the game in a moment...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback UI (shouldn't normally reach here)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
      <Card className="glass-panel max-w-md mx-auto">
        <CardContent className="text-center py-8 space-y-4">
          <p className="text-white/90">Setting up Telegram authentication...</p>
          <Button 
            onClick={handleAutoRegister}
            disabled={isRegistering}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isRegistering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Registering...
              </>
            ) : (
              'Complete Setup'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TelegramAuth;