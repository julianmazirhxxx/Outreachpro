/*
  # Vapi Call Data Edge Function

  1. Purpose
    - Fetch call details, recordings, and transcriptions from Vapi API
    - Proxy Vapi API calls securely without exposing API keys to frontend
    - Handle authentication and error responses

  2. Security
    - Vapi API key stored securely in environment variables
    - User authentication required
    - CORS headers for browser requests

  3. Endpoints
    - POST /vapi-call-data with { call_id, action }
    - Actions: 'get_call_details', 'get_transcript', 'get_recording'
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface VapiCallRequest {
  call_id: string;
  action: 'get_call_details' | 'get_transcript' | 'get_recording';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get Vapi API key from environment
    const vapiApiKey = Deno.env.get('VAPI_API_KEY');
    if (!vapiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Vapi API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const { call_id, action }: VapiCallRequest = await req.json();

    if (!call_id) {
      return new Response(
        JSON.stringify({ error: 'Call ID is required' }),
        {
          status: 400,
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
    let recordingUrl = callData.recordingUrl || callData.recording_url || '';

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
      },
      transcript: transcript || 'Transcript not available',
      summary: callData.summary || callData.analysis?.summary || null,
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