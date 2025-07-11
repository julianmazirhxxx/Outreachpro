import { useCallback } from 'react';

export interface ErrorInfo {
  message: string;
  code?: string;
  details?: any;
  timestamp: Date;
}

export const useErrorHandler = () => {
  const handleError = useCallback((error: any, context?: string): ErrorInfo => {
    const errorInfo: ErrorInfo = {
      message: 'An unexpected error occurred',
      timestamp: new Date()
    };

    // Parse different error types
    if (error?.message) {
      errorInfo.message = error.message;
    } else if (typeof error === 'string') {
      errorInfo.message = error;
    }

    // Handle Supabase errors
    if (error?.code) {
      errorInfo.code = error.code;
      
      switch (error.code) {
        case 'over_email_send_rate_limit':
          errorInfo.message = 'Too many requests. Please wait a few seconds before trying again.';
          break;
        case 'PGRST116':
          errorInfo.message = 'No data found';
          break;
        case '23505':
          errorInfo.message = 'This record already exists';
          break;
        case '23503':
          errorInfo.message = 'Cannot delete - record is being used elsewhere';
          break;
        case '42501':
          errorInfo.message = 'You do not have permission to perform this action';
          break;
        default:
          if (error.message) {
            errorInfo.message = error.message;
          }
      }
    }

    // Handle rate limit errors (HTTP 429)
    if (error?.status === 429 || error?.message?.includes('rate limit') || 
        error?.message?.includes('For security purposes, you can only request this after')) {
      
      // Extract specific wait time from the error message
      const waitTimeMatch = error?.message?.match(/after (\d+) seconds?/);
      if (waitTimeMatch) {
        const waitTime = waitTimeMatch[1];
        errorInfo.message = `Too many requests. Please try again after ${waitTime} seconds.`;
      } else {
        errorInfo.message = 'Too many requests. Please wait a few seconds before trying again.';
      }
      
      errorInfo.code = 'RATE_LIMIT_ERROR';
    }

    // Handle network errors
    if (error?.name === 'NetworkError' || error?.message?.includes('fetch')) {
      errorInfo.message = 'Network connection error. Please check your internet connection.';
      errorInfo.code = 'NETWORK_ERROR';
    }

    // Handle authentication errors
    if (error?.message?.includes('JWT') || error?.message?.includes('auth')) {
      errorInfo.message = 'Authentication error. Please sign in again.';
      errorInfo.code = 'AUTH_ERROR';
    }

    // Add context if provided
    if (context) {
      errorInfo.details = { context };
    }

    // Log error in development
    if (import.meta.env.DEV) {
      console.error(`Error in ${context || 'unknown context'}:`, error);
    }

    // In production, send to error tracking service
    if (import.meta.env.PROD) {
      // TODO: Send to error tracking service
      console.error('Production error:', {
        message: errorInfo.message,
        code: errorInfo.code,
        context,
        timestamp: errorInfo.timestamp
      });
    }

    return errorInfo;
  }, []);

  const handleAsyncError = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    context?: string
  ): Promise<{ data: T | null; error: ErrorInfo | null }> => {
    try {
      const data = await asyncFn();
      return { data, error: null };
    } catch (error) {
      const errorInfo = handleError(error, context);
      return { data: null, error: errorInfo };
    }
  }, [handleError]);

  return {
    handleError,
    handleAsyncError
  };
};