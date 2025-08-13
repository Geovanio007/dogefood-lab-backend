import React from 'react';

// Temporary minimal provider while we set up WalletConnect properly
export const Web3Provider = ({ children }) => {
  return (
    <div>
      {children}
    </div>
  );
};