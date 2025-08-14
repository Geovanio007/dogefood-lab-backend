import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useToast } from './ui/use-toast';
import { 
  Coins, 
  ArrowRightLeft, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Wallet,
  Gift
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const LAB_TOKEN_ADDRESS = "0xc2386881F0BCb45F26A65e6B60deE0b7e2B65F93"; // From contracts config

const PointsToBlockchain = () => {
  const { address, isConnected } = useAccount();
  const [playerPoints, setPlayerPoints] = useState(0);
  const [conversionRate, setConversionRate] = useState(100); // Points per LAB token
  const [conversionHistory, setConversionHistory] = useState([]);
  const [pendingConversions, setPendingConversions] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Smart contract interaction
  const { 
    writeContract, 
    data: transactionHash, 
    error: writeError, 
    isPending: isWritePending 
  } = useWriteContract();

  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed 
  } = useWaitForTransactionReceipt({
    hash: transactionHash,
  });

  useEffect(() => {
    if (isConnected && address) {
      loadPlayerData();
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (isConfirmed) {
      toast({
        title: "Conversion Successful! 🎉",
        description: "Your points have been converted to $LAB tokens",
        className: "bg-green-100 border-green-400"
      });
      loadPlayerData(); // Refresh data after successful conversion
    }
  }, [isConfirmed, toast]);

  useEffect(() => {
    if (writeError) {
      toast({
        title: "Transaction Failed",
        description: writeError.shortMessage || writeError.message,
        variant: "destructive"
      });
    }
  }, [writeError, toast]);

  const loadPlayerData = async () => {
    if (!address) return;

    try {
      setLoading(true);

      // Get player points stats
      const statsResponse = await fetch(`${BACKEND_URL}/api/points/${address}/stats`);
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setPlayerPoints(stats.player?.total_points || 0);
      }

      // Get conversion history (mock for now)
      const mockHistory = [
        {
          id: 1,
          amount_points: 500,
          amount_tokens: 5,
          timestamp: new Date(Date.now() - 86400000 * 7), // 7 days ago
          status: 'completed',
          tx_hash: '0x1234...5678'
        },
        {
          id: 2,
          amount_points: 1000,
          amount_tokens: 10,
          timestamp: new Date(Date.now() - 86400000 * 3), // 3 days ago
          status: 'completed',
          tx_hash: '0x9876...4321'
        }
      ];
      setConversionHistory(mockHistory);

    } catch (error) {
      console.error('Error loading player data:', error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load your points data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConvertPoints = async (pointsToConvert) => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to convert points",
        variant: "destructive"
      });
      return;
    }

    if (pointsToConvert > playerPoints) {
      toast({
        title: "Insufficient Points",
        description: "You don't have enough points for this conversion",
        variant: "destructive"
      });
      return;
    }

    if (pointsToConvert < conversionRate) {
      toast({
        title: "Minimum Conversion",
        description: `Minimum conversion is ${conversionRate} points (1 LAB token)`,
        variant: "destructive"
      });
      return;
    }

    try {
      // Calculate token amount (with 18 decimals)
      const tokenAmount = Math.floor(pointsToConvert / conversionRate);
      const tokenAmountWei = BigInt(tokenAmount * Math.pow(10, 18));

      // In a real implementation, this would:
      // 1. Create a conversion request in the backend
      // 2. Generate a Merkle proof for the user
      // 3. Call the smart contract to claim tokens

      // For now, we'll mock the contract call
      toast({
        title: "Feature Coming Soon!",
        description: "Points to blockchain conversion will be available in the next update. Your points are safely stored off-chain.",
        className: "bg-blue-100 border-blue-400"
      });

      // Mock implementation - in production, would call:
      // writeContract({
      //   address: LAB_TOKEN_ADDRESS,
      //   abi: labTokenAbi,
      //   functionName: 'claimPointsReward',
      //   args: [tokenAmountWei, merkleProof],
      // });

    } catch (error) {
      console.error('Error converting points:', error);
      toast({
        title: "Conversion Failed",
        description: "Failed to initiate points conversion",
        variant: "destructive"
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <Wallet className="w-16 h-16 text-purple-600 mx-auto mb-4" />
              <CardTitle className="text-2xl">Connect Wallet Required</CardTitle>
              <p className="text-gray-600">Connect your wallet to convert points to $LAB tokens</p>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => window.location.href = '/'} className="w-full">
                Go to Main Menu
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="container mx-auto max-w-6xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 flex items-center justify-center gap-3">
            <ArrowRightLeft className="w-10 h-10 text-purple-600" />
            Points to Blockchain
          </h1>
          <p className="text-gray-600 mt-2">Convert your off-chain points to $LAB tokens</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <Coins className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Available Points</p>
              <p className="text-3xl font-bold text-gray-900">{playerPoints.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Conversion Rate</p>
              <p className="text-xl font-bold text-green-600">{conversionRate} points = 1 LAB</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Gift className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Convertible Tokens</p>
              <p className="text-3xl font-bold text-purple-600">
                {Math.floor(playerPoints / conversionRate).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Conversion Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Conversion Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5" />
                Convert Points
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Quick Conversion Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Quick Convert Options
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleConvertPoints(500)}
                    disabled={playerPoints < 500 || loading}
                    className="p-4"
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold">500 Points</div>
                      <div className="text-sm text-gray-600">→ 5 LAB</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleConvertPoints(1000)}
                    disabled={playerPoints < 1000 || loading}
                    className="p-4"
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold">1,000 Points</div>
                      <div className="text-sm text-gray-600">→ 10 LAB</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleConvertPoints(2500)}
                    disabled={playerPoints < 2500 || loading}
                    className="p-4"
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold">2,500 Points</div>
                      <div className="text-sm text-gray-600">→ 25 LAB</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleConvertPoints(playerPoints)}
                    disabled={playerPoints < conversionRate || loading}
                    className="p-4"
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold">All Points</div>
                      <div className="text-sm text-gray-600">→ {Math.floor(playerPoints / conversionRate)} LAB</div>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Conversion Info */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">How it Works</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Convert your earned points to $LAB tokens</li>
                  <li>• Current rate: {conversionRate} points = 1 LAB token</li>
                  <li>• Minimum conversion: {conversionRate} points</li>
                  <li>• Tokens are sent directly to your wallet</li>
                  <li>• Conversion is irreversible</li>
                </ul>
              </div>

              {/* Transaction Status */}
              {(isWritePending || isConfirming) && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-600 animate-spin" />
                    <span className="font-medium text-yellow-800">
                      {isWritePending ? 'Preparing transaction...' : 'Confirming transaction...'}
                    </span>
                  </div>
                </div>
              )}

              {isConfirmed && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">
                      Conversion successful!
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversion History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Conversion History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {conversionHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ArrowRightLeft className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p>No conversions yet</p>
                  <p className="text-sm">Your conversion history will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversionHistory.map((conversion) => (
                    <div key={conversion.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold">
                            {conversion.amount_points.toLocaleString()} Points → {conversion.amount_tokens} LAB
                          </p>
                          <p className="text-sm text-gray-600">
                            {conversion.timestamp.toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={conversion.status === 'completed' ? 'default' : 'secondary'}>
                          {conversion.status}
                        </Badge>
                      </div>
                      
                      {conversion.tx_hash && (
                        <p className="text-xs text-gray-500">
                          Tx: <code className="bg-gray-100 px-1 rounded">{conversion.tx_hash}</code>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coming Soon Notice */}
        <Card className="mt-8 border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
              <h3 className="text-xl font-bold text-yellow-800">Feature Preview</h3>
            </div>
            <p className="text-yellow-700 mb-4">
              The Points to Blockchain conversion system is currently in development. This preview shows the interface and functionality that will be available in the upcoming release.
            </p>
            <div className="space-y-2 text-sm text-yellow-600">
              <p><strong>Coming in v2.0:</strong></p>
              <p>• Full smart contract integration</p>
              <p>• Merkle proof generation for conversions</p>
              <p>• Real-time blockchain transactions</p>
              <p>• Automatic point deduction after successful conversion</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default PointsToBlockchain;