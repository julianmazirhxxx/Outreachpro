import { useState } from 'react';

interface LoadingState {
  isLoading: boolean;
  error: string;
  success: string;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  executeAsync: (
    asyncFn: () => Promise<void>,
    options?: { successMessage?: string; errorMessage?: string }
  ) => Promise<void>;
}

export function useLoadingState(): LoadingState {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const executeAsync = async (
    asyncFn: () => Promise<void>,
    options: { successMessage?: string; errorMessage?: string } = {}
  ) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await asyncFn();
      if (options.successMessage) {
        setSuccess(options.successMessage);
      }
    } catch (err) {
      const errorMessage = options.errorMessage || 
        (err instanceof Error ? err.message : 'An error occurred');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    success,
    setError,
    setSuccess,
    executeAsync,
  };
}