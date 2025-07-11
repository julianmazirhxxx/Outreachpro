import React, { useState, useCallback } from 'react';
import { InputValidator, ValidationResult } from '../../utils/validation';
import { SecurityManager } from '../../utils/security';
import { useLoadingState } from '../../hooks/useLoadingState';
import { ErrorMessage } from '../common/ErrorMessage';

interface FormField {
  name: string;
  type: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'password';
  label: string;
  placeholder?: string;
  required?: boolean;
  validation?: (value: string) => ValidationResult;
  maxLength?: number;
  rows?: number;
}

interface SecureFormProps {
  fields: FormField[];
  onSubmit: (data: Record<string, string>) => Promise<void>;
  submitText?: string;
  className?: string;
  children?: React.ReactNode;
}

export function SecureForm({ 
  fields, 
  onSubmit, 
  submitText = 'Submit',
  className = '',
  children 
}: SecureFormProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { isLoading, error, executeAsync } = useLoadingState();

  const validateField = useCallback((field: FormField, value: string): string | null => {
    // Apply security sanitization
    const sanitizedValue = SecurityManager.sanitizeInput(value);
    
    // Apply custom validation if provided
    if (field.validation) {
      const result = field.validation(sanitizedValue);
      if (!result.isValid) {
        return result.errors[0];
      }
    }

    // Apply built-in validation based on type
    switch (field.type) {
      case 'email':
        const emailResult = InputValidator.validateEmail(sanitizedValue);
        if (!emailResult.isValid) return emailResult.errors[0];
        break;
      case 'tel':
        if (sanitizedValue) {
          const phoneResult = InputValidator.validatePhone(sanitizedValue);
          if (!phoneResult.isValid) return phoneResult.errors[0];
        }
        break;
      case 'url':
        if (sanitizedValue) {
          const urlResult = InputValidator.validateUrl(sanitizedValue, field.required);
          if (!urlResult.isValid) return urlResult.errors[0];
        }
        break;
      default:
        const textResult = InputValidator.validateText(sanitizedValue, {
          required: field.required,
          maxLength: field.maxLength || SecurityManager.INPUT_LIMITS.TEXT_SHORT,
          fieldName: field.label
        });
        if (!textResult.isValid) return textResult.errors[0];
    }

    return null;
  }, []);

  const handleInputChange = useCallback((fieldName: string, value: string) => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return;

    // Sanitize input
    const sanitizedValue = SecurityManager.sanitizeInput(value);
    
    // Update form data
    setFormData(prev => ({ ...prev, [fieldName]: sanitizedValue }));
    
    // Clear previous error
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: '' }));
    }
  }, [fields, errors]);

  const handleBlur = useCallback((fieldName: string) => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return;

    const value = formData[fieldName] || '';
    const error = validateField(field, value);
    
    if (error) {
      setErrors(prev => ({ ...prev, [fieldName]: error }));
    }
  }, [fields, formData, validateField]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    fields.forEach(field => {
      const value = formData[field.name] || '';
      const error = validateField(field, value);
      if (error) {
        newErrors[field.name] = error;
        hasErrors = true;
      }
    });

    setErrors(newErrors);

    if (hasErrors) {
      return;
    }

    // Submit form
    await executeAsync(
      () => onSubmit(formData),
      {
        errorMessage: 'Failed to submit form. Please try again.'
      }
    );
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name] || '';
    const fieldError = errors[field.name];
    const hasError = !!fieldError;

    const baseClasses = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
      hasError
        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
    }`;

    const commonProps = {
      id: field.name,
      name: field.name,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        handleInputChange(field.name, e.target.value),
      onBlur: () => handleBlur(field.name),
      placeholder: field.placeholder,
      required: field.required,
      maxLength: field.maxLength || SecurityManager.INPUT_LIMITS.TEXT_SHORT,
      className: baseClasses,
      'aria-invalid': hasError,
      'aria-describedby': hasError ? `${field.name}-error` : undefined
    };

    return (
      <div key={field.name} className="space-y-1">
        <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        {field.type === 'textarea' ? (
          <textarea
            {...commonProps}
            rows={field.rows || 3}
          />
        ) : (
          <input
            {...commonProps}
            type={field.type}
          />
        )}
        
        {fieldError && (
          <p id={`${field.name}-error`} className="text-sm text-red-600">
            {fieldError}
          </p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => {}}
        />
      )}
      
      {fields.map(renderField)}
      
      {children}
      
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Submitting...
            </div>
          ) : (
            submitText
          )}
        </button>
      </div>
    </form>
  );
}