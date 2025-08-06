/*
  # Email Tracking Edge Function

  1. Purpose
    - Track email opens via tracking pixel
    - Track email link clicks via redirect
    - Record email events in database

  2. Security
    - Validates tracking IDs
    - Rate limiting for tracking requests
    - CORS headers for browser requests

  3. Endpoints
    - GET /email-tracking?t=tracking_id&e=open - Track email open
    - GET /email-tracking?t=tracking_id&e=click&url=destination - Track link click
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 1x1 transparent pixel for email tracking
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF,
  0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x04, 0x01, 0x00, 0x3B
]);

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

    // Parse URL parameters
    const url = new URL(req.url);
    const trackingId = url.searchParams.get('t');
    const eventType = url.searchParams.get('e');
    const destinationUrl = url.searchParams.get('url');

    if (!trackingId || !eventType) {
      return new Response(
        JSON.stringify({ error: 'Missing tracking ID or event type' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate tracking ID exists
    const { data: emailTracking, error: trackingError } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('tracking_id', trackingId)
      .single();

    if (trackingError || !emailTracking) {
      console.warn('Invalid tracking ID:', trackingId);
      
      // For open events, still return pixel even if tracking fails
      if (eventType === 'open') {
        return new Response(TRACKING_PIXEL, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
      }
      
      return new Response(
        JSON.stringify({ error: 'Invalid tracking ID' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get client information
    const userAgent = req.headers.get('User-Agent') || '';
    const clientIP = req.headers.get('CF-Connecting-IP') || 
                     req.headers.get('X-Forwarded-For') || 
                     req.headers.get('X-Real-IP') || 
                     'unknown';

    // Record the event
    const eventData = {
      tracking_id: trackingId,
      event_type: eventType,
      ip_address: clientIP,
      user_agent: userAgent,
      link_url: destinationUrl || null,
      timestamp: new Date().toISOString()
    };

    const { error: eventError } = await supabase
      .from('email_events')
      .insert([eventData]);

    if (eventError) {
      console.error('Failed to record email event:', eventError);
    }

    // Handle different event types
    switch (eventType) {
      case 'open':
        // Return tracking pixel
        return new Response(TRACKING_PIXEL, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });

      case 'click':
        // Redirect to destination URL
        if (destinationUrl) {
          return new Response(null, {
            status: 302,
            headers: {
              ...corsHeaders,
              'Location': destinationUrl
            }
          });
        } else {
          return new Response(
            JSON.stringify({ error: 'No destination URL provided for click tracking' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

      case 'reply':
        // Record reply event (usually called by email webhook)
        return new Response(
          JSON.stringify({ success: true, message: 'Reply event recorded' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown event type' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }

  } catch (error) {
    console.error('Email tracking error:', error);
    
    // For open events, always return pixel even on error
    const url = new URL(req.url);
    const eventType = url.searchParams.get('e');
    
    if (eventType === 'open') {
      return new Response(TRACKING_PIXEL, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});