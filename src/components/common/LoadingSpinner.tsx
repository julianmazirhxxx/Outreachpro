import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Crown, Activity } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

export function LoadingSpinner({ size = 'md', message, className = '' }: LoadingSpinnerProps) {
  const { theme } = useTheme();
  
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  };
  
  const iconSizes = {
    sm: 'h-2 w-2',
    md: 'h-4 w-4',
    lg: 'h-6 w-6'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative">
        <div className={`animate-spin rounded-full ${sizeClasses[size]} border-4 ${
          theme === 'gold'
            ? 'border-yellow-400/20 border-t-yellow-400'
            : 'border-blue-600/20 border-t-blue-600'
        }`}></div>
      </div>
      {message && (
        <p className={`mt-3 text-sm ${
          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {message}
        </p>
      )}
    </div>
  );
}