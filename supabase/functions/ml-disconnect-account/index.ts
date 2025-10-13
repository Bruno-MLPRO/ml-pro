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
    const { ml_account_id } = await req.json()

    if (!ml_account_id) {
      throw new Error('Missing ml_account_id parameter')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    // Buscar conta e verificar ownership
    const { data: account, error: accountError } = await supabase
      .from('mercado_livre_accounts')
      .select('*, mercado_livre_webhooks(*)')
      .eq('id', ml_account_id)
      .eq('student_id', user.id)
      .single()

    if (accountError || !account) {
      throw new Error('Account not found or unauthorized')
    }

    console.log('Disconnecting account:', account.id)

    // Remover webhooks do Mercado Livre
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey)
    
    for (const webhook of account.mercado_livre_webhooks || []) {
      try {
        const deleteResponse = await fetch(
          `https://api.mercadolibre.com/users/${account.ml_user_id}/webhooks/${webhook.webhook_id}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${account.access_token}` }
          }
        )

        if (deleteResponse.ok) {
          console.log('Webhook deleted:', webhook.webhook_id)
        }
      } catch (error) {
        console.error('Error deleting webhook:', error)
      }
    }

    // Desativar conta (manter dados históricos)
    await adminSupabase
      .from('mercado_livre_accounts')
      .update({ is_active: false })
      .eq('id', account.id)

    console.log('Account disconnected successfully')

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in ml-disconnect-account:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})