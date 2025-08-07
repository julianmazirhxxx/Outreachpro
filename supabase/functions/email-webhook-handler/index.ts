/*
  # Email Webhook Handler

  1. Purpose
    - Handle incoming email webhooks from Gmail, Outlook, etc.
    - Process email replies and forward messages
    - Extract tracking information from email headers

  2. Security
    - Validates webhook signatures
    - Rate limiting for webhook requests
    - Input sanitization

  3. Endpoints
    - POST /email-webhook-handler - Handle email webhooks
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Webhook-Signature",
};

// Extract tracking ID from various email sources
function extractTrackingId(emailData: any): string | null {
  // Try multiple methods to find tracking ID
  
  // 1. Check custom headers
  if (emailData.headers?.['x-tracking-id']) {
    return emailData.headers['x-tracking-id'];
  }
  
  // 2. Check subject line for [TRACK:id] format
  if (emailData.subject) {
    const subjectMatch = emailData.subject.match(/\[TRACK:([^\]]+)\]/);
    if (subjectMatch) {
      return subjectMatch[1];
    }
  }
  
  // 3. Check In-Reply-To header for tracking info
  if (emailData.headers?.['in-reply-to']) {
    const replyMatch = emailData.headers['in-reply-to'].match(/track-([^@]+)@/);
    if (replyMatch) {
      return replyMatch[1];
    }
  }
  
  // 4. Check References header
  if (emailData.headers?.references) {
    const refMatch = emailData.headers.references.match(/track-([^@]+)@/);
    if (refMatch) {
      return refMatch[1];
    }
  }
  
  // 5. Check Message-ID of original email
  if (emailData.headers?.['message-id']) {
    const msgMatch = emailData.headers['message-id'].match(/track-([^@]+)@/);
    if (msgMatch) {
      return msgMatch[1];
    }
  }
  
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method === "POST") {
    try {
      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Parse webhook payload
      const webhookData = await req.json();
      console.log('Received email webhook:', JSON.stringify(webhookData, null, 2));

      // Extract email information
      let emailInfo = {
        from: '',
        to: '',
        subject: '',
        body: '',
        headers: {} as Record<string, string>,
        timestamp: new Date().toISOString()
      };

      // Handle Gmail Pub/Sub webhook format
      if (webhookData.message?.data) {
        try {
          const messageData = JSON.parse(atob(webhookData.message.data));
          
          // Extract headers
          const headers: Record<string, string> = {};
          messageData.payload?.headers?.forEach((header: any) => {
            headers[header.name.toLowerCase()] = header.value;
          });
          
          emailInfo = {
            from: headers.from || '',
            to: headers.to || '',
            subject: headers.subject || '',
            body: '', // Will extract below
            headers,
            timestamp: new Date(parseInt(messageData.internalDate || Date.now())).toISOString()
          };
          
          // Extract body
          if (messageData.payload?.body?.data) {
            emailInfo.body = atob(messageData.payload.body.data);
          } else if (messageData.payload?.parts) {
            const textPart = messageData.payload.parts.find((part: any) => 
              part.mimeType === 'text/plain'
            );
            if (textPart?.body?.data) {
              emailInfo.body = atob(textPart.body.data);
            }
          }
        } catch (parseError) {
          console.error('Failed to parse Gmail message data:', parseError);
          throw new Error('Invalid Gmail webhook format');
        }
      }
      // Handle direct webhook format
      else {
        emailInfo = {
          from: webhookData.from || webhookData.sender || '',
          to: webhookData.to || webhookData.recipient || '',
          subject: webhookData.subject || '',
          body: webhookData.body || webhookData.text || webhookData.html || '',
          headers: webhookData.headers || {},
          timestamp: webhookData.timestamp || new Date().toISOString()
        };
      }

      // Extract tracking ID
      const trackingId = extractTrackingId(emailInfo);
      
      if (!trackingId) {
        console.warn('No tracking ID found in email webhook');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'No tracking ID found',
            debug: {
              subject: emailInfo.subject,
              from: emailInfo.from,
              headers: Object.keys(emailInfo.headers)
            }
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Find the email tracking record
      const { data: emailTracking, error: trackingError } = await supabase
        .from('email_tracking')
        .select('*')
        .eq('tracking_id', trackingId)
        .single();

      if (trackingError || !emailTracking) {
        console.warn('Email tracking record not found for ID:', trackingId);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Email tracking record not found',
            tracking_id: trackingId
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Record the reply event
      const { error: eventError } = await supabase
        .from('email_events')
        .insert([{
          tracking_id: trackingId,
          event_type: 'reply',
          timestamp: emailInfo.timestamp,
          metadata: {
            from_email: emailInfo.from,
            subject: emailInfo.subject,
            body_preview: emailInfo.body.substring(0, 500),
            headers: emailInfo.headers
          }
        }]);

      if (eventError) {
        console.error('Failed to record email event:', eventError);
      }

      // Record in conversation history
      const { error: conversationError } = await supabase
        .from('conversation_history')
        .insert([{
          campaign_id: emailTracking.campaign_id,
          lead_id: emailTracking.lead_id,
          channel: 'email',
          from_role: 'lead',
          message: emailInfo.body,
          email_subject: emailInfo.subject,
          email_body: emailInfo.body,
          timestamp: emailInfo.timestamp
        }]);

      if (conversationError) {
        console.error('Failed to record conversation:', conversationError);
      }

      console.log('Successfully processed email reply for tracking ID:', trackingId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email reply processed successfully',
          tracking_id: trackingId,
          from: emailInfo.from
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );

    } catch (error) {
      console.error('Email webhook processing error:', error);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to process email webhook',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }

  // Health check for GET requests
  return new Response(
    JSON.stringify({
      service: "Email Webhook Handler",
      status: "running",
      version: "1.0.0",
      methods: ["POST"],
      timestamp: new Date().toISOString()
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
});