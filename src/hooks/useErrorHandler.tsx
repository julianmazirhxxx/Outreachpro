import { useCallback } from 'react';

interface ErrorHandlerResult {
  message: string;
  code?: string;
}

export function useErrorHandler() {
  const handleError = useCallback((error: any, context?: string): ErrorHandlerResult => {
    console.error(`Error in ${context || 'unknown context'}:`, error);
    
    let message = 'An unexpected error occurred';
    
    if (error?.message) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }
    
    return {
      message,
      code: error?.code
    };
  }, []);

  const handleAsyncError = useCallback(async (asyncFn: () => Promise<void>, context?: string) => {
    try {
      await asyncFn();
    } catch (error) {
      return handleError(error, context);
    }
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
  };
}