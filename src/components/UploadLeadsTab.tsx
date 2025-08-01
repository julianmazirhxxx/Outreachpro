import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLoadingState } from '../hooks/useLoadingState';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import { supabase } from '../lib/supabase';
import Papa from 'papaparse';
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Users,
  Phone,
  Mail,
  MessageSquare,
  Search,
  Target,
  Crown,
  Zap,
  Settings,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface UploadLeadsTabProps {
  campaignId: string;
  setError: (error: string) => void;
}

interface ChannelConfig {
  id: string;
  name: string;
  channel_type: 'voice' | 'sms' | 'whatsapp' | 'email';
  provider: string;
  enabled: boolean;
  required_field: 'phone' | 'email';
}

interface UploadConfig {
  selectedChannels: string[];
  requirePhone: boolean;
  requireEmail: boolean;
  allowPartialData: boolean;
}

interface ValidationResult {
  validLeads: any[];
  invalidLeads: any[];
  errors: string[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    missingPhone: number;
    missingEmail: number;
    invalidPhone: number;
    invalidEmail: number;
  };
}

export function UploadLeadsTab({ campaignId, setError }: UploadLeadsTabProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isLoading, executeAsync } = useLoadingState();
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [availableChannels, setAvailableChannels] = useState<ChannelConfig[]>([]);
  const [uploadConfig, setUploadConfig] = useState<UploadConfig>({
    selectedChannels: [],
    requirePhone: false,
    requireEmail: false,
    allowPartialData: true
  });
  const [showChannelSelection, setShowChannelSelection] = useState(true);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    if (user) {
      fetchAvailableChannels();
    }
  }, [user]);

  const fetchAvailableChannels = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;

      const channelConfigs: ChannelConfig[] = (data || []).map(channel => ({
        id: channel.id,
        name: channel.name || `${channel.provider} ${channel.channel_type}`,
        channel_type: channel.channel_type,
        provider: channel.provider,
        enabled: false,
        required_field: channel.channel_type === 'email' ? 'email' : 'phone'
      }));

      setAvailableChannels(channelConfigs);
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  const handleChannelToggle = (channelId: string) => {
    const channel = availableChannels.find(c => c.id === channelId);
    if (!channel) return;

    setAvailableChannels(prev => 
      prev.map(c => 
        c.id === channelId ? { ...c, enabled: !c.enabled } : c
      )
    );

    // Update upload config based on selected channels
    const enabledChannels = availableChannels.map(c => 
      c.id === channelId ? { ...c, enabled: !c.enabled } : c
    ).filter(c => c.enabled);

    const requirePhone = enabledChannels.some(c => c.required_field === 'phone');
    const requireEmail = enabledChannels.some(c => c.required_field === 'email');

    setUploadConfig({
      selectedChannels: enabledChannels.map(c => c.id),
      requirePhone,
      requireEmail,
      allowPartialData: !requirePhone || !requireEmail // Allow partial if not both required
    });
  };

  const validateLeadsData = (leads: any[]): ValidationResult => {
    const validLeads: any[] = [];
    const invalidLeads: any[] = [];
    const errors: string[] = [];
    
    let missingPhone = 0;
    let missingEmail = 0;
    let invalidPhone = 0;
    let invalidEmail = 0;

    leads.forEach((lead, index) => {
      const leadErrors: string[] = [];
      let hasValidPhone = false;
      let hasValidEmail = false;

      // Validate phone if required
      if (uploadConfig.requirePhone) {
        if (!lead.phone || lead.phone.trim() === '' || lead.phone === 'EMPTY') {
          leadErrors.push('Missing phone number');
          missingPhone++;
        } else {
          const phoneValidation = InputValidator.validatePhone(lead.phone);
          if (!phoneValidation.isValid) {
            leadErrors.push('Invalid phone format');
            invalidPhone++;
          } else {
            hasValidPhone = true;
          }
        }
      } else if (lead.phone && lead.phone.trim() !== '' && lead.phone !== 'EMPTY') {
        // Phone not required but present - validate it
        const phoneValidation = InputValidator.validatePhone(lead.phone);
        if (phoneValidation.isValid) {
          hasValidPhone = true;
        } else {
          invalidPhone++;
        }
      }

      // Validate email if required
      if (uploadConfig.requireEmail) {
        if (!lead.email || lead.email.trim() === '' || lead.email === 'EMPTY') {
          leadErrors.push('Missing email address');
          missingEmail++;
        } else {
          const emailValidation = InputValidator.validateEmail(lead.email);
          if (!emailValidation.isValid) {
            leadErrors.push('Invalid email format');
            invalidEmail++;
          } else {
            hasValidEmail = true;
          }
        }
      } else if (lead.email && lead.email.trim() !== '' && lead.email !== 'EMPTY') {
        // Email not required but present - validate it
        const emailValidation = InputValidator.validateEmail(lead.email);
        if (emailValidation.isValid) {
          hasValidEmail = true;
        } else {
          invalidEmail++;
        }
      }

      // Check if lead meets minimum requirements
      const meetsRequirements = 
        (!uploadConfig.requirePhone || hasValidPhone) &&
        (!uploadConfig.requireEmail || hasValidEmail) &&
        (hasValidPhone || hasValidEmail); // At least one contact method

      if (meetsRequirements && leadErrors.length === 0) {
        validLeads.push({
          ...lead,
          row: index + 1
        });
      } else {
        invalidLeads.push({
          ...lead,
          row: index + 1,
          errors: leadErrors
        });
      }
    });

    return {
      validLeads,
      invalidLeads,
      errors,
      summary: {
        total: leads.length,
        valid: validLeads.length,
        invalid: invalidLeads.length,
        missingPhone,
        missingEmail,
        invalidPhone,
        invalidEmail
      }
    };
  };

  const handleFileUpload = async (uploadedFile: File) => {
    if (!uploadedFile) return;

    // Validate file
    const fileValidation = SecurityManager.validateFileUpload(uploadedFile, {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['text/csv', 'application/csv', 'text/plain'],
      allowedExtensions: ['.csv']
    });

    if (!fileValidation.isValid) {
      setError(fileValidation.errors[0]);
      return;
    }

    setFile(uploadedFile);
    setUploadResult(null);
    setValidationResult(null);

    try {
      Papa.parse(uploadedFile, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_'),
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(`CSV parsing error: ${results.errors[0].message}`);
            return;
          }

          const data = results.data as any[];
          if (data.length === 0) {
            setError('CSV file is empty or has no valid data rows');
            return;
          }

          setCsvData(data);
          setCsvHeaders(Object.keys(data[0] || {}));
          
          // Auto-map common columns
          const autoMapping: Record<string, string> = {};
          const headers = Object.keys(data[0] || {});
          
          headers.forEach(header => {
            const lowerHeader = header.toLowerCase();
            if (lowerHeader.includes('name') && !lowerHeader.includes('company')) {
              autoMapping.name = header;
            } else if (lowerHeader.includes('phone') || lowerHeader.includes('mobile') || lowerHeader.includes('cell')) {
              autoMapping.phone = header;
            } else if (lowerHeader.includes('email') || lowerHeader.includes('mail')) {
              autoMapping.email = header;
            } else if (lowerHeader.includes('company') || lowerHeader.includes('organization')) {
              autoMapping.company_name = header;
            } else if (lowerHeader.includes('title') || lowerHeader.includes('position') || lowerHeader.includes('job')) {
              autoMapping.job_title = header;
            }
          });
          
          setColumnMapping(autoMapping);
        },
        error: (error) => {
          setError(`Error processing CSV: ${error.message}`);
        }
      });
    } catch (error) {
      setError(`Error uploading CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleValidateAndPreview = () => {
    if (csvData.length === 0) {
      setError('No CSV data to validate');
      return;
    }

    // Map CSV data to lead objects
    const mappedLeads = csvData.map(row => {
      const lead: any = {
        campaign_id: campaignId,
        user_id: user?.id,
      };

      Object.entries(columnMapping).forEach(([field, csvColumn]) => {
        if (csvColumn && row[csvColumn] !== undefined) {
          lead[field] = SecurityManager.sanitizeInput(String(row[csvColumn] || ''));
        }
      });

      return lead;
    });

    // Validate leads based on selected channels
    const result = validateLeadsData(mappedLeads);
    setValidationResult(result);
  };

  const handleConfirmUpload = async () => {
    if (!validationResult || validationResult.validLeads.length === 0) {
      setError('No valid leads to upload');
      return;
    }

    await executeAsync(async () => {
      // Remove client-side properties before database insert
      const leadsToInsert = validationResult.validLeads.map(lead => {
        const { row, ...leadData } = lead;
        return leadData;
      });

      const { error } = await supabase
        .from('uploaded_leads')
        .insert(leadsToInsert);

      if (error) throw error;

      setUploadResult({
        success: true,
        message: `Successfully uploaded ${validationResult.validLeads.length} leads`,
        details: {
          uploaded: validationResult.validLeads.length,
          skipped: validationResult.invalidLeads.length
        }
      });

      // Reset form
      setFile(null);
      setCsvData([]);
      setCsvHeaders([]);
      setColumnMapping({});
      setValidationResult(null);
      setShowChannelSelection(true);
    }, {
      errorMessage: 'Failed to upload leads'
    });
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'voice':
        return Phone;
      case 'sms':
      case 'whatsapp':
        return MessageSquare;
      case 'email':
        return Mail;
      default:
        return MessageSquare;
    }
  };

  const getChannelColor = (type: string) => {
    switch (type) {
      case 'voice':
        return theme === 'gold' ? 'text-yellow-400' : 'text-blue-600';
      case 'sms':
        return theme === 'gold' ? 'text-yellow-400' : 'text-green-600';
      case 'whatsapp':
        return theme === 'gold' ? 'text-yellow-400' : 'text-emerald-600';
      case 'email':
        return theme === 'gold' ? 'text-yellow-400' : 'text-purple-600';
      default:
        return theme === 'gold' ? 'text-gray-400' : 'text-gray-600';
    }
  };

  const canProceedToUpload = uploadConfig.selectedChannels.length > 0;

  return (
    <div className="space-y-6">
      {/* Header with Upload Options */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className={`text-lg font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Add Leads to Campaign
          </h3>
          <p className={`text-sm ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Upload your own list or find new opportunities
          </p>
        </div>
        
        <div className="flex gap-3">
          <Link
            to="/targeting"
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              theme === 'gold'
                ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                : 'border-blue-300 text-blue-700 hover:bg-blue-50'
            }`}
          >
            <Search className="h-4 w-4 mr-2" />
            Find New Opportunities
          </Link>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`rounded-lg border p-4 ${
          uploadResult.success 
            ? theme === 'gold'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-green-50 border-green-200 text-green-800'
            : theme === 'gold'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {uploadResult.success ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{uploadResult.message}</p>
              {uploadResult.details && (
                <p className="text-xs mt-1">
                  {uploadResult.details.uploaded} uploaded, {uploadResult.details.skipped} skipped
                </p>
              )}
            </div>
            <button
              onClick={() => setUploadResult(null)}
              className="ml-auto text-current hover:opacity-70"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Channel Selection */}
      {showChannelSelection && (
        <div className={`p-6 rounded-lg border ${
          theme === 'gold'
            ? 'border-yellow-400/20 bg-black/20'
            : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center space-x-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              theme === 'gold' ? 'gold-gradient text-black' : 'bg-blue-100 text-blue-600'
            }`}>
              1
            </div>
            <h4 className={`text-md font-semibold ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Select Communication Channels
            </h4>
          </div>
          
          <p className={`text-sm mb-6 ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Choose which channels you'll use for this campaign. This determines what contact information is required.
          </p>

          {availableChannels.length === 0 ? (
            <div className={`text-center py-8 border-2 border-dashed rounded-lg ${
              theme === 'gold'
                ? 'border-yellow-400/30 text-gray-400'
                : 'border-gray-300 text-gray-500'
            }`}>
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className={`text-lg font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                No channels configured
              </h3>
              <p className="mb-4">You need to set up communication channels before uploading leads</p>
              <Link
                to="/settings"
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Settings className="h-4 w-4 mr-2" />
                Set Up Channels
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableChannels.map((channel) => {
                  const Icon = getChannelIcon(channel.channel_type);
                  return (
                    <div
                      key={channel.id}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        channel.enabled
                          ? theme === 'gold'
                            ? 'border-yellow-400 bg-yellow-400/10'
                            : 'border-blue-500 bg-blue-50'
                          : theme === 'gold'
                            ? 'border-gray-600 hover:border-gray-500'
                            : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleChannelToggle(channel.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Icon className={`h-5 w-5 ${getChannelColor(channel.channel_type)}`} />
                          <div>
                            <div className={`font-medium ${
                              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                            }`}>
                              {channel.name}
                            </div>
                            <div className={`text-xs ${
                              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                            }`}>
                              Requires: {channel.required_field}
                            </div>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          channel.enabled
                            ? theme === 'gold'
                              ? 'border-yellow-400 bg-yellow-400'
                              : 'border-blue-500 bg-blue-500'
                            : theme === 'gold'
                              ? 'border-gray-600'
                              : 'border-gray-300'
                        }`}>
                          {channel.enabled && (
                            <CheckCircle className={`h-3 w-3 ${
                              theme === 'gold' ? 'text-black' : 'text-white'
                            }`} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Requirements Summary */}
              {uploadConfig.selectedChannels.length > 0 && (
                <div className={`p-4 rounded-lg ${
                  theme === 'gold'
                    ? 'bg-yellow-400/10 border border-yellow-400/20'
                    : 'bg-blue-50 border border-blue-200'
                }`}>
                  <h5 className={`text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                  }`}>
                    Upload Requirements
                  </h5>
                  <div className={`text-sm space-y-1 ${
                    theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
                  }`}>
                    {uploadConfig.requirePhone && (
                      <p>• Phone numbers are required (for voice/SMS/WhatsApp channels)</p>
                    )}
                    {uploadConfig.requireEmail && (
                      <p>• Email addresses are required (for email channels)</p>
                    )}
                    {uploadConfig.allowPartialData && (
                      <p>• Leads with at least one valid contact method will be accepted</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setShowChannelSelection(false)}
                  disabled={!canProceedToUpload}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'gold-gradient text-black hover-gold'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Continue to Upload
                  <ArrowRight className="h-4 w-4 ml-2" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: File Upload (only show if channels selected) */}
      {!showChannelSelection && (
        <div className="space-y-6">
          {/* Back to Channel Selection */}
          <button
            onClick={() => setShowChannelSelection(true)}
            className={`text-sm ${
              theme === 'gold' ? 'text-yellow-400 hover:text-yellow-300' : 'text-blue-600 hover:text-blue-700'
            } transition-colors`}
          >
            ← Back to Channel Selection
          </button>

          {/* File Upload */}
          <div className={`p-6 rounded-lg border-2 border-dashed ${
            theme === 'gold'
              ? 'border-yellow-400/30 bg-yellow-400/5'
              : 'border-gray-300 bg-gray-50'
          }`}>
            <div className="text-center">
              <Upload className={`h-12 w-12 mx-auto mb-4 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
              }`} />
              <h3 className={`text-lg font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Upload Your Lead List
              </h3>
              <p className={`text-sm mb-4 ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Upload a CSV file with your leads. Based on your channel selection:
              </p>
              
              {/* Requirements Display */}
              <div className={`inline-flex items-center space-x-4 mb-6 px-4 py-2 rounded-lg ${
                theme === 'gold' ? 'bg-black/20' : 'bg-white'
              }`}>
                {uploadConfig.requirePhone && (
                  <div className="flex items-center text-sm">
                    <Phone className={`h-4 w-4 mr-1 ${
                      theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
                    }`} />
                    <span className={theme === 'gold' ? 'text-gray-300' : 'text-gray-700'}>
                      Phone Required
                    </span>
                  </div>
                )}
                {uploadConfig.requireEmail && (
                  <div className="flex items-center text-sm">
                    <Mail className={`h-4 w-4 mr-1 ${
                      theme === 'gold' ? 'text-yellow-400' : 'text-purple-600'
                    }`} />
                    <span className={theme === 'gold' ? 'text-gray-300' : 'text-gray-700'}>
                      Email Required
                    </span>
                  </div>
                )}
              </div>

              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) {
                    handleFileUpload(selectedFile);
                  }
                }}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className={`inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose CSV File
              </label>
              <p className={`text-xs mt-2 ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                Maximum file size: 10MB
              </p>
            </div>
          </div>

          {/* Column Mapping */}
          {csvHeaders.length > 0 && (
            <div className={`p-6 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-black/20'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <h4 className={`text-md font-semibold mb-4 ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Column Mapping
              </h4>
              <p className={`text-sm mb-4 ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Map your CSV columns to our database fields.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {[
                  { field: 'name', label: 'Name', required: false },
                  { field: 'phone', label: 'Phone Number', required: uploadConfig.requirePhone },
                  { field: 'email', label: 'Email Address', required: uploadConfig.requireEmail },
                  { field: 'company_name', label: 'Company Name', required: false },
                  { field: 'job_title', label: 'Job Title', required: false },
                ].map(({ field, label, required }) => (
                  <div key={field}>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {label} {required && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={columnMapping[field] || ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                    >
                      <option value="">Select CSV column...</option>
                      {csvHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleValidateAndPreview}
                  disabled={isLoading}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'gold-gradient text-black hover-gold'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  {isLoading ? (
                    <div className={`animate-spin rounded-full h-4 w-4 border-b-2 mr-2 ${
                      theme === 'gold' ? 'border-black' : 'border-white'
                    }`}></div>
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Validate & Preview
                </button>
              </div>
            </div>
          )}

          {/* Validation Results */}
          {validationResult && (
            <div className={`p-6 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-black/20'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <h4 className={`text-md font-semibold mb-4 ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Validation Results
              </h4>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className={`p-3 rounded-lg ${
                  theme === 'gold' ? 'bg-green-500/20' : 'bg-green-100'
                }`}>
                  <div className={`text-lg font-bold ${
                    theme === 'gold' ? 'text-green-400' : 'text-green-600'
                  }`}>
                    {validationResult.summary.valid}
                  </div>
                  <div className={`text-xs ${
                    theme === 'gold' ? 'text-green-300' : 'text-green-700'
                  }`}>
                    Valid Leads
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${
                  theme === 'gold' ? 'bg-red-500/20' : 'bg-red-100'
                }`}>
                  <div className={`text-lg font-bold ${
                    theme === 'gold' ? 'text-red-400' : 'text-red-600'
                  }`}>
                    {validationResult.summary.invalid}
                  </div>
                  <div className={`text-xs ${
                    theme === 'gold' ? 'text-red-300' : 'text-red-700'
                  }`}>
                    Invalid Leads
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${
                  theme === 'gold' ? 'bg-yellow-500/20' : 'bg-yellow-100'
                }`}>
                  <div className={`text-lg font-bold ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-yellow-600'
                  }`}>
                    {validationResult.summary.missingPhone}
                  </div>
                  <div className={`text-xs ${
                    theme === 'gold' ? 'text-yellow-300' : 'text-yellow-700'
                  }`}>
                    Missing Phone
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${
                  theme === 'gold' ? 'bg-purple-500/20' : 'bg-purple-100'
                }`}>
                  <div className={`text-lg font-bold ${
                    theme === 'gold' ? 'text-purple-400' : 'text-purple-600'
                  }`}>
                    {validationResult.summary.missingEmail}
                  </div>
                  <div className={`text-xs ${
                    theme === 'gold' ? 'text-purple-300' : 'text-purple-700'
                  }`}>
                    Missing Email
                  </div>
                </div>
              </div>

              {/* Invalid Leads Preview */}
              {validationResult.invalidLeads.length > 0 && (
                <div className={`mb-6 p-4 rounded-lg ${
                  theme === 'gold'
                    ? 'bg-red-500/10 border border-red-500/20'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <h5 className={`text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-red-400' : 'text-red-700'
                  }`}>
                    Sample Invalid Leads (First 5)
                  </h5>
                  <div className="space-y-2">
                    {validationResult.invalidLeads.slice(0, 5).map((lead, index) => (
                      <div key={index} className={`text-xs p-2 rounded ${
                        theme === 'gold' ? 'bg-black/20' : 'bg-white'
                      }`}>
                        <div className={`font-medium ${
                          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                        }`}>
                          Row {lead.row}: {lead.name || 'No name'}
                        </div>
                        <div className={`${
                          theme === 'gold' ? 'text-red-300' : 'text-red-600'
                        }`}>
                          Issues: {lead.errors.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between">
                <button
                  onClick={() => {
                    setValidationResult(null);
                    setCsvData([]);
                    setCsvHeaders([]);
                    setFile(null);
                  }}
                  className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                      : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  Start Over
                </button>

                <button
                  onClick={handleConfirmUpload}
                  disabled={isLoading || validationResult.validLeads.length === 0}
                  className={`inline-flex items-center px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'gold-gradient text-black hover-gold'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLoading ? (
                    <div className={`animate-spin rounded-full h-4 w-4 border-b-2 mr-2 ${
                      theme === 'gold' ? 'border-black' : 'border-white'
                    }`}></div>
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload {validationResult.validLeads.length} Valid Leads
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}