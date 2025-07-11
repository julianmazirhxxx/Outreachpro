import { supabase } from './supabase';
import { SecurityManager } from '../utils/security';
import { PerformanceOptimizer } from '../utils/performance';
import { InputValidator } from '../utils/validation';

// API Response wrapper for consistent error handling
interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// Rate limiter for API calls
const apiRateLimiter = SecurityManager.createRateLimiter(100, 60000); // 100 requests per minute

// Cache for frequently accessed data
class ApiCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  set(key: string, data: any, ttl: number = 300000): void { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
}

const apiCache = new ApiCache();

// Secure API client with rate limiting and caching
export class SecureApiClient {
  private static instance: SecureApiClient;
  
  static getInstance(): SecureApiClient {
    if (!SecureApiClient.instance) {
      SecureApiClient.instance = new SecureApiClient();
    }
    return SecureApiClient.instance;
  }
  
  private async checkRateLimit(userId: string): Promise<boolean> {
    return apiRateLimiter(userId);
  }
  
  private getCacheKey(table: string, filters: Record<string, any> = {}): string {
    return `${table}_${JSON.stringify(filters)}`;
  }
  
  // Secure database operations with validation and caching
  async secureQuery<T>(
    table: string,
    options: {
      select?: string;
      filters?: Record<string, any>;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
      userId: string;
      useCache?: boolean;
      cacheTtl?: number;
    }
  ): Promise<ApiResponse<T[]>> {
    try {
      // Rate limiting
      if (!await this.checkRateLimit(options.userId)) {
        return {
          data: null,
          error: 'Rate limit exceeded. Please try again later.',
          success: false
        };
      }
      
      // Check cache first
      const cacheKey = this.getCacheKey(table, options.filters);
      if (options.useCache !== false) {
        const cached = apiCache.get(cacheKey);
        if (cached) {
          return {
            data: cached,
            error: null,
            success: true
          };
        }
      }
      
      // Validate filters
      if (options.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          if (typeof value === 'string') {
            const sanitized = SecurityManager.sanitizeInput(value);
            if (sanitized !== value) {
              return {
                data: null,
                error: 'Invalid input detected',
                success: false
              };
            }
          }
        }
      }
      
      // Build query
      let query = supabase.from(table).select(options.select || '*');
      
      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }
      
      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy.column, { 
          ascending: options.orderBy.ascending ?? true 
        });
      }
      
      // Apply limit
      if (options.limit) {
        query = query.limit(Math.min(options.limit, 1000)); // Max 1000 records
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Cache successful results
      if (data && options.useCache !== false) {
        apiCache.set(cacheKey, data, options.cacheTtl);
      }
      
      return {
        data: data as T[],
        error: null,
        success: true
      };
      
    } catch (error) {
      console.error(`Secure query error for table ${table}:`, error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Database query failed',
        success: false
      };
    }
  }
  
  // Secure insert with validation
  async secureInsert<T>(
    table: string,
    data: Record<string, any>,
    options: {
      userId: string;
      validate?: boolean;
    }
  ): Promise<ApiResponse<T>> {
    try {
      // Rate limiting
      if (!await this.checkRateLimit(options.userId)) {
        return {
          data: null,
          error: 'Rate limit exceeded. Please try again later.',
          success: false
        };
      }
      
      // Validate and sanitize input
      const sanitizedData: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          sanitizedData[key] = SecurityManager.sanitizeInput(value);
          
          // Additional validation based on field type
          if (key.includes('email')) {
            const emailValidation = InputValidator.validateEmail(value);
            if (!emailValidation.isValid) {
              return {
                data: null,
                error: emailValidation.errors[0],
                success: false
              };
            }
          }
          
          if (key.includes('phone')) {
            const phoneValidation = InputValidator.validatePhone(value);
            if (!phoneValidation.isValid) {
              return {
                data: null,
                error: phoneValidation.errors[0],
                success: false
              };
            }
          }
          
          if (key.includes('url')) {
            const urlValidation = InputValidator.validateUrl(value);
            if (!urlValidation.isValid) {
              return {
                data: null,
                error: urlValidation.errors[0],
                success: false
              };
            }
          }
        } else {
          sanitizedData[key] = value;
        }
      }
      
      const { data: result, error } = await supabase
        .from(table)
        .insert(sanitizedData)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Clear related cache entries
      this.clearRelatedCache(table);
      
      return {
        data: result as T,
        error: null,
        success: true
      };
      
    } catch (error) {
      console.error(`Secure insert error for table ${table}:`, error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Insert operation failed',
        success: false
      };
    }
  }
  
  // Secure update with validation
  async secureUpdate<T>(
    table: string,
    id: string,
    data: Record<string, any>,
    options: {
      userId: string;
      validate?: boolean;
    }
  ): Promise<ApiResponse<T>> {
    try {
      // Rate limiting
      if (!await this.checkRateLimit(options.userId)) {
        return {
          data: null,
          error: 'Rate limit exceeded. Please try again later.',
          success: false
        };
      }
      
      // Validate ID
      const idValidation = InputValidator.validateUuid(id);
      if (!idValidation.isValid) {
        return {
          data: null,
          error: 'Invalid ID format',
          success: false
        };
      }
      
      // Sanitize data (same as insert)
      const sanitizedData: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          sanitizedData[key] = SecurityManager.sanitizeInput(value);
        } else {
          sanitizedData[key] = value;
        }
      }
      
      const { data: result, error } = await supabase
        .from(table)
        .update(sanitizedData)
        .eq('id', id)
        .eq('user_id', options.userId) // Ensure user can only update their own data
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Clear related cache entries
      this.clearRelatedCache(table);
      
      return {
        data: result as T,
        error: null,
        success: true
      };
      
    } catch (error) {
      console.error(`Secure update error for table ${table}:`, error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Update operation failed',
        success: false
      };
    }
  }
  
  // Secure delete with ownership verification
  async secureDelete(
    table: string,
    id: string,
    options: {
      userId: string;
    }
  ): Promise<ApiResponse<boolean>> {
    try {
      // Rate limiting
      if (!await this.checkRateLimit(options.userId)) {
        return {
          data: null,
          error: 'Rate limit exceeded. Please try again later.',
          success: false
        };
      }
      
      // Validate ID
      const idValidation = InputValidator.validateUuid(id);
      if (!idValidation.isValid) {
        return {
          data: null,
          error: 'Invalid ID format',
          success: false
        };
      }
      
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
        .eq('user_id', options.userId); // Ensure user can only delete their own data
      
      if (error) {
        throw error;
      }
      
      // Clear related cache entries
      this.clearRelatedCache(table);
      
      return {
        data: true,
        error: null,
        success: true
      };
      
    } catch (error) {
      console.error(`Secure delete error for table ${table}:`, error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Delete operation failed',
        success: false
      };
    }
  }
  
  // Batch operations with transaction-like behavior
  async secureBatchInsert<T>(
    table: string,
    dataArray: Record<string, any>[],
    options: {
      userId: string;
      batchSize?: number;
    }
  ): Promise<ApiResponse<T[]>> {
    try {
      // Rate limiting
      if (!await this.checkRateLimit(options.userId)) {
        return {
          data: null,
          error: 'Rate limit exceeded. Please try again later.',
          success: false
        };
      }
      
      const batchSize = options.batchSize || 100;
      const batches = PerformanceOptimizer.batchOperations(dataArray, batchSize);
      const results: T[] = [];
      
      for (const batch of batches) {
        // Sanitize each batch
        const sanitizedBatch = batch.map(item => {
          const sanitized: Record<string, any> = {};
          for (const [key, value] of Object.entries(item)) {
            if (typeof value === 'string') {
              sanitized[key] = SecurityManager.sanitizeInput(value);
            } else {
              sanitized[key] = value;
            }
          }
          return sanitized;
        });
        
        const { data, error } = await supabase
          .from(table)
          .insert(sanitizedBatch)
          .select();
        
        if (error) {
          throw error;
        }
        
        if (data) {
          results.push(...(data as T[]));
        }
      }
      
      // Clear related cache entries
      this.clearRelatedCache(table);
      
      return {
        data: results,
        error: null,
        success: true
      };
      
    } catch (error) {
      console.error(`Secure batch insert error for table ${table}:`, error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Batch insert operation failed',
        success: false
      };
    }
  }
  
  private clearRelatedCache(table: string): void {
    // Clear all cache entries related to this table
    for (const key of apiCache['cache'].keys()) {
      if (key.startsWith(table)) {
        apiCache.delete(key);
      }
    }
  }
  
  // Clear all cache
  clearCache(): void {
    apiCache.clear();
  }
}

