import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Phone, 
  MessageSquare, 
  Mail, 
  Calendar, 
  Play, 
  Clock, 
  User,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import { VapiRecordingViewer } from './VapiRecordingViewer';

interface ActivityItem {
  id: string;
  type: 'conversation' | 'activity';
  campaign_id: string;
  lead_id: string | null;
  channel: string;
  from_role: string;
  message: string | null;
  timestamp: string;
  call_duration?: number | null;
  recording_url?: string | null;
  vapi_call_id?: string | null;
  listen_url?: string | null;
  email_subject?: string | null;
  email_body?: string | null;
  status?: string | null;
  lead_name?: string | null;
  lead_phone?: string | null;
  campaign_offer?: string | null;
}

interface ActivityFeedProps {
  searchTerm: string;
  selectedCampaign: string;
  campaigns: any[];
  theme: string;
}

export function ActivityFeed({ searchTerm, selectedCampaign, campaigns, theme }: ActivityFeedProps) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<{
    callId: string;
    recordingUrl: string;
    leadName: string;
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      fetchActivities();
    }
  }, [user, selectedCampaign]);

  const fetchActivities = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch conversation history
      let conversationQuery = supabase
        .from('conversation_history')
        .select(`
          id,
          campaign_id,
          lead_id,
          channel,
          from_role,
          message,
          timestamp,
          email_subject,
          email_body,
          uploaded_leads!inner(name, phone)
        `)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (selectedCampaign) {
        conversationQuery = conversationQuery.eq('campaign_id', selectedCampaign);
      }

      const [conversationResponse] = await Promise.all([
        conversationQuery
      ]);

      if (conversationResponse.error) throw conversationResponse.error;

      // Format conversation activities only (no duplicates from activity history)
      const conversationActivities: ActivityItem[] = (conversationResponse.data || []).map(item => ({
        id: item.id,
        type: 'conversation' as const,
        campaign_id: item.campaign_id,
        lead_id: item.lead_id,
        channel: item.channel,
        from_role: item.from_role,
        message: item.message,
        timestamp: item.timestamp,
        email_subject: item.email_subject,
        email_body: item.email_body,
        lead_name: (item.uploaded_leads as any)?.name,
        lead_phone: (item.uploaded_leads as any)?.phone,
        campaign_offer: getCampaignName(item.campaign_id)
      }));

      // Remove duplicates by creating a unique key for each activity
      const uniqueActivities = new Map();
      conversationActivities.forEach(activity => {
        const uniqueKey = `${activity.lead_id}-${activity.channel}-${activity.from_role}-${activity.timestamp}`;
        if (!uniqueActivities.has(uniqueKey)) {
          uniqueActivities.set(uniqueKey, activity);
        }
      });

      // Convert back to array and sort by timestamp
      const allActivities = Array.from(uniqueActivities.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivities(allActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCampaignName = (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.offer || 'Unknown Campaign';
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'vapi':
      case 'call':
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

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'vapi':
      case 'call':
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

  const getStatusIcon = (status: string | null, fromRole: string) => {
    if (fromRole === 'lead') {
      return ArrowDownLeft; // Inbound
    }
    
    switch (status) {
      case 'completed':
        return CheckCircle;
      case 'failed':
        return XCircle;
      case 'running':
        return Clock;
      default:
        return ArrowUpRight; // Outbound
    }
  };

  const getStatusColor = (status: string | null, fromRole: string) => {
    if (fromRole === 'lead') {
      return theme === 'gold' ? 'text-green-400' : 'text-green-600';
    }
    
    switch (status) {
      case 'completed':
        return theme === 'gold' ? 'text-green-400' : 'text-green-600';
      case 'failed':
        return theme === 'gold' ? 'text-red-400' : 'text-red-600';
      case 'running':
        return theme === 'gold' ? 'text-yellow-400' : 'text-yellow-600';
      default:
        return theme === 'gold' ? 'text-blue-400' : 'text-blue-600';
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleViewRecording = (activity: ActivityItem) => {
    if (!activity.vapi_call_id && !activity.recording_url && !activity.message?.startsWith('wss://') && !activity.message?.includes('storage.vapi.ai')) return;
    
    setSelectedRecording({
      callId: activity.vapi_call_id || '',
      recordingUrl: activity.recording_url || 
                   (activity.message?.startsWith('wss://') ? activity.message : '') ||
                   (activity.message?.includes('storage.vapi.ai') ? activity.message : ''),
      leadName: activity.lead_name || 'Unknown Lead',
      timestamp: activity.timestamp
    });
  };

  const filteredActivities = activities.filter((activity) => {
    const matchesSearch = !searchTerm || 
      (activity.lead_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (activity.lead_phone?.includes(searchTerm)) ||
      (activity.message?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (activity.email_subject?.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCampaign = !selectedCampaign || activity.campaign_id === selectedCampaign;

    return matchesSearch && matchesCampaign;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={`animate-spin rounded-full h-8 w-8 border-2 border-transparent ${
          theme === 'gold'
            ? 'border-t-yellow-400'
            : 'border-t-blue-600'
        }`}></div>
      </div>
    );
  }

  if (filteredActivities.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className={`h-12 w-12 mx-auto mb-4 ${
          theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
        }`} />
        <h3 className={`text-lg font-medium mb-2 ${
          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
        }`}>
          No activities yet
        </h3>
        <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
          {searchTerm || selectedCampaign
            ? 'No activities match your search criteria'
            : 'Lead activities and interactions will appear here'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {filteredActivities.map((activity) => {
          const ChannelIcon = getChannelIcon(activity.channel);
          const StatusIcon = getStatusIcon(activity.status, activity.from_role);
          const isInbound = activity.from_role === 'lead';
          const hasRecording = activity.recording_url || activity.vapi_call_id;
          
          return (
            <div
              key={`${activity.type}-${activity.id}`}
              className={`p-4 rounded-lg border transition-colors ${
                theme === 'gold'
                  ? 'border-yellow-400/20 bg-black/10 hover:bg-yellow-400/5'
                  : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-start space-x-4">
                {/* Channel Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isInbound
                    ? theme === 'gold' ? 'bg-green-500/20' : 'bg-green-100'
                    : theme === 'gold' ? 'bg-blue-500/20' : 'bg-blue-100'
                }`}>
                  <ChannelIcon className={`h-5 w-5 ${getChannelColor(activity.channel)}`} />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <StatusIcon className={`h-4 w-4 ${getStatusColor(activity.status, activity.from_role)}`} />
                      <span className={`text-sm font-medium ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {activity.lead_name || 'Unknown Lead'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isInbound
                          ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                          : theme === 'gold' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {isInbound ? 'Inbound' : 'Outbound'}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {/* Call Duration */}
                      {activity.call_duration && (
                        <div className={`flex items-center text-xs ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDuration(activity.call_duration)}
                        </div>
                      )}
                      
                      {/* Recording Button */}
                      {((hasRecording || activity.listen_url || activity.message?.startsWith('wss://') || activity.message?.includes('storage.vapi.ai')) && (activity.channel === 'vapi' || activity.channel === 'call')) && (
                        <button
                          onClick={() => handleViewRecording(activity)}
                          className={`flex items-center text-xs hover:underline ${
                            theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                          }`}
                          title={
                            activity.recording_url || activity.message?.includes('storage.vapi.ai') 
                              ? "Play recording" 
                              : activity.message?.startsWith('wss://') 
                                ? "View live call stream" 
                                : "View call details"
                          }
                        >
                          <Play className="h-3 w-3 mr-1" />
                          {activity.recording_url || activity.message?.includes('storage.vapi.ai') 
                            ? 'Recording' 
                            : activity.message?.startsWith('wss://') 
                              ? 'Live Stream' 
                              : 'View Call'
                          }
                        </button>
                      )}
                      
                      {/* Timestamp */}
                      <span className={`text-xs ${
                        theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        {new Date(activity.timestamp).toLocaleDateString()} {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Channel and Campaign Info */}
                  <div className="flex items-center space-x-4 mb-2">
                    <div className={`text-sm ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <span className="font-medium">
                        {activity.channel === 'vapi' ? 'Voice Call' : 
                         activity.channel === 'sms' ? 'SMS' :
                         activity.channel === 'whatsapp' ? 'WhatsApp' :
                         activity.channel === 'email' ? 'Email' :
                         activity.channel.charAt(0).toUpperCase() + activity.channel.slice(1)}
                      </span>
                      {activity.lead_phone && (
                        <span className={`ml-2 text-xs ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          • {activity.lead_phone}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs ${
                      theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      {activity.campaign_offer}
                    </div>
                  </div>

                  {/* Email Subject */}
                  {activity.email_subject && (
                    <div className={`mb-2 p-2 rounded border-l-4 ${
                      theme === 'gold'
                        ? 'border-yellow-400 bg-yellow-400/5'
                        : 'border-blue-500 bg-blue-50'
                    }`}>
                      <div className={`text-xs font-medium ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                      }`}>
                        Subject: {activity.email_subject}
                      </div>
                    </div>
                  )}

                  {/* Message Content */}
                  {(activity.message || activity.email_body) && !activity.message?.startsWith('wss://') && (
                    <p className={`text-sm ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {activity.channel === 'email' ? activity.email_body : activity.message}
                    </p>
                  )}

                  {/* WebSocket URL Detection - Don't show as message */}
                  {activity.message?.startsWith('wss://') && (
                    <div className={`text-xs ${
                      theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      Live call stream available
                    </div>
                  )}

                  {/* Status Indicator */}
                  {activity.status && activity.type === 'activity' && (
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        activity.status === 'completed'
                          ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                          : activity.status === 'failed'
                          ? theme === 'gold' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800'
                          : theme === 'gold' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Vapi Recording Viewer Modal */}
      {selectedRecording && (
        <VapiRecordingViewer
          callId={selectedRecording.callId}
          recordingUrl={selectedRecording.recordingUrl}
          leadName={selectedRecording.leadName}
          timestamp={selectedRecording.timestamp}
          onClose={() => setSelectedRecording(null)}
        />
      )}
    </div>
  );
}