import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

const CharacterSelection = ({ onCharacterSelected }) => {
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  
  // Debug log to confirm component is rendering
  console.log('CharacterSelection component rendered');

  const characters = [
    {
      id: 'max',
      name: 'Shiba Scientist Max',
      description: 'The clever and curious one',
      personality: 'Methodical and analytical, Max loves to understand the science behind every reaction.',
      image: 'https://customer-assets.emergentagent.com/job_50ed16dc-caaa-4db1-ad7d-d26be77125c0/artifacts/m1k3hm3c_assets_task_01k5p7arcvf6jt34pk82yke1sh_1758461571_img_0.webp', // Max with glasses
      traits: ['🧠 Analytical', '🔬 Precise', '📚 Studious'],
      bonus: '+10% Experience from treats'
    },
    {
      id: 'rex',
      name: 'Shiba Scientist Rex',
      description: 'The mischievous genius',
      personality: 'Bold and experimental, Rex loves to try wild combinations and discover new possibilities.',
      image: 'https://customer-assets.emergentagent.com/job_50ed16dc-caaa-4db1-ad7d-d26be77125c0/artifacts/w3y5oh69_assets_task_01k5p6sq20fh68gb4hjbs9271e_1758460753_img_0.webp', // Rex the mischievous genius
      traits: ['⚡ Creative', '🎯 Risk-taker', '🎪 Playful'],
      bonus: '+15% Rare treat chance'
    },
    {
      id: 'luna',
      name: 'Shiba Scientist Luna',
      description: 'The smart and fearless female scientist',
      personality: 'Confident and innovative, Luna excels at optimization and efficiency in the lab.',
      image: 'https://customer-assets.emergentagent.com/job_50ed16dc-caaa-4db1-ad7d-d26be77125c0/artifacts/5thty2tp_20250921_1510_Doge%20Scientist%20Trio_simple_compose_01k5p68s01e1p8f81hk4dvm5tm.png', // Luna with pink
      traits: ['💪 Fearless', '⚡ Efficient', '🌟 Innovative'],
      bonus: '+20% Points from treats'
    }
  ];

  const handleCharacterSelect = (character) => {
    setSelectedCharacter(character);
  };

  const handleConfirmSelection = () => {
    if (selectedCharacter) {
      // Store character selection in localStorage
      localStorage.setItem('selectedCharacter', JSON.stringify(selectedCharacter));
      console.log('Character confirmed and stored:', selectedCharacter);
      onCharacterSelected(selectedCharacter);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            🧪 Choose Your Scientist! 🧪
          </h1>
          <p className="text-xl text-white/90 mb-2">
            Select your character to begin your DogeFood Lab adventure
          </p>
          <p className="text-lg text-yellow-400">
            Each scientist has unique bonuses and personality!
          </p>
        </div>

        {/* Character Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {characters.map((character) => (
            <Card
              key={character.id}
              className={`relative cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                selectedCharacter?.id === character.id
                  ? 'ring-4 ring-yellow-400 shadow-2xl shadow-yellow-400/30 bg-gradient-to-br from-yellow-100 to-orange-100'
                  : 'bg-white/95 hover:bg-white shadow-xl hover:shadow-2xl'
              }`}
              onClick={() => handleCharacterSelect(character)}
            >
              <CardHeader className="text-center">
                <div className="w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden border-4 border-blue-300 shadow-lg">
                  <img
                    src={character.image}
                    alt={character.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = '/placeholder-scientist.png';
                    }}
                  />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-800 mb-2">
                  {character.name}
                </CardTitle>
                <p className="text-lg text-blue-600 font-semibold">
                  {character.description}
                </p>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-gray-700 text-center leading-relaxed">
                  {character.personality}
                </p>
                
                {/* Character Traits */}
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-800 text-center">Traits:</h4>
                  <div className="flex flex-wrap justify-center gap-2">
                    {character.traits.map((trait, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Special Bonus */}
                <div className="bg-gradient-to-r from-green-100 to-emerald-100 p-3 rounded-lg border-2 border-green-300">
                  <h4 className="font-bold text-green-800 text-center mb-1">Special Bonus:</h4>
                  <p className="text-green-700 text-center font-semibold">
                    {character.bonus}
                  </p>
                </div>

                {/* Selection Indicator */}
                {selectedCharacter?.id === character.id && (
                  <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 p-2 rounded-full shadow-lg">
                    <span className="text-2xl">✨</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Confirm Selection Button */}
        <div className="text-center">
          <Button
            onClick={handleConfirmSelection}
            disabled={!selectedCharacter}
            className={`text-2xl font-bold py-6 px-12 rounded-xl shadow-2xl transition-all duration-300 ${
              selectedCharacter
                ? 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white hover:scale-105 shadow-yellow-400/30'
                : 'bg-gray-400 text-gray-600 cursor-not-allowed'
            }`}
          >
            {selectedCharacter ? (
              <>
                🚀 Start Adventure with {selectedCharacter.name.split(' ')[2]}! 
              </>
            ) : (
              'Please select a character'
            )}
          </Button>
          
          {selectedCharacter && (
            <p className="text-white/80 mt-4 text-lg">
              Ready to begin your scientific journey? Let's go! 🧪✨
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterSelection;