import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, Box, Cylinder } from '@react-three/drei';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { useGame } from '../contexts/GameContext';
import { ArrowLeft, Zap, Star, Sparkles } from 'lucide-react';
import { useToast } from './ui/use-toast';

// 3D Mixing Station Component
const MixingStation = ({ isActive, ingredients, onMix }) => {
  const meshRef = useRef();
  
  useEffect(() => {
    if (meshRef.current && isActive) {
      // Simple rotation animation
      const interval = setInterval(() => {
        if (meshRef.current) {
          meshRef.current.rotation.y += 0.05;
        }
      }, 50);
      
      return () => clearInterval(interval);
    }
  }, [isActive]);

  return (
    <group>
      {/* Main beaker */}
      <Cylinder
        ref={meshRef}
        args={[1, 1.5, 3, 32]}
        position={[0, 0, 0]}
        onClick={onMix}
      >
        <meshStandardMaterial
          color={isActive ? "#FFD700" : "#B57B2E"}
          transparent
          opacity={0.8}
        />
      </Cylinder>
      
      {/* Bubbles when mixing */}
      {isActive && ingredients.length > 0 && (
        <>
          <Sphere args={[0.1]} position={[-0.3, 0.5, 0]}>
            <meshStandardMaterial color="#B6E57D" />
          </Sphere>
          <Sphere args={[0.15]} position={[0.2, 0.8, 0.2]}>
            <meshStandardMaterial color="#FFD700" />
          </Sphere>
          <Sphere args={[0.1]} position={[0.4, 0.3, -0.2]}>
            <meshStandardMaterial color="#FFA500" />
          </Sphere>
        </>
      )}
      
      {/* Base */}
      <Box args={[3, 0.5, 3]} position={[0, -2, 0]}>
        <meshStandardMaterial color="#8B4513" />
      </Box>
    </group>
  );
};

