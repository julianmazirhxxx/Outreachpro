import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  EyeOff,
  ExternalLink,
  Code
} from 'lucide-react';

interface VapiAssistant {
  id: string;
  name: string;
  recordingEnabled?: boolean;
}

export function VapiAssistantUpdater() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [vapiApiKey, setVapiApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [fetchingAssistants, setFetchingAssistants] = useState(false);

  useEffect(() => {
    if (user) {
      fetchVapiApiKey();
    }
  }, [user]);

  const fetchVapiApiKey = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('channels')
        .select('credentials')
        .eq('user_id', user.id)
        .eq('provider', 'vapi')
        .eq('channel_type', 'voice')
        .eq('is_active', true)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const apiKey = data[0].credentials?.api_key;
        if (apiKey) {
          setVapiApiKey(apiKey);
          fetchAssistants(apiKey);
        }
      }
    } catch (error) {
      console.error('Error fetching Vapi API key:', error);
      setResult({
        success: false,
        message: 'Failed to fetch Vapi API key from your channel configuration'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAssistants = async (apiKey: string) => {
    if (!apiKey) return;

    setFetchingAssistants(true);
    try {
      const response = await fetch('https://api.vapi.ai/assistant', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch assistants: ${response.status}`);
      }

      const data = await response.json();
      const assistantList = Array.isArray(data) ? data : [data];
      
      const formattedAssistants = assistantList.map((assistant: any) => ({
        id: assistant.id,
        name: assistant.name || 'Unnamed Assistant',
        recordingEnabled: assistant.artifactPlan?.recordingEnabled || false
      }));

      setAssistants(formattedAssistants);
    } catch (error) {
      console.error('Error fetching assistants:', error);
      setResult({
        success: false,
        message: `Failed to fetch assistants: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setFetchingAssistants(false);
    }
  };

  const updateAssistantRecording = async (assistantId: string, assistantName: string) => {
    if (!vapiApiKey) {
      setResult({
        success: false,
        message: 'Vapi API key not found'
      });
      return;
    }

    setUpdating(assistantId);
    setResult(null);

    try {
      // First, get the current assistant configuration
      const getResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${vapiApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!getResponse.ok) {
        throw new Error(`Failed to fetch assistant: ${getResponse.status}`);
      }

      const currentConfig = await getResponse.json();

      // Update the configuration with recording enabled
      const updatedConfig = {
        ...currentConfig,
        artifactPlan: {
          ...currentConfig.artifactPlan,
          recordingEnabled: true
        }
      };

      // Update the assistant
      const updateResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${vapiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedConfig),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update assistant: ${updateResponse.status} - ${errorText}`);
      }

      setResult({
        success: true,
        message: `Successfully enabled recording for "${assistantName}". All future calls will be recorded!`
      });

      // Refresh assistants list
      fetchAssistants(vapiApiKey);

    } catch (error) {
      console.error('Error updating assistant:', error);
      setResult({
        success: false,
        message: `Failed to update assistant: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className={`animate-spin rounded-full h-8 w-8 border-2 border-transparent ${
          theme === 'gold'
            ? 'border-t-yellow-400'
            : 'border-t-blue-600'
        }`}></div>
      </div>
    );
  }

  if (!vapiApiKey) {
    return (
      <div className={`p-6 rounded-lg border ${
        theme === 'gold'
          ? 'border-red-500/20 bg-red-500/5'
          : 'border-red-200 bg-red-50'
      }`}>
        <div className="flex items-center space-x-3 mb-4">
          <XCircle className={`h-5 w-5 ${
            theme === 'gold' ? 'text-red-400' : 'text-red-600'
          }`} />
          <h3 className={`text-lg font-semibold ${
            theme === 'gold' ? 'text-red-400' : 'text-red-800'
          }`}>
            Vapi Configuration Required
          </h3>
        </div>
        <p className={`text-sm mb-4 ${
          theme === 'gold' ? 'text-red-300' : 'text-red-700'
        }`}>
          No active Vapi channel found. You need to set up a Vapi voice channel first.
        </p>
        <a
          href="/settings"
          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            theme === 'gold'
              ? 'gold-gradient text-black hover-gold'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Settings className="h-4 w-4 mr-2" />
          Set Up Vapi Channel
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Vapi Assistant Recording Configuration
          </h3>
          <p className={`text-sm ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Enable recording for your Vapi assistants to get call recordings and transcripts
          </p>
        </div>
        <button
          onClick={() => fetchAssistants(vapiApiKey)}
          disabled={fetchingAssistants}
          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            theme === 'gold'
              ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
          } disabled:opacity-50`}
        >
          {fetchingAssistants ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh Assistants
        </button>
      </div>

      {/* API Key Display */}
      <div className={`p-4 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/10'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className={`text-sm font-medium ${
            theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Vapi API Key
          </h4>
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className={`text-sm ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`}
          >
            {showApiKey ? (
              <><EyeOff className="h-4 w-4 inline mr-1" />Hide</>
            ) : (
              <><Eye className="h-4 w-4 inline mr-1" />Show</>
            )}
          </button>
        </div>
        <div className={`text-sm font-mono ${
          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {showApiKey ? vapiApiKey : '••••••••••••••••••••••••••••••••••••••••'}
        </div>
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
                <XCircle className="h-5 w-5" />
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{result.message}</p>
            </div>
            <button
              onClick={() => setResult(null)}
              className="ml-auto text-current hover:opacity-70"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Configuration Guide */}
      <div className={`p-4 rounded-lg ${
        theme === 'gold'
          ? 'bg-blue-500/10 border border-blue-500/20'
          : 'bg-blue-50 border border-blue-200'
      }`}>
        <h4 className={`text-sm font-medium mb-2 ${
          theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
        }`}>
          📋 Required Configuration
        </h4>
        <div className={`text-sm space-y-2 ${
          theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
        }`}>
          <p>To enable recordings, each assistant needs this configuration:</p>
          <div className={`p-3 rounded-lg font-mono text-xs ${
            theme === 'gold' ? 'bg-black/20' : 'bg-white'
          }`}>
            {`{
  "artifactPlan": {
    "recordingEnabled": true
  }
}`}
          </div>
          <p>• This must be set via API (not available in Vapi dashboard)</p>
          <p>• Once enabled, all future calls will be recorded automatically</p>
          <p>• Recordings are kept for 30 days by default</p>
        </div>
      </div>

      {/* Assistants List */}
      <div className={`rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/20'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className={`p-4 border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <h4 className={`text-md font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Your Vapi Assistants ({assistants.length})
          </h4>
        </div>

        <div className="p-4">
          {assistants.length === 0 ? (
            <div className="text-center py-8">
              <Settings className={`h-12 w-12 mx-auto mb-4 ${
                theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {fetchingAssistants ? 'Loading assistants...' : 'No assistants found'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {assistants.map((assistant) => (
                <div
                  key={assistant.id}
                  className={`p-4 rounded-lg border ${
                    theme === 'gold'
                      ? 'border-yellow-400/20 bg-black/10'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        assistant.recordingEnabled
                          ? theme === 'gold' ? 'bg-green-500/20' : 'bg-green-100'
                          : theme === 'gold' ? 'bg-red-500/20' : 'bg-red-100'
                      }`}>
                        {assistant.recordingEnabled ? (
                          <CheckCircle className={`h-5 w-5 ${
                            theme === 'gold' ? 'text-green-400' : 'text-green-600'
                          }`} />
                        ) : (
                          <XCircle className={`h-5 w-5 ${
                            theme === 'gold' ? 'text-red-400' : 'text-red-600'
                          }`} />
                        )}
                      </div>
                      <div>
                        <div className={`font-medium ${
                          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                        }`}>
                          {assistant.name}
                        </div>
                        <div className={`text-sm ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          ID: {assistant.id}
                        </div>
                        <div className={`text-xs ${
                          assistant.recordingEnabled
                            ? theme === 'gold' ? 'text-green-400' : 'text-green-600'
                            : theme === 'gold' ? 'text-red-400' : 'text-red-600'
                        }`}>
                          Recording: {assistant.recordingEnabled ? 'Enabled' : 'Disabled'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <a
                        href={`https://dashboard.vapi.ai/assistant/${assistant.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-2 rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'text-gray-400 hover:bg-gray-800'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        title="View in Vapi Dashboard"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>

                      {!assistant.recordingEnabled && (
                        <button
                          onClick={() => updateAssistantRecording(assistant.id, assistant.name)}
                          disabled={updating === assistant.id}
                          className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            theme === 'gold'
                              ? 'gold-gradient text-black hover-gold'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          } disabled:opacity-50`}
                        >
                          {updating === assistant.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Enable Recording
                        </button>
                      )}

                      {assistant.recordingEnabled && (
                        <div className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                          theme === 'gold'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Recording Enabled
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual API Instructions */}
      <div className={`p-4 rounded-lg ${
        theme === 'gold'
          ? 'bg-yellow-500/10 border border-yellow-500/20'
          : 'bg-yellow-50 border border-yellow-200'
      }`}>
        <h4 className={`text-sm font-medium mb-2 ${
          theme === 'gold' ? 'text-yellow-400' : 'text-yellow-700'
        }`}>
          💡 Manual API Update (Alternative)
        </h4>
        <div className={`text-sm space-y-2 ${
          theme === 'gold' ? 'text-yellow-300' : 'text-yellow-600'
        }`}>
          <p>If the automatic update doesn't work, you can manually update via cURL:</p>
          <div className={`p-3 rounded-lg font-mono text-xs overflow-x-auto ${
            theme === 'gold' ? 'bg-black/20' : 'bg-white'
          }`}>
            {`curl -X PATCH "https://api.vapi.ai/assistant/YOUR_ASSISTANT_ID" \\
  -H "Authorization: Bearer ${showApiKey ? vapiApiKey : '••••••••••••••••••••••••••••••••••••••••'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "artifactPlan": {
      "recordingEnabled": true
    }
  }'`}
          </div>
        </div>
      </div>
    </div>
  );
}