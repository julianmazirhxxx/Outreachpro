import { useState, useCallback } from 'react';

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  success: string | null;
}

export const useLoadingState = (initialState: Partial<LoadingState> = {}) => {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    error: null,
    success: null,
    ...initialState
  });

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({
      ...prev,
      isLoading: loading,
      error: loading ? null : prev.error, // Clear error when starting new operation
      success: loading ? null : prev.success // Clear success when starting new operation
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({
      ...prev,
      error,
      isLoading: false,
      success: null
    }));
  }, []);

  const setSuccess = useCallback((success: string | null) => {
    setState(prev => ({
      ...prev,
      success,
      isLoading: false,
      error: null
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      success: null
    });
  }, []);

  const executeAsync = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    options: {
      successMessage?: string;
      errorMessage?: string;
      onSuccess?: (data: T) => void;
      onError?: (error: any) => void;
    } = {}
  ): Promise<T | null> => {
    const { successMessage, errorMessage, onSuccess, onError } = options;
    
    setLoading(true);
    
    try {
      const result = await asyncFn();
      
      if (successMessage) {
        setSuccess(successMessage);
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
      
      onSuccess?.(result);
      return result;
    } catch (error) {
      const message = errorMessage || 
        (error instanceof Error ? error.message : 'An error occurred');
      
      setError(message);
      onError?.(error);
      return null;
    }
  }, [setLoading, setError, setSuccess]);

  return {
    ...state,
    setLoading,
    setError,
    setSuccess,
    reset,
    executeAsync
  };
};