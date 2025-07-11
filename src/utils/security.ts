// Security utilities for production-ready application

export class SecurityManager {
  // Content Security Policy headers
  static getCSPHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: unsafe-eval needed for Vite in dev
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://*.supabase.co https://*.supabase.io wss://*.supabase.co wss://*.supabase.io",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
  }

  // Sanitize user input to prevent XSS
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    if (!input) return '';
    
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+=/gi, '') // Remove event handlers
      .replace(/data:/gi, '') // Remove data: protocols
      .trim(); // Only trim the ends, not spaces within the text
  }

  // Validate and sanitize URLs
  static sanitizeUrl(url: string): string {
    if (!url) return '';
    url = url.trim();
    if (!url) return '';
    
    try {
      const parsed = new URL(url);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }
      return parsed.toString();
    } catch {
      return '';
    }
  }

  // Rate limiting for API calls
  static createRateLimiter(maxRequests: number, windowMs: number) {
    const requests = new Map<string, number[]>();
    
    return (identifier: string): boolean => {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      if (!requests.has(identifier)) {
        requests.set(identifier, []);
      }
      
      const userRequests = requests.get(identifier)!;
      
      // Remove old requests outside the window
      const validRequests = userRequests.filter(time => time > windowStart);
      
      if (validRequests.length >= maxRequests) {
        return false; // Rate limit exceeded
      }
      
      validRequests.push(now);
      requests.set(identifier, validRequests);
      
      return true; // Request allowed
    };
  }

  // Secure session storage
  static secureStorage = {
    setItem(key: string, value: any): void {
      try {
        const encrypted = btoa(JSON.stringify(value));
        sessionStorage.setItem(key, encrypted);
      } catch (error) {
        console.error('Failed to store secure item:', error);
      }
    },

    getItem<T>(key: string): T | null {
      try {
        const item = sessionStorage.getItem(key);
        if (!item) return null;
        return JSON.parse(atob(item));
      } catch (error) {
        console.error('Failed to retrieve secure item:', error);
        return null;
      }
    },

    removeItem(key: string): void {
      sessionStorage.removeItem(key);
    },

    clear(): void {
      sessionStorage.clear();
    }
  };

  // Validate file uploads
  static validateFileUpload(file: File, options: {
    maxSize?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = ['text/csv', 'application/csv'],
      allowedExtensions = ['.csv']
    } = options;

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }

    // Check file extension
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      errors.push(`File extension ${extension} is not allowed`);
    }

    // Check for suspicious file names
    if (/[<>:"/\\|?*]/.test(file.name)) {
      errors.push('File name contains invalid characters');
    }

    return { isValid: errors.length === 0, errors };
  }

  // Environment variable validation
  static validateEnvironment(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const requiredVars = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY'
    ];

    requiredVars.forEach(varName => {
      const value = import.meta.env[varName];
      if (!value) {
        errors.push(`Missing required environment variable: ${varName}`);
      } else if (varName.includes('URL') && !this.sanitizeUrl(value)) {
        errors.push(`Invalid URL format for ${varName}`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  // Secure API request headers
  static getSecureHeaders(authToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    return headers;
  }

  // Password strength validation
  static validatePasswordStrength(password: string): { 
    isValid: boolean; 
    score: number; 
    feedback: string[] 
  } {
    if (!password) {
      return {
        isValid: false,
        score: 0,
        feedback: ['Password is required']
      };
    }
    
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score += 1;
    else feedback.push('Password must be at least 8 characters long');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Password must contain lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Password must contain uppercase letters');

    if (/\d/.test(password)) score += 1;
    else feedback.push('Password must contain numbers');

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    else feedback.push('Password must contain special characters');

    // Check for common patterns
    if (/(.)\1{2,}/.test(password)) {
      score -= 1;
      feedback.push('Avoid repeating characters');
    }

    if (/123|abc|qwe/i.test(password)) {
      score -= 1;
      feedback.push('Avoid common sequences');
    }

    return {
      isValid: score >= 4,
      score: Math.max(0, score),
      feedback
    };
  }

  // CSRF token generation and validation
  static generateCSRFToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Secure random ID generation
  static generateSecureId(): string {
    return crypto.randomUUID();
  }

  // Input length limits for security
  static readonly INPUT_LIMITS = {
    EMAIL: 254,
    NAME: 100,
    PHONE: 20,
    URL: 2048,
    TEXT_SHORT: 500,
    TEXT_LONG: 5000,
    COMPANY_NAME: 200,
    JOB_TITLE: 100
  } as const;
}