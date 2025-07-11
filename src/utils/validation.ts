// Input validation utilities for security and data integrity

export const ValidationRules = {
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  phone: /^\+?[\d\s\-\(\)]{10,}$/,
  url: /^https?:\/\/.+/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class InputValidator {
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    
    if (!email || !email.trim()) {
      errors.push('Email is required');
    } else if (!ValidationRules.email.test(email)) {
      errors.push('Invalid email format');
    } else if (email.length > 254) {
      errors.push('Email is too long');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  static validatePhone(phone: string): ValidationResult {
    const errors: string[] = [];
    
    if (!phone || !phone.trim()) {
      errors.push('Phone number is required');
    } else {
      const cleanPhone = phone.replace(/\s/g, '');
      if (!ValidationRules.phone.test(cleanPhone)) {
        errors.push('Invalid phone number format');
      } else if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        errors.push('Phone number must be between 10-15 digits');
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }

  static validateUrl(url: string, required = false): ValidationResult {
    const errors: string[] = [];
    
    if (!url && required) {
      errors.push('URL is required');
    } else if (url && !ValidationRules.url.test(url)) {
      errors.push('Invalid URL format');
    } else if (url && url.length > 2048) {
      errors.push('URL is too long');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  static validateText(text: string, options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    fieldName?: string;
  } = {}): ValidationResult {
    const errors: string[] = [];
    const { required = false, minLength = 0, maxLength = 1000, fieldName = 'Field' } = options;
    
    if ((!text || !text.trim()) && required) {
      errors.push(`${fieldName} is required`);
    } else if (text) {
      if (text.length < minLength) {
        errors.push(`${fieldName} must be at least ${minLength} characters`);
      }
      if (text.length > maxLength) {
        errors.push(`${fieldName} must be no more than ${maxLength} characters`);
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }

  static validateUuid(uuid: string): ValidationResult {
    const errors: string[] = [];
    
    if (!uuid) {
      errors.push('ID is required');
    } else if (!ValidationRules.uuid.test(uuid)) {
      errors.push('Invalid ID format');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+=/gi, ''); // Remove event handlers
  }

  static validateCampaignData(data: {
    offer?: string;
    calendar_url?: string;
    goal?: string;
  }): ValidationResult {
    const errors: string[] = [];
    
    if (data.offer) {
      const offerValidation = this.validateText(data.offer, {
        required: true,
        minLength: 10,
        maxLength: 500,
        fieldName: 'Offer'
      });
      errors.push(...offerValidation.errors);
    }
    
    if (data.calendar_url) {
      const urlValidation = this.validateUrl(data.calendar_url);
      errors.push(...urlValidation.errors);
    }
    
    if (data.goal) {
      const goalValidation = this.validateText(data.goal, {
        maxLength: 1000,
        fieldName: 'Goal'
      });
      errors.push(...goalValidation.errors);
    }
    
    return { isValid: errors.length === 0, errors };
  }

  static validateLeadData(data: {
    name?: string;
    phone?: string;
    email?: string;
    company_name?: string;
    job_title?: string;
  }): ValidationResult {
    const errors: string[] = [];
    
    // At least one contact method required
    if (!data.name && !data.phone && !data.email) {
      errors.push('At least one of name, phone, or email is required');
    }
    
    if (data.name) {
      const nameValidation = this.validateText(data.name, {
        minLength: 2,
        maxLength: 100,
        fieldName: 'Name'
      });
      errors.push(...nameValidation.errors);
    }
    
    if (data.phone) {
      const phoneValidation = this.validatePhone(data.phone);
      errors.push(...phoneValidation.errors);
    }
    
    if (data.email) {
      const emailValidation = this.validateEmail(data.email);
      errors.push(...emailValidation.errors);
    }
    
    if (data.company_name) {
      const companyValidation = this.validateText(data.company_name, {
        maxLength: 200,
        fieldName: 'Company name'
      });
      errors.push(...companyValidation.errors);
    }
    
    if (data.job_title) {
      const titleValidation = this.validateText(data.job_title, {
        maxLength: 100,
        fieldName: 'Job title'
      });
      errors.push(...titleValidation.errors);
    }
    
    return { isValid: errors.length === 0, errors };
  }
}