import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { secureApi, ApiResponse } from '../lib/api';
import { useErrorHandler } from './useErrorHandler';
import { useLoadingState } from './useLoadingState';

// Generic hook for secure API operations
export function useSecureApi<T>() {
  const { user } = useAuth();
  const { handleError } = useErrorHandler();
  const { isLoading, setLoading, setError, setSuccess } = useLoadingState();

  const query = useCallback(async (
    table: string,
    options: {
      select?: string;
      filters?: Record<string, any>;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
      useCache?: boolean;
      cacheTtl?: number;
    } = {}
  ): Promise<T[] | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    setLoading(true);
    try {
      const response = await secureApi.secureQuery<T>(table, {
        ...options,
        userId: user.id
      });

      if (!response.success) {
        setError(response.error || 'Query failed');
        return null;
      }

      return response.data;
    } catch (error) {
      const errorInfo = handleError(error, `Query ${table}`);
      setError(errorInfo.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, setLoading, setError, handleError]);

  const insert = useCallback(async (
    table: string,
    data: Record<string, any>
  ): Promise<T | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    setLoading(true);
    try {
      const response = await secureApi.secureInsert<T>(table, data, {
        userId: user.id,
        validate: true
      });

      if (!response.success) {
        setError(response.error || 'Insert failed');
        return null;
      }

      setSuccess('Record created successfully');
      return response.data;
    } catch (error) {
      const errorInfo = handleError(error, `Insert ${table}`);
      setError(errorInfo.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, setLoading, setError, setSuccess, handleError]);

  const update = useCallback(async (
    table: string,
    id: string,
    data: Record<string, any>
  ): Promise<T | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    setLoading(true);
    try {
      const response = await secureApi.secureUpdate<T>(table, id, data, {
        userId: user.id,
        validate: true
      });

      if (!response.success) {
        setError(response.error || 'Update failed');
        return null;
      }

      setSuccess('Record updated successfully');
      return response.data;
    } catch (error) {
      const errorInfo = handleError(error, `Update ${table}`);
      setError(errorInfo.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, setLoading, setError, setSuccess, handleError]);

  const remove = useCallback(async (
    table: string,
    id: string
  ): Promise<boolean> => {
    if (!user) {
      setError('User not authenticated');
      return false;
    }

    setLoading(true);
    try {
      const response = await secureApi.secureDelete(table, id, {
        userId: user.id
      });

      if (!response.success) {
        setError(response.error || 'Delete failed');
        return false;
      }

      setSuccess('Record deleted successfully');
      return true;
    } catch (error) {
      const errorInfo = handleError(error, `Delete ${table}`);
      setError(errorInfo.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, setLoading, setError, setSuccess, handleError]);

  const batchInsert = useCallback(async (
    table: string,
    dataArray: Record<string, any>[],
    batchSize?: number
  ): Promise<T[] | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    setLoading(true);
    try {
      const response = await secureApi.secureBatchInsert<T>(table, dataArray, {
        userId: user.id,
        batchSize
      });

      if (!response.success) {
        setError(response.error || 'Batch insert failed');
        return null;
      }

      setSuccess(`${response.data?.length || 0} records created successfully`);
      return response.data;
    } catch (error) {
      const errorInfo = handleError(error, `Batch insert ${table}`);
      setError(errorInfo.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, setLoading, setError, setSuccess, handleError]);

  return {
    query,
    insert,
    update,
    remove,
    batchInsert,
    isLoading
  };
}

// Specialized hooks for common entities
export function useCampaigns() {
  const api = useSecureApi<any>();
  
  const getCampaigns = useCallback(() => {
    return api.query('campaigns', {
      orderBy: { column: 'created_at', ascending: false },
      useCache: true,
      cacheTtl: 300000 // 5 minutes
    });
  }, [api]);

  const createCampaign = useCallback((data: Record<string, any>) => {
    return api.insert('campaigns', data);
  }, [api]);

  const updateCampaign = useCallback((id: string, data: Record<string, any>) => {
    return api.update('campaigns', id, data);
  }, [api]);

  const deleteCampaign = useCallback((id: string) => {
    return api.remove('campaigns', id);
  }, [api]);

  return {
    getCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    isLoading: api.isLoading
  };
}

export function useLeads() {
  const api = useSecureApi<any>();
  
  const getLeads = useCallback((campaignId?: string) => {
    const filters = campaignId ? { campaign_id: campaignId } : {};
    return api.query('uploaded_leads', {
      filters,
      orderBy: { column: 'created_at', ascending: false },
      useCache: true,
      cacheTtl: 60000 // 1 minute
    });
  }, [api]);

  const createLead = useCallback((data: Record<string, any>) => {
    return api.insert('uploaded_leads', data);
  }, [api]);

  const updateLead = useCallback((id: string, data: Record<string, any>) => {
    return api.update('uploaded_leads', id, data);
  }, [api]);

  const deleteLead = useCallback((id: string) => {
    return api.remove('uploaded_leads', id);
  }, [api]);

  const batchCreateLeads = useCallback((leads: Record<string, any>[]) => {
    return api.batchInsert('uploaded_leads', leads, 100);
  }, [api]);

  return {
    getLeads,
    createLead,
    updateLead,
    deleteLead,
    batchCreateLeads,
    isLoading: api.isLoading
  };
}

export function useChannels() {
  const api = useSecureApi<any>();
  
  const getChannels = useCallback(() => {
    return api.query('channels', {
      orderBy: { column: 'created_at', ascending: false },
      useCache: true,
      cacheTtl: 600000 // 10 minutes
    });
  }, [api]);

  const createChannel = useCallback((data: Record<string, any>) => {
    return api.insert('channels', data);
  }, [api]);

  const updateChannel = useCallback((id: string, data: Record<string, any>) => {
    return api.update('channels', id, data);
  }, [api]);

  const deleteChannel = useCallback((id: string) => {
    return api.remove('channels', id);
  }, [api]);

  return {
    getChannels,
    createChannel,
    updateChannel,
    deleteChannel,
    isLoading: api.isLoading
  };
}

// Real-time data hook with optimistic updates
export function useRealtimeData<T>(
  table: string,
  filters?: Record<string, any>
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { handleError } = useErrorHandler();

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const response = await secureApi.secureQuery<T>(table, {
          filters,
          userId: user.id,
          useCache: true
        });

        if (response.success && response.data) {
          setData(response.data);
        }
      } catch (error) {
        handleError(error, `Realtime data fetch for ${table}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`realtime-${table}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table,
          filter: filters ? Object.entries(filters).map(([key, value]) => `${key}=eq.${value}`).join(',') : undefined
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setData(prev => [...prev, payload.new as T]);
          } else if (payload.eventType === 'UPDATE') {
            setData(prev => prev.map(item => 
              (item as any).id === (payload.new as any).id ? payload.new as T : item
            ));
          } else if (payload.eventType === 'DELETE') {
            setData(prev => prev.filter(item => 
              (item as any).id !== (payload.old as any).id
            ));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [table, user, filters, handleError]);

  const optimisticUpdate = useCallback((
    newItem: T,
    operation: 'add' | 'update' | 'delete'
  ) => {
    setData(prev => {
      switch (operation) {
        case 'add':
          return [...prev, newItem];
        case 'update':
          return prev.map(item => 
            (item as any).id === (newItem as any).id ? newItem : item
          );
        case 'delete':
          return prev.filter(item => 
            (item as any).id !== (newItem as any).id
          );
        default:
          return prev;
      }
    });
  }, []);

  return {
    data,
    loading,
    optimisticUpdate
  };
}