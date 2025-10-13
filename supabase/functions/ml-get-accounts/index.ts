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

    // Buscar contas ML do usuário
    const { data: accounts, error } = await supabase
      .from('mercado_livre_accounts')
      .select(`
        *,
        mercado_livre_metrics (*)
      `)
      .eq('student_id', user.id)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })

    if (error) {
      throw error
    }

    // Formatar resposta
    const formattedAccounts = accounts?.map(account => ({
      id: account.id,
      ml_nickname: account.ml_nickname,
      is_primary: account.is_primary,
      is_active: account.is_active,
      connected_at: account.connected_at,
      last_sync_at: account.last_sync_at,
      metrics: account.mercado_livre_metrics?.[0] || null
    })) || []

    return new Response(
      JSON.stringify({ accounts: formattedAccounts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in ml-get-accounts:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})