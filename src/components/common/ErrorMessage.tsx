import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { AlertCircle, XCircle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorMessage({ 
  title, 
  message, 
  type = 'error', 
  onRetry, 
  onDismiss,
  className = '' 
}: ErrorMessageProps) {
  const { theme } = useTheme();
  
  const getStyles = () => {
    switch (type) {
      case 'warning':
        return theme === 'gold'
          ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
          : 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return theme === 'gold'
          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          : 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return theme === 'gold'
          ? 'bg-red-500/10 border-red-500/30 text-red-400'
          : 'bg-red-50 border-red-200 text-red-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'warning':
      case 'info':
        return AlertCircle;
      default:
        return XCircle;
    }
  };

  const Icon = getIcon();

  return (
    <div className={`rounded-lg border p-4 ${getStyles()} ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium mb-1">
              {title}
            </h3>
          )}
          <p className="text-sm">
            {message}
          </p>
        </div>
        <div className="ml-3 flex space-x-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
              title="Retry"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
              title="Dismiss"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}