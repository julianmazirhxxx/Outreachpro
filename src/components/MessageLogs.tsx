import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { Phone, MessageSquare, Mail, ArrowUpRight, ArrowDownLeft, Play, Clock, Eye, MousePointer, Reply, User, Bot } from 'lucide-react';

interface ConversationHistory {
  id: string;
  channel: string;
  from_role: string;
  message: string | null;
  timestamp: string;
  email_subject?: string | null;
  email_body?: string | null;
}

interface EmailEvent {
  id: string;
  tracking_id: string;
  event_type: string;
  timestamp: string;
  ip_address?: string;
  link_url?: string;
}
interface MessageLogsProps {
  leadId: string;
  campaignId: string;
}

export function MessageLogs({ leadId, campaignId }: MessageLogsProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ConversationHistory[]>([]);
  const [emailEvents, setEmailEvents] = useState<EmailEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (leadId) {
      fetchMessages();
      fetchEmailEvents();
    }
  }, [leadId]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('conversation_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      
      setMessages(data || []);
      console.log('Fetched messages for lead:', leadId, data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailEvents = async () => {
    try {
      // Get email tracking records for this lead and campaign
      const { data: emailTracking, error: trackingError } = await supabase
        .from('email_tracking')
        .select(`
          tracking_id,
          email_events (
            id,
            event_type,
            timestamp,
            ip_address,
            link_url
          )
        `)
        .eq('lead_id', leadId)
        .order('sent_at', { ascending: false });

      if (trackingError) throw trackingError;

      // Flatten email events
      const allEvents: EmailEvent[] = [];
      emailTracking?.forEach(tracking => {
        if (tracking.email_events && Array.isArray(tracking.email_events)) {
          tracking.email_events.forEach((event: any) => {
            allEvents.push({
              id: event.id,
              tracking_id: tracking.tracking_id,
              event_type: event.event_type,
              timestamp: event.timestamp,
              ip_address: event.ip_address,
              link_url: event.link_url
            });
          });
        }
      });

      setEmailEvents(allEvents);
    } catch (error) {
      console.error('Error fetching email events:', error);
    }
  };
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'vapi':
      case 'call':
        return Phone;
      case 'sms':
      case 'whatsapp':
        return MessageSquare;
      case 'email':
        return Mail;
      case 'email':
        return Mail;
      default:
        return MessageSquare;
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'open':
        return Eye;
      case 'click':
        return MousePointer;
      case 'reply':
        return Reply;
      default:
        return MessageSquare;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'open':
        return theme === 'gold' ? 'text-blue-400' : 'text-blue-600';
      case 'click':
        return theme === 'gold' ? 'text-green-400' : 'text-green-600';
      case 'reply':
        return theme === 'gold' ? 'text-purple-400' : 'text-purple-600';
      default:
        return theme === 'gold' ? 'text-gray-400' : 'text-gray-600';
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

  if (messages.length === 0 && emailEvents.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare className={`h-12 w-12 mx-auto mb-4 ${
          theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
        }`} />
        <p className={`text-sm ${
          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          No conversation history yet
        </p>
      </div>
    );
  }

  // Combine messages and email events into a single timeline
  const allActivity = [
    ...messages.map(msg => ({
      id: msg.id,
      type: 'message' as const,
      timestamp: msg.timestamp,
      data: msg
    })),
    ...emailEvents.map(event => ({
      id: event.id,
      type: 'email_event' as const,
      timestamp: event.timestamp,
      data: event
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return (
    <div className="space-y-4">
      <h4 className={`text-sm font-medium ${
        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
      }`}>
        Conversation History ({allActivity.length})
      </h4>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {allActivity.map((activity) => {
          if (activity.type === 'message') {
            const message = activity.data as ConversationHistory;
            const Icon = getMessageIcon(message.channel);
            const isOutbound = message.from_role === 'ai';
            
            return (
              <div
                key={`msg-${message.id}`}
                className={`p-4 rounded-lg border ${
                  theme === 'gold'
                    ? 'border-yellow-400/20 bg-black/10'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-lg ${
                      theme === 'gold'
                        ? isOutbound ? 'bg-yellow-400/20' : 'bg-blue-400/20'
                        : isOutbound ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      <Icon className={`h-4 w-4 ${
                        theme === 'gold'
                          ? isOutbound ? 'text-yellow-400' : 'text-blue-400'
                          : isOutbound ? 'text-blue-600' : 'text-green-600'
                      }`} />
                    </div>
                    
                    {/* Role indicator */}
                    <div className={`p-1 rounded ${
                      isOutbound 
                        ? theme === 'gold' ? 'bg-yellow-400/10' : 'bg-blue-50'
                        : theme === 'gold' ? 'bg-green-400/10' : 'bg-green-50'
                    }`}>
                      {isOutbound ? (
                        <Bot className={`h-3 w-3 ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                        }`} />
                      ) : (
                        <User className={`h-3 w-3 ${
                          theme === 'gold' ? 'text-green-400' : 'text-green-600'
                        }`} />
                      )}
                    </div>
                    
                    <span className={`text-sm font-medium capitalize ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {isOutbound ? 'AI Agent' : 'Lead'} • {message.channel === 'vapi' ? 'Call' : message.channel}
                    </span>
                  </div>
                  
                  <span className={`text-xs ${
                    theme === 'gold' ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    {new Date(message.timestamp).toLocaleDateString()} {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                {/* Email-specific display */}
                {message.channel === 'email' && message.email_subject && (
                  <div className={`mb-3 p-3 rounded-lg ${
                    theme === 'gold'
                      ? 'bg-purple-400/10 border border-purple-400/20'
                      : 'bg-purple-50 border border-purple-200'
                  }`}>
                    <div className={`text-sm font-medium ${
                      theme === 'gold' ? 'text-purple-400' : 'text-purple-700'
                    }`}>
                      📧 Subject: {message.email_subject}
                    </div>
                  </div>
                )}
                
                {/* Message content */}
                <div className={`p-3 rounded-lg ${
                  theme === 'gold' ? 'bg-gray-800/50' : 'bg-white'
                }`}>
                  {message.channel === 'email' && message.email_body ? (
                    <div className={`text-sm whitespace-pre-wrap ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {message.email_body}
                    </div>
                  ) : message.message ? (
                    <div className={`text-sm whitespace-pre-wrap ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {message.message}
                    </div>
                  ) : (
                    <div className={`text-sm italic ${
                      theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      No message content available
                    </div>
                  )}
                </div>
                
                {/* Debug info in development */}
                {import.meta.env.DEV && (
                  <details className="mt-2">
                    <summary className={`text-xs cursor-pointer ${
                      theme === 'gold' ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      Debug Info
                    </summary>
                    <pre className={`text-xs mt-1 p-2 rounded ${
                      theme === 'gold' ? 'bg-black/20 text-gray-400' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {JSON.stringify({
                        id: message.id,
                        channel: message.channel,
                        from_role: message.from_role,
                        has_message: !!message.message,
                        has_email_body: !!message.email_body,
                        has_email_subject: !!message.email_subject,
                        message_length: message.message?.length || 0,
                        email_body_length: message.email_body?.length || 0
                      }, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            );
          } else {
            // Email event
            const event = activity.data as EmailEvent;
            const EventIcon = getEventIcon(event.event_type);
            
            return (
              <div
                key={`event-${event.id}`}
                className={`p-3 rounded-lg border-l-4 ${
                  theme === 'gold'
                    ? 'border-blue-400 bg-blue-400/5'
                    : 'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <EventIcon className={`h-4 w-4 ${getEventColor(event.event_type)}`} />
                    <span className={`text-sm font-medium capitalize ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      Email {event.event_type}
                    </span>
                    {event.link_url && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        theme === 'gold'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        Link clicked
                      </span>
                    )}
                  </div>
                  <span className={`text-xs ${
                    theme === 'gold' ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    {new Date(event.timestamp).toLocaleDateString()} {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                {event.link_url && (
                  <p className={`text-xs mt-1 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Clicked: {event.link_url}
                  </p>
                )}
                
                {event.ip_address && (
                  <p className={`text-xs mt-1 ${
                    theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    IP: {event.ip_address}
                  </p>
                )}
              </div>
            );
          } else {
            // Email event
            const event = activity.data as EmailEvent;
            const EventIcon = getEventIcon(event.event_type);
            
            return (
              <div
                key={`event-${event.id}`}
                className={`p-3 rounded-lg border-l-4 ${
                  theme === 'gold'
                    ? 'border-blue-400 bg-blue-400/5'
                    : 'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <EventIcon className={`h-4 w-4 ${getEventColor(event.event_type)}`} />
                    <span className={`text-sm font-medium capitalize ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      Email {event.event_type}
                    </span>
                    {event.link_url && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        theme === 'gold'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        Link clicked
                      </span>
                    )}
                  </div>
                  <span className={`text-xs ${
                    theme === 'gold' ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    {new Date(event.timestamp).toLocaleDateString()} {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                {event.link_url && (
                  <p className={`text-xs mt-1 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Clicked: {event.link_url}
                  </p>
                )}
                
                {event.ip_address && (
                  <p className={`text-xs mt-1 ${
                    theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    IP: {event.ip_address}
                  </p>
                )}
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}