import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  User, 
  Mail, 
  Phone, 
  Building, 
  Briefcase,
  Tag,
  Crown,
  Zap,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface LeadEditModalProps {
  lead: any;
  listId: string;
  onClose: () => void;
  onSave: () => void;
}

interface CustomField {
  key: string;
  value: string;
}

export function LeadEditModal({ lead, listId, onClose, onSave }: LeadEditModalProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    job_title: '',
    source_url: '',
    source_platform: ''
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        company_name: lead.company_name || '',
        job_title: lead.job_title || '',
        source_url: lead.source_url || '',
        source_platform: lead.source_platform || ''
      });

      // Parse custom fields
      const customFieldsData = lead.custom_fields || {};
      const fields = Object.entries(customFieldsData).map(([key, value]) => ({
        key,
        value: String(value)
      }));
      setCustomFields(fields);
    }
  }, [lead]);

  const addCustomField = () => {
    setCustomFields([...customFields, { key: '', value: '' }]);
  };

  const updateCustomField = (index: number, field: 'key' | 'value', value: string) => {
    const newFields = [...customFields];
    newFields[index][field] = value;
    setCustomFields(newFields);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Clear any previous results
    setResult(null);

    setSaving(true);

    try {
      // Validate required fields
      if (!formData.name.trim()) {
        throw new Error('Name is required');
      }

      // Validate email if provided (only if not empty)
      if (formData.email && formData.email.trim() !== '') {
        const emailValidation = InputValidator.validateEmail(formData.email.trim());
        if (!emailValidation.isValid) {
          throw new Error(emailValidation.errors[0]);
        }
      }

      // Validate phone if provided (only if not empty)
      if (formData.phone && formData.phone.trim() !== '') {
        const phoneValidation = InputValidator.validatePhone(formData.phone.trim());
        if (!phoneValidation.isValid) {
          throw new Error(phoneValidation.errors[0]);
        }
      }

      // Sanitize form data
      const sanitizedData = {
        name: SecurityManager.sanitizeInput(formData.name),
        email: formData.email && formData.email.trim() !== '' ? SecurityManager.sanitizeInput(formData.email) : null,
        phone: formData.phone && formData.phone.trim() !== '' ? SecurityManager.sanitizeInput(formData.phone) : null,
        company_name: formData.company_name && formData.company_name.trim() !== '' ? SecurityManager.sanitizeInput(formData.company_name) : null,
        job_title: formData.job_title && formData.job_title.trim() !== '' ? SecurityManager.sanitizeInput(formData.job_title) : null,
        source_url: formData.source_url && formData.source_url.trim() !== '' ? SecurityManager.sanitizeUrl(formData.source_url) : null,
        source_platform: formData.source_platform && formData.source_platform.trim() !== '' ? SecurityManager.sanitizeInput(formData.source_platform) : null,
      };

      // Process custom fields
      const customFieldsObject: Record<string, string> = {};
      customFields.forEach(field => {
        if (field.key && field.key.trim() !== '' && field.value && field.value.trim() !== '') {
          const sanitizedKey = SecurityManager.sanitizeInput(field.key);
          const sanitizedValue = SecurityManager.sanitizeInput(field.value);
          if (sanitizedKey && sanitizedValue) {
            customFieldsObject[sanitizedKey] = sanitizedValue;
          }
        }
      });

      const updateData = {
        ...sanitizedData,
        custom_fields: customFieldsObject,
        updated_at: new Date().toISOString()
      };

      // Remove any null or undefined values to avoid database issues
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === null || updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      const { error } = await supabase
        .from('list_leads')
        .update(updateData)
        .eq('id', lead.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setResult({ success: true, message: 'Lead updated successfully!' });
      
      // Close modal after successful save
      setTimeout(() => {
        onSave();
        onClose();
      }, 1000);

    } catch (error) {
      console.error('Error updating lead:', error);
      setResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to update lead. Please try again.' 
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${
      theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
    }`}>
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className={`w-full max-w-2xl rounded-xl shadow-2xl ${
          theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
        }`}>
          {/* Header */}
          <div className={`p-6 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
                }`}>
                  <User className={`h-6 w-6 ${
                    theme === 'gold' ? 'text-black' : 'text-blue-600'
                  }`} />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Edit Lead Information
                  </h2>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Update lead details and add custom fields
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 hover:bg-gray-800'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-6 max-h-[80vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className={`text-lg font-semibold ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                      }`} />
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          theme === 'gold'
                            ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                            : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                        }`}
                        placeholder="John Doe"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                      }`} />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          theme === 'gold'
                            ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                            : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                        }`}
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                      }`} />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          theme === 'gold'
                            ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                            : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                        }`}
                        placeholder="+1234567890"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Company Name
                    </label>
                    <div className="relative">
                      <Building className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                      }`} />
                      <input
                        type="text"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          theme === 'gold'
                            ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                            : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                        }`}
                        placeholder="Acme Corp"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Job Title
                    </label>
                    <div className="relative">
                      <Briefcase className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                      }`} />
                      <input
                        type="text"
                        value={formData.job_title}
                        onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          theme === 'gold'
                            ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                            : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                        }`}
                        placeholder="Marketing Director"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Source Platform
                    </label>
                    <select
                      value={formData.source_platform}
                      onChange={(e) => setFormData({ ...formData, source_platform: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                    >
                      <option value="">Select source...</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="facebook">Facebook</option>
                      <option value="twitter">Twitter</option>
                      <option value="instagram">Instagram</option>
                      <option value="website">Website</option>
                      <option value="referral">Referral</option>
                      <option value="cold_email">Cold Email</option>
                      <option value="manual">Manual Entry</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Source URL
                  </label>
                  <input
                    type="url"
                    value={formData.source_url}
                    onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="https://linkedin.com/in/johndoe"
                  />
                  <p className={`text-xs mt-1 ${
                    theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    URL where this lead was found (LinkedIn profile, company website, etc.)
                  </p>
                </div>
              </div>

              {/* Custom Fields */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Custom Fields
                  </h3>
                  <button
                    type="button"
                    onClick={addCustomField}
                    className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Field
                  </button>
                </div>

                {customFields.length === 0 ? (
                  <div className={`text-center py-8 border-2 border-dashed rounded-lg ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 text-gray-400'
                      : 'border-gray-300 text-gray-500'
                  }`}>
                    <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No custom fields yet</p>
                    <p className="text-xs mt-1">Add custom fields to store additional lead information</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customFields.map((field, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${
                        theme === 'gold'
                          ? 'border-yellow-400/20 bg-black/10'
                          : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="flex items-center space-x-3">
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              value={field.key}
                              onChange={(e) => updateCustomField(index, 'key', e.target.value.trim())}
                              className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                theme === 'gold'
                                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                              }`}
                              placeholder="Field name"
                            />
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                              className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                theme === 'gold'
                                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                              }`}
                              placeholder="Field value"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCustomField(index)}
                            className={`p-2 rounded-lg transition-colors ${
                              theme === 'gold'
                                ? 'text-red-400 hover:bg-red-400/10'
                                : 'text-red-600 hover:bg-red-50'
                            }`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Result Message */}
              {result && (
                <div className={`rounded-lg border p-4 ${
                  result.success 
                    ? theme === 'gold'
                      ? 'bg-green-500/10 border-green-500/30 text-green-400'
                      : 'bg-green-50 border-green-200 text-green-800'
                    : theme === 'gold'
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <AlertCircle className="h-5 w-5" />
                      )}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">{result.message}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                      : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                  } disabled:opacity-50`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'gold-gradient text-black hover-gold'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  {saving ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Saving...
                    </div>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}