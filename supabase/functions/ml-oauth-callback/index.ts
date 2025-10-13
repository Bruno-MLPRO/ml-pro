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
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!code || !state) {
      throw new Error('Missing code or state parameter')
    }

    const [stateId, userId] = state.split(':')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const appId = Deno.env.get('MERCADO_LIVRE_APP_ID')!
    const secretKey = Deno.env.get('MERCADO_LIVRE_SECRET_KEY')!
    const callbackUrl = `${supabaseUrl}/functions/v1/ml-oauth-callback`

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Trocar código por tokens
    console.log('Exchanging code for tokens...')
    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: appId,
        client_secret: secretKey,
        code: code,
        redirect_uri: callbackUrl
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      throw new Error('Failed to exchange code for tokens')
    }

    const tokens = await tokenResponse.json()
    console.log('Tokens obtained successfully')

    // Buscar informações do usuário ML
    const userResponse = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    })

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info')
    }

    const mlUser = await userResponse.json()
    console.log('ML user info:', mlUser.id, mlUser.nickname)

    // Deletar entrada temporária
    await supabase
      .from('mercado_livre_accounts')
      .delete()
      .eq('ml_user_id', stateId)

    // Calcular expiração do token
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Salvar conta no banco
    const { data: account, error: insertError } = await supabase
      .from('mercado_livre_accounts')
      .insert({
        student_id: userId,
        ml_user_id: mlUser.id.toString(),
        ml_nickname: mlUser.nickname,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        is_primary: false,
        is_active: true
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting account:', insertError)
      throw insertError
    }

    console.log('Account saved:', account.id)

    // Configurar webhooks em background
    setupWebhooks(mlUser.id, tokens.access_token, account.id, supabase)

    // Iniciar sincronização inicial em background
    initialSync(account.id, mlUser.id.toString(), tokens.access_token, userId, supabase)

    // Redirecionar para o dashboard
    const dashboardUrl = `${url.origin}/aluno/dashboard?ml_connected=true`
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': dashboardUrl,
        ...corsHeaders
      }
    })
  } catch (error) {
    console.error('Error in ml-oauth-callback:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    const errorUrl = `${new URL(req.url).origin}/aluno/dashboard?ml_error=${encodeURIComponent(errorMessage)}`
    return new Response(null, {
      status: 302,
      headers: {
        'Location': errorUrl,
        ...corsHeaders
      }
    })
  }
})

async function setupWebhooks(mlUserId: string, accessToken: string, mlAccountId: string, supabase: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const webhookUrl = `${supabaseUrl}/functions/v1/ml-webhook-receiver`
  const topics = ['orders_v2', 'items']

  console.log('Setting up webhooks for user:', mlUserId)

  for (const topic of topics) {
    try {
      const response = await fetch(
        `https://api.mercadolibre.com/users/${mlUserId}/webhooks`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            topic: topic,
            url: webhookUrl
          })
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to create webhook for ${topic}:`, errorText)
        continue
      }

      const webhook = await response.json()
      console.log(`Webhook created for ${topic}:`, webhook.id)

      // Salvar webhook no banco
      await supabase
        .from('mercado_livre_webhooks')
        .insert({
          ml_account_id: mlAccountId,
          webhook_id: webhook.id.toString(),
          topic: topic,
          is_active: true
        })
    } catch (error) {
      console.error(`Error setting up webhook for ${topic}:`, error)
    }
  }
}

async function initialSync(accountId: string, mlUserId: string, accessToken: string, studentId: string, supabase: any) {
  console.log('Starting initial sync for account:', accountId)
  
  try {
    // Buscar dados do usuário para reputação
    const userResponse = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    
    if (userResponse.ok) {
      const userData = await userResponse.json()
      
      // Criar registro de métricas inicial
      await supabase
        .from('mercado_livre_metrics')
        .insert({
          ml_account_id: accountId,
          student_id: studentId,
          total_sales: 0,
          total_revenue: 0,
          average_ticket: 0,
          active_listings: 0,
          paused_listings: 0,
          total_listings: 0,
          reputation_level: userData.seller_reputation?.level_id || null,
          reputation_score: userData.seller_reputation?.transactions?.ratings?.positive || 0,
          reputation_transactions_total: userData.seller_reputation?.transactions?.total || 0,
          has_decola: false,
          has_full: false,
          is_mercado_lider: userData.seller_reputation?.power_seller_status === 'platinum',
          mercado_lider_level: userData.seller_reputation?.power_seller_status || null,
          period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          period_end: new Date().toISOString().split('T')[0]
        })
      
      console.log('Initial metrics created')
      
      // Chamar ml-sync-data para buscar produtos e pedidos reais
      console.log('Triggering full data sync...')
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      
      const syncResponse = await fetch(
        `${supabaseUrl}/functions/v1/ml-sync-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ ml_account_id: accountId }),
        }
      )

      if (!syncResponse.ok) {
        const errorText = await syncResponse.text()
        console.error('Failed to trigger sync:', errorText)
      } else {
        console.log('Full sync triggered successfully')
      }
    }
  } catch (error) {
    console.error('Error in initial sync:', error)
  }
}