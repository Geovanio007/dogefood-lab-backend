import React from 'react';

// TreatIcon component - displays the custom treat icon
const TreatIcon = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
    '2xl': 'w-12 h-12',
  };

  return (
    <img 
      src="/treat-icon.png" 
      alt="Treat" 
      className={`inline-block object-contain ${sizeClasses[size] || sizeClasses.md} ${className}`}
    />
  );
};

export default TreatIcon;
