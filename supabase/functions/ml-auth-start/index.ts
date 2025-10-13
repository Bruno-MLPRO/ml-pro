import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const appId = Deno.env.get('MERCADO_LIVRE_APP_ID')!
    const callbackUrl = `${supabaseUrl}/functions/v1/ml-oauth-callback`

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Gerar state único para CSRF protection
    const state = crypto.randomUUID()

    // Salvar state temporariamente (expira em 5 minutos)
    const { error: stateError } = await supabase
      .from('mercado_livre_accounts')
      .insert({
        student_id: user.id,
        ml_user_id: state, // Temporário, será atualizado no callback
        ml_nickname: 'pending',
        access_token: state,
        refresh_token: state,
        token_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        is_active: false
      })

    if (stateError) {
      console.error('Error saving state:', stateError)
    }

    // Construir URL de autorização do Mercado Livre
    const authUrl = new URL('https://auth.mercadolivre.com.br/authorization')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', appId)
    authUrl.searchParams.set('redirect_uri', callbackUrl)
    authUrl.searchParams.set('state', `${state}:${user.id}`)

    console.log('Generated auth URL for user:', user.id)

    return new Response(
      JSON.stringify({ authorization_url: authUrl.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in ml-auth-start:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})