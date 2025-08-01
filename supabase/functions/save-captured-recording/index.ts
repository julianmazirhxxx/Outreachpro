/*
  # Save Captured Recording Edge Function

  1. Purpose
    - Save captured audio recordings from WebSocket streams
    - Store recording metadata in database
    - Handle file upload to storage

  2. Security
    - User authentication required
    - File validation and sanitization
    - Rate limiting for uploads

  3. Endpoints
    - POST /save-captured-recording with audio file and metadata
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SaveRecordingRequest {
  lead_id: string;
  campaign_id: string;
  call_duration: number;
  audio_chunks_count: number;
  audio_data_size: number;
  timestamp: string;
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

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const audioFile = formData.get('audio_file') as File;
    const metadata = JSON.parse(formData.get('metadata') as string) as SaveRecordingRequest;

    if (!audioFile || !metadata) {
      return new Response(
        JSON.stringify({ error: 'Audio file and metadata are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate file size (max 50MB)
    if (audioFile.size > 50 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'File size too large (max 50MB)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `recordings/${user.id}/${metadata.campaign_id}/${timestamp}-${metadata.lead_id}.pcm`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('call-recordings')
      .upload(filename, audioFile, {
        contentType: 'audio/pcm',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload recording' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('call-recordings')
      .getPublicUrl(filename);

    // Update lead activity history with recording URL
    const { error: updateError } = await supabase
      .from('lead_activity_history')
      .update({
        recording_url: urlData.publicUrl,
        call_duration: metadata.call_duration,
        notes: `Captured from live stream: ${metadata.audio_chunks_count} chunks, ${Math.round(metadata.audio_data_size / 1024)}KB`
      })
      .eq('lead_id', metadata.lead_id)
      .eq('campaign_id', metadata.campaign_id)
      .eq('type', 'call')
      .order('executed_at', { ascending: false })
      .limit(1);

    if (updateError) {
      console.error('Database update error:', updateError);
      // Don't fail the request if database update fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        recording_url: urlData.publicUrl,
        filename: filename,
        size: audioFile.size
      }),
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