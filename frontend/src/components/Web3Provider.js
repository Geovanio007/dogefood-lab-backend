import React from 'react';
import { Web3Provider as WagmiWeb3Provider } from '../config/wagmi';

export const Web3Provider = ({ children }) => {
  return (
    <WagmiWeb3Provider>
      {children}
    </WagmiWeb3Provider>
  );
};