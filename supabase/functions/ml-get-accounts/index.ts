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

    // Buscar contas ML do usuário (sem JOIN para evitar problemas com RLS)
    const { data: accounts, error } = await supabase
      .from('mercado_livre_accounts')
      .select('*')
      .eq('student_id', user.id)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })

    if (error) {
      throw error
    }

    // Buscar métricas para cada conta separadamente (respeitando RLS)
    const formattedAccounts = await Promise.all(
      (accounts || []).map(async (account) => {
        // Buscar métricas da conta
        const { data: metrics } = await supabase
          .from('mercado_livre_metrics')
          .select('*')
          .eq('ml_account_id', account.id)
          .maybeSingle()

        return {
          id: account.id,
          ml_nickname: account.ml_nickname || 'Conta sem nome',
          ml_user_id: account.ml_user_id || parseInt(account.ml_user_id?.toString() || '0', 10),
          is_primary: account.is_primary || false,
          is_active: account.is_active ?? true,
          connected_at: account.connected_at || account.created_at,
          last_sync_at: account.last_sync_at,
          site_id: account.site_id || 'MLB',
          metrics: metrics
        }
      })
    )

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