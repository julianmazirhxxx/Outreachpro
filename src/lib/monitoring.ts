// Production monitoring and analytics system
interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

interface ErrorEvent {
  message: string;
  stack?: string;
  timestamp: number;
  userId?: string;
  url: string;
  userAgent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
}

interface UserEvent {
  event: string;
  userId?: string;
  timestamp: number;
  properties?: Record<string, any>;
  sessionId: string;
}

class ProductionMonitor {
  private static instance: ProductionMonitor;
  private metrics: PerformanceMetric[] = [];
  private errors: ErrorEvent[] = [];
  private userEvents: UserEvent[] = [];
  private sessionId: string;
  private isProduction: boolean;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isProduction = import.meta.env.PROD;
    this.setupPerformanceObserver();
    this.setupErrorHandling();
    this.setupUserInteractionTracking();
  }

  static getInstance(): ProductionMonitor {
    if (!ProductionMonitor.instance) {
      ProductionMonitor.instance = new ProductionMonitor();
    }
    return ProductionMonitor.instance;
  }

  // Performance monitoring
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags
    };

    this.metrics.push(metric);
    
    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Send to analytics service in production
    if (this.isProduction) {
      this.sendToAnalytics('metric', metric);
    }
  }

  // Error tracking
  recordError(error: Error | string, severity: ErrorEvent['severity'] = 'medium', context?: Record<string, any>): void {
    const errorEvent: ErrorEvent = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' ? error.stack : undefined,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      severity,
      context
    };

    this.errors.push(errorEvent);
    
    // Keep only last 500 errors in memory
    if (this.errors.length > 500) {
      this.errors = this.errors.slice(-500);
    }

    // Send to error tracking service in production
    if (this.isProduction) {
      this.sendToAnalytics('error', errorEvent);
    }

    // Log critical errors immediately
    if (severity === 'critical') {
      console.error('Critical error recorded:', errorEvent);
    }
  }

  // User event tracking
  recordUserEvent(event: string, properties?: Record<string, any>, userId?: string): void {
    const userEvent: UserEvent = {
      event,
      userId,
      timestamp: Date.now(),
      properties,
      sessionId: this.sessionId
    };

    this.userEvents.push(userEvent);
    
    // Keep only last 1000 user events in memory
    if (this.userEvents.length > 1000) {
      this.userEvents = this.userEvents.slice(-1000);
    }

    // Send to analytics service in production
    if (this.isProduction) {
      this.sendToAnalytics('user_event', userEvent);
    }
  }

  // Performance timing
  time(label: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(`timing.${label}`, duration, { unit: 'ms' });
    };
  }

  // Async operation timing
  async timeAsync<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const endTimer = this.time(label);
    try {
      const result = await operation();
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      this.recordError(error as Error, 'medium', { operation: label });
      throw error;
    }
  }

  // Database operation monitoring
  monitorDatabaseOperation<T>(
    operation: string,
    table: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.timeAsync(`db.${operation}.${table}`, async () => {
      try {
        const result = await fn();
        this.recordUserEvent('database_operation', {
          operation,
          table,
          success: true
        });
        return result;
      } catch (error) {
        this.recordError(error as Error, 'high', {
          operation,
          table,
          type: 'database_error'
        });
        this.recordUserEvent('database_operation', {
          operation,
          table,
          success: false,
          error: (error as Error).message
        });
        throw error;
      }
    });
  }

  // API call monitoring
  monitorApiCall<T>(
    endpoint: string,
    method: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.timeAsync(`api.${method}.${endpoint}`, async () => {
      try {
        const result = await fn();
        this.recordUserEvent('api_call', {
          endpoint,
          method,
          success: true
        });
        return result;
      } catch (error) {
        this.recordError(error as Error, 'high', {
          endpoint,
          method,
          type: 'api_error'
        });
        this.recordUserEvent('api_call', {
          endpoint,
          method,
          success: false,
          error: (error as Error).message
        });
        throw error;
      }
    });
  }

  // Get performance summary
  getPerformanceSummary(): {
    metrics: {
      averageResponseTime: number;
      errorRate: number;
      totalEvents: number;
    };
    topErrors: Array<{ message: string; count: number }>;
    topEvents: Array<{ event: string; count: number }>;
  } {
    const timingMetrics = this.metrics.filter(m => m.name.startsWith('timing.'));
    const averageResponseTime = timingMetrics.length > 0
      ? timingMetrics.reduce((sum, m) => sum + m.value, 0) / timingMetrics.length
      : 0;

    const errorRate = this.errors.length / Math.max(this.userEvents.length, 1) * 100;

    // Count error occurrences
    const errorCounts = this.errors.reduce((acc, error) => {
      acc[error.message] = (acc[error.message] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));

    // Count event occurrences
    const eventCounts = this.userEvents.reduce((acc, event) => {
      acc[event.event] = (acc[event.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topEvents = Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([event, count]) => ({ event, count }));

    return {
      metrics: {
        averageResponseTime,
        errorRate,
        totalEvents: this.userEvents.length
      },
      topErrors,
      topEvents
    };
  }

  // Setup performance observer
  private setupPerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordMetric('page.load_time', navEntry.loadEventEnd - navEntry.navigationStart);
            this.recordMetric('page.dom_content_loaded', navEntry.domContentLoadedEventEnd - navEntry.navigationStart);
            this.recordMetric('page.first_paint', navEntry.responseEnd - navEntry.navigationStart);
          }
          
          if (entry.entryType === 'largest-contentful-paint') {
            this.recordMetric('page.lcp', entry.startTime);
          }
          
          if (entry.entryType === 'first-input') {
            this.recordMetric('page.fid', (entry as any).processingStart - entry.startTime);
          }
        }
      });

      try {
        observer.observe({ entryTypes: ['navigation', 'largest-contentful-paint', 'first-input'] });
      } catch (error) {
        console.warn('Performance observer setup failed:', error);
      }
    }
  }

  // Setup global error handling
  private setupErrorHandling(): void {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        'high',
        { type: 'unhandled_promise_rejection' }
      );
    });

    // Global errors
    window.addEventListener('error', (event) => {
      this.recordError(
        event.error || new Error(event.message),
        'high',
        {
          type: 'global_error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      );
    });
  }

  // Setup user interaction tracking
  private setupUserInteractionTracking(): void {
    // Track page views
    this.recordUserEvent('page_view', {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer
    });

    // Track clicks on important elements
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.matches('button, a, [role="button"]')) {
        this.recordUserEvent('click', {
          element: target.tagName.toLowerCase(),
          text: target.textContent?.slice(0, 50),
          className: target.className
        });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      this.recordUserEvent('form_submit', {
        formId: form.id,
        formClass: form.className,
        action: form.action
      });
    });
  }

  // Send data to analytics service
  private async sendToAnalytics(type: string, data: any): Promise<void> {
    try {
      // In a real implementation, you would send to your analytics service
      // For now, we'll just log to console in production
      if (this.isProduction) {
        console.log(`Analytics [${type}]:`, data);
      }
      
      // Example: Send to external service
      // await fetch('/api/analytics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ type, data })
      // });
    } catch (error) {
      console.warn('Failed to send analytics data:', error);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const monitor = ProductionMonitor.getInstance();

// Convenience functions
export const MonitoringUtils = {
  // Track user actions
  trackAction: (action: string, properties?: Record<string, any>) => {
    monitor.recordUserEvent(action, properties);
  },

  // Track errors with context
  trackError: (error: Error | string, context?: Record<string, any>) => {
    monitor.recordError(error, 'medium', context);
  },

  // Track performance metrics
  trackMetric: (name: string, value: number, tags?: Record<string, string>) => {
    monitor.recordMetric(name, value, tags);
  },

  // Time operations
  time: (label: string) => monitor.time(label),
  timeAsync: <T>(label: string, operation: () => Promise<T>) => 
    monitor.timeAsync(label, operation),

  // Monitor database operations
  monitorDb: <T>(operation: string, table: string, fn: () => Promise<T>) =>
    monitor.monitorDatabaseOperation(operation, table, fn),

  // Monitor API calls
  monitorApi: <T>(endpoint: string, method: string, fn: () => Promise<T>) =>
    monitor.monitorApiCall(endpoint, method, fn),

  // Get performance summary
  getPerformanceSummary: () => monitor.getPerformanceSummary()
};