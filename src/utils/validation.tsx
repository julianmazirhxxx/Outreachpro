export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class InputValidator {
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    
    if (!email || email.trim() === '') {
      errors.push('Email is required');
      return { isValid: false, errors };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Please enter a valid email address');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  static validatePhone(phone: string): ValidationResult {
    const errors: string[] = [];
    
    if (!phone || phone.trim() === '') {
      errors.push('Phone number is required');
      return { isValid: false, errors };
    }
    
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone)) {
      errors.push('Please enter a valid phone number');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  static validateUrl(url: string, required: boolean = false): ValidationResult {
    const errors: string[] = [];
    
    if (!url || url.trim() === '') {
      if (required) {
        errors.push('URL is required');
      }
      return { isValid: !required, errors };
    }
    
    try {
      new URL(url);
    } catch {
      errors.push('Please enter a valid URL');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  static validateText(text: string, options: { required?: boolean; maxLength?: number; fieldName?: string } = {}): ValidationResult {
    const errors: string[] = [];
    const { required = false, maxLength = 255, fieldName = 'Field' } = options;
    
    if (!text || text.trim() === '') {
      if (required) {
        errors.push(`${fieldName} is required`);
      }
      return { isValid: !required, errors };
    }
    
    if (text.length > maxLength) {
      errors.push(`${fieldName} must be less than ${maxLength} characters`);
    }
    
    return { isValid: errors.length === 0, errors };
  }

  static validateCampaignData(data: { offer: string; calendar_url: string; goal: string }): ValidationResult {
    const errors: string[] = [];
    
    const offerValidation = this.validateText(data.offer, { required: true, fieldName: 'Offer' });
    if (!offerValidation.isValid) {
      errors.push(...offerValidation.errors);
    }
    
    const urlValidation = this.validateUrl(data.calendar_url, true);
    if (!urlValidation.isValid) {
      errors.push(...urlValidation.errors);
    }
    
    return { isValid: errors.length === 0, errors };
  }
}