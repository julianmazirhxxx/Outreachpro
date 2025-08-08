import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import Papa from 'papaparse';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Users,
  Phone,
  Mail,
  Building,
  Briefcase,
  Target,
  ArrowRight,
  X
} from 'lucide-react';

interface UploadLeadsTabProps {
  campaignId: string;
  setError: (error: string) => void;
}

interface LeadData {
  name?: string;
  phone?: string;
  email?: string;
  company_name?: string;
  job_title?: string;
}

interface ColumnMapping {
  [key: string]: string;
}

export function UploadLeadsTab({ campaignId, setError }: UploadLeadsTabProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [processedLeads, setProcessedLeads] = useState<LeadData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [campaignChannels, setCampaignChannels] = useState<string[]>([]);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch campaign channels to determine requirements
  React.useEffect(() => {
    if (campaignId) {
      fetchCampaignChannels();
    }
  }, [campaignId]);

  const fetchCampaignChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('campaign_sequences')
        .select('type')
        .eq('campaign_id', campaignId);

      if (error) throw error;
      
      const channels = data?.map(seq => seq.type) || [];
      setCampaignChannels(channels);
    } catch (error) {
      console.error('Error fetching campaign channels:', error);
      // Default to requiring both if we can't determine
      setCampaignChannels(['email', 'call']);
    }
  };

  const getRequiredFields = () => {
    // Check what channels this campaign uses
    const hasEmail = campaignChannels.includes('email');
    const hasVoice = campaignChannels.includes('call') || campaignChannels.includes('voice');
    const hasSMS = campaignChannels.includes('sms');
    const hasWhatsApp = campaignChannels.includes('whatsapp');
    
    const requirements = {
      name: true, // Always required
      email: hasEmail,
      phone: hasVoice || hasSMS || hasWhatsApp, // Phone required for voice, SMS, WhatsApp
      company_name: false,
      job_title: false
    };
    
    return requirements;
  };

  const handleFileUpload = useCallback((file: File) => {
    if (!file) return;

    // Basic file validation
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setCsvFile(file);
    
    // Parse CSV
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('CSV parsing error: ' + results.errors[0].message);
          return;
        }

        setCsvData(results.data);
        setCsvHeaders(results.meta.fields || []);
        
        // Auto-detect column mappings
        const autoMapping: ColumnMapping = {};
        const headers = results.meta.fields || [];
        
        headers.forEach(header => {
          const lowerHeader = header.toLowerCase().trim();
          if (lowerHeader.includes('name') || lowerHeader.includes('first') || lowerHeader.includes('full')) {
            autoMapping[header] = 'name';
          } else if (lowerHeader.includes('phone') || lowerHeader.includes('mobile') || lowerHeader.includes('cell')) {
            autoMapping[header] = 'phone';
          } else if (lowerHeader.includes('email') || lowerHeader.includes('mail')) {
            autoMapping[header] = 'email';
          } else if (lowerHeader.includes('company') || lowerHeader.includes('organization')) {
            autoMapping[header] = 'company_name';
          } else if (lowerHeader.includes('title') || lowerHeader.includes('position') || lowerHeader.includes('job')) {
            autoMapping[header] = 'job_title';
          }
        });
        
        setColumnMapping(autoMapping);
        setCurrentStep('map');
      },
      error: (error) => {
        setError('Failed to parse CSV: ' + error.message);
      }
    });
  }, [setError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const processLeads = () => {
    const leads: LeadData[] = [];
    const requirements = getRequiredFields();
    
    csvData.forEach((row) => {
      const lead: LeadData = {};
      
      // Map columns to lead fields
      Object.entries(columnMapping).forEach(([csvColumn, dbField]) => {
        if (dbField && row[csvColumn] !== undefined && row[csvColumn] !== null) {
          const value = String(row[csvColumn]).trim();
          if (value !== '' && value !== 'EMPTY' && value !== 'NULL') {
            lead[dbField as keyof LeadData] = value;
          }
        }
      });

      // Validate based on campaign requirements
      let isValid = true;
      
      // Always require name
      if (!lead.name || lead.name.trim() === '') {
        isValid = false;
      }
      
      // Check email requirement
      if (requirements.email && (!lead.email || lead.email.trim() === '')) {
        isValid = false;
      }
      
      // Check phone requirement
      if (requirements.phone && (!lead.phone || lead.phone.trim() === '')) {
        isValid = false;
      }
      
      if (isValid) {
        leads.push(lead);
      }
    });

    setProcessedLeads(leads);
    setCurrentStep('preview');
  };

  const uploadLeads = async () => {
    if (!user || processedLeads.length === 0) {
      setError('No valid leads to upload');
      return;
    }

    const requirements = getRequiredFields();
    setUploading(true);
    setUploadResult(null);
    setError('');

    try {
      // Add campaign_id, user_id, and ensure required fields to each lead
      const leadsToUpload = processedLeads.map(lead => ({
        ...lead,
        // Ensure required fields have values or defaults
        phone: requirements.phone ? (lead.phone || null) : null,
        email: requirements.email ? (lead.email || null) : null,
        campaign_id: campaignId,
        user_id: user.id,
        status: 'pending'
      }));

      const { error } = await supabase
        .from('uploaded_leads')
        .insert(leadsToUpload);

      if (error) {
        throw error;
      }

      setUploadResult({
        success: true,
        message: `Successfully uploaded ${leadsToUpload.length} leads!`
      });

      // Reset form after successful upload
      setTimeout(() => {
        resetUpload();
      }, 3000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to upload leads'
      });
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setCsvFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setProcessedLeads([]);
    setCurrentStep('upload');
    setUploadResult(null);
    setError('');
  };

  const updateColumnMapping = (csvColumn: string, dbField: string) => {
    const newMapping = { ...columnMapping };
    
    // Remove any existing mapping for this database field
    Object.keys(newMapping).forEach(key => {
      if (newMapping[key] === dbField) {
        delete newMapping[key];
      }
    });
    
    // Add new mapping if dbField is not empty
    if (dbField) {
      newMapping[csvColumn] = dbField;
    } else {
      delete newMapping[csvColumn];
    }
    
    setColumnMapping(newMapping);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Upload Leads
          </h3>
          <p className="text-sm text-gray-600">
            Upload CSV file with your leads data
          </p>
        </div>
        {currentStep !== 'upload' && (
          <button
            onClick={resetUpload}
            className="inline-flex items-center px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4 mr-1" />
            Start Over
          </button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="flex items-center space-x-4">
        {[
          { key: 'upload', label: 'Upload File', icon: Upload },
          { key: 'map', label: 'Map Columns', icon: Target },
          { key: 'preview', label: 'Preview & Upload', icon: CheckCircle }
        ].map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.key;
          const isCompleted = ['upload', 'map', 'preview'].indexOf(currentStep) > index;
          
          return (
            <React.Fragment key={step.key}>
              <div className={`flex items-center space-x-2 ${
                isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isActive ? 'bg-blue-100 text-blue-600' :
                  isCompleted ? 'bg-green-100 text-green-600' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {isCompleted ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className="text-sm font-medium">{step.label}</span>
              </div>
              {index < 2 && (
                <ArrowRight className="h-4 w-4 text-gray-300" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1: File Upload */}
      {currentStep === 'upload' && (
        <div className="space-y-6">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-blue-600" />
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              Upload CSV File
            </h3>
            <p className="text-sm mb-4 text-gray-600">
              Drag and drop your CSV file here, or click to browse
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition-colors"
            >
              <FileText className="h-4 w-4 mr-2" />
              Choose File
            </label>
          </div>

          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <h4 className="text-sm font-medium mb-2 text-blue-700">
              📋 CSV Requirements
            </h4>
            <div className="text-sm space-y-2 text-blue-600">
              <div>
                <strong>Required Fields:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• <strong>Name</strong> - for personalization</li>
                  <li>• <strong>Phone</strong> - required</li>
                </ul>
              </div>
              <div>
                <strong>Optional Fields:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• Email addresses - for email campaigns</li>
                  <li>• Company names - for better targeting</li>
                  <li>• Job titles - for personalized messaging</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {currentStep === 'map' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              Map Your CSV Columns
            </h3>
            <p className="text-sm text-gray-600">
              Match your CSV columns to the lead fields. {getRequiredFieldsText()}. Found {csvHeaders.length} columns in your CSV.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {getFieldConfigs().map((fieldConfig) => {
              const Icon = fieldConfig.icon;
              const mappedColumn = Object.keys(columnMapping).find(
                key => columnMapping[key] === fieldConfig.field
              );
              
              return (
                <div
                  key={fieldConfig.field}
                  className="p-4 rounded-lg border border-gray-200 bg-gray-50"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <Icon className={`h-5 w-5 ${
                      fieldConfig.required ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <div>
                      <div className="font-medium text-gray-900">
                        {fieldConfig.label}
                        {fieldConfig.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </div>
                      <div className={`text-xs ${
                        fieldConfig.required ? 'text-blue-600' : 'text-gray-500'
                      }`}>
                        {fieldConfig.required ? 'Required' : 'Optional'}
                      </div>
                    </div>
                  </div>
                  
                  <select
                    value={mappedColumn || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        updateColumnMapping(e.target.value, fieldConfig.field);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  >
                    <option value="">Select CSV column...</option>
                    {csvHeaders.map(header => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                  
                  {/* Sample data preview */}
                  {mappedColumn && csvData.length > 0 && (
                    <div className="mt-2 p-2 rounded bg-white text-xs">
                      <div className="font-medium mb-1 text-gray-700">
                        Sample data:
                      </div>
                      <div className="text-gray-600">
                        {csvData.slice(0, 3).map((row, i) => (
                          <div key={i}>"{row[mappedColumn] || 'empty'}"</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep('upload')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                  : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Back to Upload
            </button>
            <button
              onClick={processLeads}
              disabled={!isValidMapping()}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Process Leads
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Upload */}
      {currentStep === 'preview' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              Review & Upload
            </h3>
            <p className="text-sm text-gray-600">
              Review your processed leads before uploading to the database
            </p>
          </div>

          {/* Upload Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-gray-200 bg-white">
              <div className="text-2xl font-bold text-blue-600">
                {csvData.length}
              </div>
              <div className="text-sm text-gray-600">
                Total Rows
              </div>
            </div>

            <div className="p-4 rounded-lg border border-gray-200 bg-white">
              <div className="text-2xl font-bold text-green-600">
                {processedLeads.length}
              </div>
              <div className="text-sm text-gray-600">
                Valid Leads
              </div>
            </div>

            <div className="p-4 rounded-lg border border-gray-200 bg-white">
              <div className="text-2xl font-bold text-blue-600">
                {csvData.length > 0 ? Math.round((processedLeads.length / csvData.length) * 100) : 0}%
              </div>
              <div className="text-sm text-gray-600">
                Success Rate
              </div>
            </div>
          </div>

          {/* Sample Leads Preview */}
          <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
            <h4 className="text-sm font-medium mb-3 text-gray-700">
              Sample Leads (First 5)
            </h4>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                      Name
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                      Email
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                      Phone
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                      Company
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {processedLeads.slice(0, 5).map((lead, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-sm text-gray-700">
                        {lead.name || 'No name'}
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-700">
                        {lead.email || 'No email'}
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-700">
                        {lead.phone || 'No phone'}
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-700">
                        {lead.company_name || 'No company'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className={`rounded-lg border p-4 ${
              uploadResult.success 
                ? 'bg-green-50 border-green-200 text-green-800'
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
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep('map')}
              className="px-4 py-2 text-sm rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              Back to Mapping
            </button>
            <button
              onClick={uploadLeads}
              disabled={uploading || processedLeads.length === 0}
              className="px-6 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </div>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {processedLeads.length} Leads
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Helper functions
  function getFieldConfigs() {
    const requirements = getRequiredFields();
    
    return [
      { field: 'name', label: 'Full Name', icon: Users, required: requirements.name },
      { field: 'email', label: 'Email Address', icon: Mail, required: requirements.email },
      { field: 'phone', label: 'Phone Number', icon: Phone, required: requirements.phone },
      { field: 'company_name', label: 'Company Name', icon: Building, required: false },
      { field: 'job_title', label: 'Job Title', icon: Briefcase, required: false }
    ];
  }

  function getRequiredFieldsText() {
    const requirements = getRequiredFields();
    const required = [];
    
    if (requirements.name) required.push('Name');
    if (requirements.email) required.push('Email');
    if (requirements.phone) required.push('Phone');
    
    return `Required fields: ${required.join(', ')}`;
  }

  function isValidMapping() {
    const requirements = getRequiredFields();
    
    // Always need name
    const nameColumn = Object.keys(columnMapping).find(key => columnMapping[key] === 'name');
    if (!nameColumn) return false;
    
    // Check email requirement
    if (requirements.email) {
      const emailColumn = Object.keys(columnMapping).find(key => columnMapping[key] === 'email');
      if (!emailColumn) return false;
    }
    
    // Check phone requirement
    if (requirements.phone) {
      const phoneColumn = Object.keys(columnMapping).find(key => columnMapping[key] === 'phone');
      if (!phoneColumn) return false;
    }
    
    return true;
  }
}