const GameLab = () => {
  const {
    currentLevel,
    experience,
    points,
    ingredients,
    createdTreats,
    mixing,
    isNFTHolder,
    startMixing,
    completeMixing,
    dispatch
  } = useGame();
  
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [mixingProgress, setMixingProgress] = useState(0);
  const { toast } = useToast();

  // Calculate level progress
  const levelProgress = (experience % 100);
  const nextLevel = currentLevel + 1;

  const handleIngredientSelect = (ingredientId) => {
    if (mixing.active) return;
    
    if (selectedIngredients.includes(ingredientId)) {
      setSelectedIngredients(selectedIngredients.filter(id => id !== ingredientId));
    } else if (selectedIngredients.length < 3) {
      setSelectedIngredients([...selectedIngredients, ingredientId]);
    } else {
      toast({
        title: "Ingredient Limit Reached!",
        description: "You can only mix 3 ingredients at a time.",
        variant: "destructive"
      });
    }
  };

  const handleStartMixing = () => {
    if (selectedIngredients.length === 0) {
      toast({
        title: "No Ingredients Selected!",
        description: "Please select at least one ingredient to start mixing.",
        variant: "destructive"
      });
      return;
    }

    startMixing(selectedIngredients);
    setMixingProgress(0);

    // Simulate mixing progress
    const interval = setInterval(() => {
      setMixingProgress(prev => {
        const newProgress = prev + 10;
        dispatch({ type: 'UPDATE_MIXING_PROGRESS', payload: newProgress });
        
        if (newProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            completeMixing();
            setSelectedIngredients([]);
            setMixingProgress(0);
            
            toast({
              title: "Mixing Complete! 🎉",
              description: "Your new Dogetreat has been created!",
              className: "bg-green-100 border-green-400"
            });
          }, 500);
        }
        return newProgress;
      });
    }, 300);
  };

  const getIngredientEmoji = (type) => {
    switch (type) {
      case 'legendary': return '💎';
      case 'special': return '🌟';
      case 'flavor': return '🎨';
      default: return '🥣';
    }
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'Legendary': return 'bg-purple-500';
      case 'Epic': return 'bg-pink-500';
      case 'Rare': return 'bg-blue-500';
      default: return 'bg-green-500';
    }
  };

  return (
    <div className="lab-container min-h-screen p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Menu
            </Button>
          </Link>
          <div className="lab-level-indicator">
            Level {currentLevel} Lab
          </div>
          {isNFTHolder && (
            <Badge className="vip-badge">VIP Scientist</Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="glass-panel p-3">
            <div className="text-sm text-gray-600">Points</div>
            <div className="font-bold text-xl text-yellow-600">{points}</div>
          </div>
          <div className="glass-panel p-3">
            <div className="text-sm text-gray-600">Treats Created</div>
            <div className="font-bold text-xl text-purple-600">{createdTreats.length}</div>
          </div>
        </div>
      </div>

      {/* Experience Bar */}
      <Card className="glass-panel mb-8">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Experience Progress</span>
            <span className="text-sm text-gray-600">
              {experience} XP • Next: Level {nextLevel}
            </span>
          </div>
          <Progress value={levelProgress} className="h-3" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Sidebar - Ingredients */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Ingredient Shelf
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {ingredients.map((ingredient) => (
                <div
                  key={ingredient.id}
                  onClick={() => ingredient.unlocked && handleIngredientSelect(ingredient.id)}
                  className={`
                    ingredient-slot p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${!ingredient.unlocked ? 'opacity-50 cursor-not-allowed' : ''}
                    ${selectedIngredients.includes(ingredient.id) ? 'border-yellow-400 bg-yellow-100' : 'border-gray-300'}
                    ${ingredient.unlocked && !mixing.active ? 'hover:border-yellow-400 hover:bg-yellow-50' : ''}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getIngredientEmoji(ingredient.type)}</span>
                    <div>
                      <div className="font-medium">{ingredient.name}</div>
                      <div className="text-xs text-gray-500 capitalize">{ingredient.type}</div>
                    </div>
                    {!ingredient.unlocked && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                        Level {ingredient.type === 'special' ? '2+' : '5+'} Required
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium mb-2">Selected Ingredients:</div>
              <div className="flex flex-wrap gap-2">
                {selectedIngredients.length > 0 ? (
                  selectedIngredients.map((id) => {
                    const ingredient = ingredients.find(ing => ing.id === id);
                    return (
                      <Badge key={id} variant="secondary" className="text-xs">
                        {ingredient?.name}
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-xs text-gray-500">None selected</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Center - 3D Mixing Station */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Zap className="w-5 h-5" />
              Mixing Station
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 mb-6">
              <Canvas camera={{ position: [0, 2, 5] }}>
                <ambientLight intensity={0.6} />
                <pointLight position={[10, 10, 10]} />
                <MixingStation
                  isActive={mixing.active}
                  ingredients={selectedIngredients}
                  onMix={handleStartMixing}
                />
                <OrbitControls enableZoom={false} />
              </Canvas>
            </div>
            
            {mixing.active ? (
              <div className="text-center">
                <div className="mb-4">
                  <div className="text-lg font-bold text-yellow-600 mb-2">
                    Mixing in Progress... 🧪
                  </div>
                  <Progress value={mixingProgress} className="h-3" />
                </div>
                <div className="text-sm text-gray-600">
                  Creating something magical... ✨
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Button
                  onClick={handleStartMixing}
                  className="doge-button w-full"
                  disabled={selectedIngredients.length === 0}
                >
                  {selectedIngredients.length === 0 ? 'Select Ingredients First' : `Mix ${selectedIngredients.length} Ingredients`}
                </Button>
                <div className="text-sm text-gray-500 mt-2">
                  Click the mixing station or button to start!
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Sidebar - Recent Treats */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              Recent Creations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {createdTreats.length > 0 ? (
                createdTreats.slice(-10).reverse().map((treat) => (
                  <div
                    key={treat.id}
                    className="p-3 bg-white/20 rounded-lg border border-white/30"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{treat.image}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{treat.name}</div>
                        <div className="text-xs text-gray-600 mb-1">{treat.flavor}</div>
                        <Badge className={`text-xs ${getRarityColor(treat.rarity)}`}>
                          {treat.rarity}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No treats created yet!</p>
                  <p className="text-xs">Start mixing to create your first Dogetreat.</p>
                </div>
              )}
            </div>
            
            {createdTreats.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <Link to="/nfts">
                  <Button variant="outline" className="w-full text-sm">
                    View All Treats →
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tips Section */}
      <Card className="glass-panel mt-8">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl mb-2">🥇</div>
              <h4 className="font-bold mb-1">Mix Quality Ingredients</h4>
              <p className="text-sm text-gray-600">Combine rare ingredients for legendary treats!</p>
            </div>
            <div>
              <div className="text-2xl mb-2">⭐</div>
              <h4 className="font-bold mb-1">Level Up Fast</h4>
              <p className="text-sm text-gray-600">Higher levels unlock special ingredients.</p>
            </div>
            <div>
              <div className="text-2xl mb-2">🏆</div>
              <h4 className="font-bold mb-1">Earn Points</h4>
              <p className="text-sm text-gray-600">NFT holders earn points for the leaderboard!</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GameLab;