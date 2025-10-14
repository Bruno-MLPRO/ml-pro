const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const appId = Deno.env.get('MERCADO_LIVRE_APP_ID')
    const secretKey = Deno.env.get('MERCADO_LIVRE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    
    const results = {
      app_id_configured: !!appId && appId !== 'undefined',
      secret_key_configured: !!secretKey && secretKey !== 'undefined',
      callback_url: `${supabaseUrl}/functions/v1/ml-oauth-callback`,
      app_id_preview: appId ? appId.substring(0, 8) + '...' : 'NOT CONFIGURED'
    }

    console.log('ML Connection Test:', results)

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in ml-test-connection:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
