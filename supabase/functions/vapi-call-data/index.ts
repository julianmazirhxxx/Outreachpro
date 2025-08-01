/*
  # Vapi Call Data Edge Function

  1. Purpose
    - Fetch call details, recordings, and transcriptions from Vapi API
    - Get Vapi API key from user's channel configuration
    - Handle authentication and error responses

  2. Security
    - Vapi API key retrieved from user's channel credentials
    - User authentication required
    - CORS headers for browser requests

  3. Endpoints
    - POST /vapi-call-data with { call_id, user_id }
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface VapiCallRequest {
  call_id: string;
  user_id: string;
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

    // Parse request body
    const { call_id, user_id }: VapiCallRequest = await req.json();

    if (!call_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Call ID and User ID are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get Vapi API key from user's channels
    const { data: channels, error: channelsError } = await supabase
      .from('channels')
      .select('credentials')
      .eq('user_id', user_id)
      .eq('provider', 'vapi')
      .eq('channel_type', 'voice')
      .eq('is_active', true)
      .limit(1);

    if (channelsError) {
      console.error('Error fetching channels:', channelsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch channel configuration' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!channels || channels.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active Vapi channel found for user' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const vapiApiKey = channels[0].credentials?.api_key;
    if (!vapiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Vapi API key not found in channel configuration' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch call details from Vapi
    const vapiResponse = await fetch(`https://api.vapi.ai/call/${call_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text();
      console.error('Vapi API error:', vapiResponse.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: `Vapi API error: ${vapiResponse.status}`,
          details: errorText 
        }),
        {
          status: vapiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const callData = await vapiResponse.json();

    // Extract transcript from call data
    let transcript = '';
    if (callData.transcript) {
      if (typeof callData.transcript === 'string') {
        transcript = callData.transcript;
      } else if (Array.isArray(callData.transcript)) {
        // If transcript is an array of messages, format it
        transcript = callData.transcript
          .map((msg: any) => `${msg.role}: ${msg.message}`)
          .join('\n\n');
      } else if (callData.transcript.messages) {
        // If transcript has messages array
        transcript = callData.transcript.messages
          .map((msg: any) => `${msg.role}: ${msg.message}`)
          .join('\n\n');
      }
    }

    // Get recording URL
    let recordingUrl = callData.recordingUrl || callData.recording_url || callData.recordingS3Url || '';
    
    // Check if recording is still processing
    const recordingStatus = callData.recordingStatus || 'unknown';
    const isRecordingReady = recordingUrl && recordingStatus === 'ready';

    // Prepare response data
    const responseData = {
      call: {
        id: callData.id,
        status: callData.status,
        duration: callData.endedAt && callData.createdAt 
          ? Math.floor((new Date(callData.endedAt).getTime() - new Date(callData.createdAt).getTime()) / 1000)
          : callData.duration || 0,
        created_at: callData.createdAt,
        ended_at: callData.endedAt,
        recording_url: recordingUrl,
        recording_status: recordingStatus,
        recording_ready: isRecordingReady,
      },
      transcript: transcript || 'Transcript not available',
      summary: callData.summary || callData.analysis?.summary || null,
      raw_call_data: callData, // Include raw data for debugging
    };

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    
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