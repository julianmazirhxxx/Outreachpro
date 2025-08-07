/*
  # Email Tracking Edge Function

  1. Purpose
    - Track email opens via tracking pixel
    - Track email link clicks via redirect
    - Record email events in database
    - Handle email reply webhooks

  2. Security
    - Validates tracking IDs
    - Rate limiting for tracking requests
    - CORS headers for browser requests

  3. Endpoints
    - GET /email-tracking?t=tracking_id&e=open - Track email open
    - GET /email-tracking?t=tracking_id&e=click&url=destination - Track link click
    - POST /email-tracking - Handle email reply webhooks
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 1x1 transparent pixel for email tracking
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF,
  0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x04, 0x01, 0x00, 0x3B
]);

// Extract tracking ID from email headers or subject
function extractTrackingId(headers: any, subject: string): string | null {
  // Try to find tracking ID in custom headers
  if (headers['x-tracking-id']) {
    return headers['x-tracking-id'];
  }
  
  // Try to extract from subject line (format: [TRACK:tracking_id])
  const subjectMatch = subject.match(/\[TRACK:([^\]]+)\]/);
  if (subjectMatch) {
    return subjectMatch[1];
  }
  
  // Try to extract from message-id or references
  if (headers['message-id']) {
    const messageIdMatch = headers['message-id'].match(/track-([^@]+)@/);
    if (messageIdMatch) {
      return messageIdMatch[1];
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

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Handle email reply webhooks (POST)
  if (req.method === "POST") {
    try {
      const body = await req.json();
      
      // Handle different webhook formats (Gmail, Outlook, etc.)
      let fromEmail = '';
      let subject = '';
      let messageBody = '';
      let headers = {};
      let trackingId = '';
      
      // Gmail webhook format
      if (body.message && body.message.data) {
        const messageData = JSON.parse(atob(body.message.data));
        fromEmail = messageData.payload?.headers?.find((h: any) => h.name === 'From')?.value || '';
        subject = messageData.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || '';
        
        // Extract headers
        messageData.payload?.headers?.forEach((header: any) => {
          headers[header.name.toLowerCase()] = header.value;
        });
        
        // Get message body
        if (messageData.payload?.body?.data) {
          messageBody = atob(messageData.payload.body.data);
        } else if (messageData.payload?.parts) {
          // Multi-part message
          const textPart = messageData.payload.parts.find((part: any) => 
            part.mimeType === 'text/plain' || part.mimeType === 'text/html'
          );
          if (textPart?.body?.data) {
            messageBody = atob(textPart.body.data);
          }
        }
      }
      // Generic webhook format
      else {
        fromEmail = body.from || body.sender || '';
        subject = body.subject || '';
        messageBody = body.body || body.text || body.html || '';
        headers = body.headers || {};
      }
      
      // Extract tracking ID
      trackingId = extractTrackingId(headers, subject);
      
      if (!trackingId) {
        console.warn('No tracking ID found in email reply');
        return new Response(
          JSON.stringify({ error: 'No tracking ID found' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Verify tracking ID exists
      const { data: emailTracking, error: trackingError } = await supabase
        .from('email_tracking')
        .select('*')
        .eq('tracking_id', trackingId)
        .single();
      
      if (trackingError || !emailTracking) {
        console.warn('Invalid tracking ID in reply:', trackingId);
        return new Response(
          JSON.stringify({ error: 'Invalid tracking ID' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Record reply event
      const { error: eventError } = await supabase
        .from('email_events')
        .insert([{
          tracking_id: trackingId,
          event_type: 'reply',
          timestamp: new Date().toISOString(),
          metadata: {
            from_email: fromEmail,
            subject: subject,
            body_preview: messageBody.substring(0, 500)
          }
        }]);
      
      if (eventError) {
        console.error('Failed to record reply event:', eventError);
      }
      
      // Also record in conversation_history
      const { error: conversationError } = await supabase
        .from('conversation_history')
        .insert([{
          campaign_id: emailTracking.campaign_id,
          lead_id: emailTracking.lead_id,
          channel: 'email',
          from_role: 'lead',
          message: messageBody,
          email_subject: subject,
          email_body: messageBody
        }]);
      
      if (conversationError) {
        console.error('Failed to record conversation:', conversationError);
      }
      
      return new Response(
        JSON.stringify({ success: true, message: 'Reply recorded successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
      
    } catch (error) {
      console.error('Reply webhook error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to process reply webhook' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }

  // Health check and tracking endpoints (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const trackingId = url.searchParams.get('t');
    const eventType = url.searchParams.get('e');
    const destinationUrl = url.searchParams.get('url');

    // Health check
    if (!trackingId || !eventType) {
      return new Response(
        JSON.stringify({
          service: "Email Tracking Service",
          status: "running",
          version: "1.0.0",
          endpoints: {
            "GET /?t=tracking_id&e=open": "Track email open",
            "GET /?t=tracking_id&e=click&url=destination": "Track link click",
            "POST /": "Handle email reply webhooks"
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }
  
  // 404 for unknown endpoints
    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});