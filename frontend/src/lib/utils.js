import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Format numbers with commas
export function formatNumber(num) {
  return new Intl.NumberFormat().format(num);
}

// Format token amounts
export function formatTokenAmount(amount, decimals = 18, displayDecimals = 2) {
  const num = parseFloat(amount);
  if (num === 0) return '0';
  if (num < 0.01) return '< 0.01';
  return num.toFixed(displayDecimals);
}

// Truncate wallet address
export function truncateAddress(address, startLength = 6, endLength = 4) {
  if (!address) return '';
  if (address.length <= startLength + endLength) return address;
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

// Sleep utility
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}