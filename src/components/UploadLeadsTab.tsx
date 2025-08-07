import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import Papa from 'papaparse';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Download,
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
  [key: string]: string; // CSV column -> database field
}

interface UploadStats {
  totalRows: number;
  validLeads: number;
  duplicates: number;
  errors: number;
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
  const [uploadStats, setUploadStats] = useState<UploadStats>({
    totalRows: 0,
    validLeads: 0,
    duplicates: 0,
    errors: 0
  });
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleFileUpload = useCallback((file: File) => {
    if (!file) return;

    // Validate file
    const validation = SecurityManager.validateFileUpload(file, {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['text/csv', 'application/csv', 'text/plain'],
      allowedExtensions: ['.csv']
    });

    if (!validation.isValid) {
      setError(validation.errors[0]);
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
          const lowerHeader = header.toLowerCase();
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
    const errors: string[] = [];
    
    csvData.forEach((row, index) => {
      const lead: LeadData = {};
      
      // Map columns to lead fields
      Object.entries(columnMapping).forEach(([csvColumn, dbField]) => {
        if (dbField && row[csvColumn]) {
          lead[dbField as keyof LeadData] = SecurityManager.sanitizeInput(row[csvColumn]);
        }
      });

      // Validate lead
      const validation = InputValidator.validateLeadData(lead);
      if (validation.isValid) {
        leads.push(lead);
      } else {
        errors.push(`Row ${index + 1}: ${validation.errors.join(', ')}`);
      }
    });

    setProcessedLeads(leads);
    setUploadStats({
      totalRows: csvData.length,
      validLeads: leads.length,
      duplicates: 0, // Will be calculated during actual upload
      errors: errors.length
    });
    
    setCurrentStep('preview');
  };

  const uploadLeads = async () => {
    if (!user || processedLeads.length === 0) return;

    setUploading(true);
    setUploadResult(null);

    try {
      // Add campaign_id and user_id to each lead
      const leadsToUpload = processedLeads.map(lead => ({
        ...lead,
        campaign_id: campaignId,
        user_id: user.id,
        status: 'pending'
      }));

      // Upload in batches of 100
      const batchSize = 100;
      let totalUploaded = 0;
      
      for (let i = 0; i < leadsToUpload.length; i += batchSize) {
        const batch = leadsToUpload.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from('uploaded_leads')
          .insert(batch)
          .select();

        if (error) {
          throw error;
        }

        totalUploaded += data?.length || 0;
      }

      setUploadResult({
        success: true,
        message: `Successfully uploaded ${totalUploaded} leads to your campaign!`
      });

      // Reset form after successful upload
      setTimeout(() => {
        setCsvFile(null);
        setCsvData([]);
        setCsvHeaders([]);
        setColumnMapping({});
        setProcessedLeads([]);
        setCurrentStep('upload');
        setUploadResult(null);
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
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Upload Leads
          </h3>
          <p className={`text-sm ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Upload CSV file with your leads data
          </p>
        </div>
        {currentStep !== 'upload' && (
          <button
            onClick={resetUpload}
            className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
              theme === 'gold'
                ? 'text-gray-400 hover:bg-gray-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
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
                isActive
                  ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                  : isCompleted
                    ? theme === 'gold' ? 'text-green-400' : 'text-green-600'
                    : theme === 'gold' ? 'text-gray-500' : 'text-gray-400'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isActive
                    ? theme === 'gold' ? 'gold-gradient text-black' : 'bg-blue-100 text-blue-600'
                    : isCompleted
                      ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
                      : theme === 'gold' ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-500'
                }`}>
                  {isCompleted ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className="text-sm font-medium">{step.label}</span>
              </div>
              {index < 2 && (
                <ArrowRight className={`h-4 w-4 ${
                  theme === 'gold' ? 'text-gray-600' : 'text-gray-300'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1: File Upload */}
      {currentStep === 'upload' && (
        <div className="space-y-6">
          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              theme === 'gold'
                ? 'border-yellow-400/30 bg-yellow-400/5 hover:bg-yellow-400/10'
                : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <Upload className={`h-12 w-12 mx-auto mb-4 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`} />
            <h3 className={`text-lg font-semibold mb-2 ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Upload CSV File
            </h3>
            <p className={`text-sm mb-4 ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
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
              className={`inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <FileText className="h-4 w-4 mr-2" />
              Choose File
            </label>
          </div>

          {/* CSV Format Requirements */}
          <div className={`p-4 rounded-lg ${
            theme === 'gold'
              ? 'bg-blue-500/10 border border-blue-500/20'
              : 'bg-blue-50 border border-blue-200'
          }`}>
            <h4 className={`text-sm font-medium mb-2 ${
              theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
            }`}>
              📋 CSV Format Requirements
            </h4>
            <ul className={`text-sm space-y-1 ${
              theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
            }`}>
              <li>• Include headers in the first row</li>
              <li>• At least one contact method required (phone or email)</li>
              <li>• Phone numbers should include country code (e.g., +1234567890)</li>
              <li>• Email addresses must be valid format</li>
              <li>• Maximum file size: 10MB</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {currentStep === 'map' && (
        <div className="space-y-6">
          <div>
            <h3 className={`text-lg font-semibold mb-2 ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Map Your CSV Columns
            </h3>
            <p className={`text-sm ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Match your CSV columns to the correct lead fields
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { field: 'name', label: 'Full Name', icon: Users, required: false },
              { field: 'phone', label: 'Phone Number', icon: Phone, required: true },
              { field: 'email', label: 'Email Address', icon: Mail, required: false },
              { field: 'company_name', label: 'Company Name', icon: Building, required: false },
              { field: 'job_title', label: 'Job Title', icon: Briefcase, required: false }
            ].map((fieldConfig) => {
              const Icon = fieldConfig.icon;
              const mappedColumn = Object.keys(columnMapping).find(
                key => columnMapping[key] === fieldConfig.field
              );
              
              return (
                <div
                  key={fieldConfig.field}
                  className={`p-4 rounded-lg border ${
                    theme === 'gold'
                      ? 'border-yellow-400/20 bg-black/10'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <Icon className={`h-5 w-5 ${
                      theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                    }`} />
                    <div>
                      <div className={`font-medium ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {fieldConfig.label}
                        {fieldConfig.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <select
                    value={mappedColumn || ''}
                    onChange={(e) => {
                      const newMapping = { ...columnMapping };
                      
                      // Remove old mapping for this field
                      Object.keys(newMapping).forEach(key => {
                        if (newMapping[key] === fieldConfig.field) {
                          delete newMapping[key];
                        }
                      });
                      
                      // Add new mapping
                      if (e.target.value) {
                        newMapping[e.target.value] = fieldConfig.field;
                      }
                      
                      setColumnMapping(newMapping);
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
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
                    <div className={`mt-2 p-2 rounded text-xs ${
                      theme === 'gold' ? 'bg-black/20' : 'bg-white'
                    }`}>
                      <div className={`font-medium mb-1 ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Sample data:
                      </div>
                      <div className={`${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
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
                  ? 'text-gray-400 bg-gray-800 hover:bg-gray-700'
                  : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Back to Upload
            </button>
            <button
              onClick={processLeads}
              disabled={!columnMapping.phone && !columnMapping.email}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
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
            <h3 className={`text-lg font-semibold mb-2 ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Review & Upload
            </h3>
            <p className={`text-sm ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Review your processed leads before uploading
            </p>
          </div>

          {/* Upload Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-black/20'
                : 'border-gray-200 bg-white'
            }`}>
              <div className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`}>
                {uploadStats.totalRows}
              </div>
              <div className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Total Rows
              </div>
            </div>

            <div className={`p-4 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-black/20'
                : 'border-gray-200 bg-white'
            }`}>
              <div className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-green-400' : 'text-green-600'
              }`}>
                {uploadStats.validLeads}
              </div>
              <div className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Valid Leads
              </div>
            </div>

            <div className={`p-4 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-black/20'
                : 'border-gray-200 bg-white'
            }`}>
              <div className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-red-400' : 'text-red-600'
              }`}>
                {uploadStats.errors}
              </div>
              <div className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Errors
              </div>
            </div>

            <div className={`p-4 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-black/20'
                : 'border-gray-200 bg-white'
            }`}>
              <div className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
              }`}>
                {uploadStats.totalRows > 0 ? Math.round((uploadStats.validLeads / uploadStats.totalRows) * 100) : 0}%
              </div>
              <div className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Success Rate
              </div>
            </div>
          </div>

          {/* Sample Leads Preview */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/10'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <h4 className={`text-sm font-medium mb-3 ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Sample Leads (First 5)
            </h4>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className={`border-b ${
                    theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
                  }`}>
                    <th className={`text-left py-2 px-3 text-xs font-medium ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Name
                    </th>
                    <th className={`text-left py-2 px-3 text-xs font-medium ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Phone
                    </th>
                    <th className={`text-left py-2 px-3 text-xs font-medium ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Email
                    </th>
                    <th className={`text-left py-2 px-3 text-xs font-medium ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Company
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {processedLeads.slice(0, 5).map((lead, index) => (
                    <tr key={index} className={`border-b ${
                      theme === 'gold' ? 'border-yellow-400/10' : 'border-gray-100'
                    }`}>
                      <td className={`py-2 px-3 text-sm ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {lead.name || 'No name'}
                      </td>
                      <td className={`py-2 px-3 text-sm ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {lead.phone || 'No phone'}
                      </td>
                      <td className={`py-2 px-3 text-sm ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {lead.email || 'No email'}
                      </td>
                      <td className={`py-2 px-3 text-sm ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
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
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep('map')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'text-gray-400 bg-gray-800 hover:bg-gray-700'
                  : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Back to Mapping
            </button>
            <button
              onClick={uploadLeads}
              disabled={uploading || processedLeads.length === 0}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-green-600 text-white hover:bg-green-700'
              } disabled:opacity-50`}
            >
              {uploading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
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
}