// Export singleton instance
export const secureApi = SecureApiClient.getInstance();

// Utility functions for common operations
export const ApiUtils = {
  // Debounced search function
  createDebouncedSearch: <T>(
    searchFn: (query: string) => Promise<ApiResponse<T[]>>,
    delay: number = 300
  ) => {
    return PerformanceOptimizer.debounce(searchFn, delay);
  },
  
  // Optimistic updates
  optimisticUpdate: <T>(
    currentData: T[],
    newItem: T,
    operation: 'add' | 'update' | 'delete',
    idField: keyof T = 'id' as keyof T
  ): T[] => {
    switch (operation) {
      case 'add':
        return [...currentData, newItem];
      case 'update':
        return currentData.map(item => 
          item[idField] === newItem[idField] ? newItem : item
        );
      case 'delete':
        return currentData.filter(item => item[idField] !== newItem[idField]);
      default:
        return currentData;
    }
  },
  
  // Retry mechanism for failed requests
  withRetry: async <T>(
    operation: () => Promise<ApiResponse<T>>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<ApiResponse<T>> => {
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        if (result.success) {
          return result;
        }
        lastError = result.error || 'Unknown error';
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    
    return {
      data: null,
      error: `Operation failed after ${maxRetries} attempts: ${lastError}`,
      success: false
    };
  }
};