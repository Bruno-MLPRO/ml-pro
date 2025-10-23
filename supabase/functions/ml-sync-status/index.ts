import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { log_id } = await req.json();

    if (!log_id) {
      return new Response(
        JSON.stringify({ error: 'log_id is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Fetch log entry
    const { data: logEntry, error } = await supabaseAdmin
      .from('ml_auto_sync_logs')
      .select('*')
      .eq('id', log_id)
      .single();

    if (error) {
      throw error;
    }

    if (!logEntry) {
      return new Response(
        JSON.stringify({ error: 'Log entry not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    // Determine status
    const isComplete = !!logEntry.finished_at;
    const status = isComplete ? 'completed' : 'processing';

    return new Response(
      JSON.stringify({
        success: true,
        status,
        log_id: logEntry.id,
        started_at: logEntry.started_at,
        finished_at: logEntry.finished_at,
        total_accounts: logEntry.total_accounts || 0,
        successful_syncs: logEntry.successful_syncs || 0,
        failed_syncs: logEntry.failed_syncs || 0,
        tokens_renewed: logEntry.tokens_renewed || 0,
        error_details: logEntry.error_details,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in ml-sync-status:', error);

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
