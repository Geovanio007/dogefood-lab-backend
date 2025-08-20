import React from 'react';

const DogeFoodLogo = ({ 
  size = "medium", 
  showText = true, 
  showBeta = false,
  className = "",
  textClassName = ""
}) => {
  const sizeClasses = {
    small: "h-8 w-auto",
    medium: "h-16 w-auto", 
    large: "h-24 w-auto",
    xlarge: "h-32 w-auto",
    hero: "h-40 w-auto"
  };

  const textSizeClasses = {
    small: "text-xl",
    medium: "text-3xl", 
    large: "text-5xl",
    xlarge: "text-6xl",
    hero: "text-7xl"
  };

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Logo Image */}
      <img
        src="/dogefood-logo.png"
        alt="DogeFood Lab Logo"
        className={`${sizeClasses[size]} object-contain drop-shadow-lg`}
      />
      
      {/* Optional Text */}
      {showText && (
        <div className="flex items-center gap-3">
          <h1 className={`playful-title bubble-text ${textSizeClasses[size]} ${textClassName}`}>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-800 via-yellow-600 to-orange-700 drop-shadow-2xl font-black">
              DogeFood Lab
            </span>
            <span className={`ml-3 drop-shadow-xl ${size === 'small' ? 'text-lg' : size === 'medium' ? 'text-2xl' : size === 'large' ? 'text-4xl' : size === 'xlarge' ? 'text-5xl' : 'text-6xl'}`}>
              🧪
            </span>
          </h1>
          
          {/* Optional Beta Badge */}
          {showBeta && (
            <div className="ml-2">
              <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-lg px-4 py-2 playful-text shadow-xl rounded-full font-bold">
                BETA
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DogeFoodLogo;