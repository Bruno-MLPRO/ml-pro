import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const appUrl = Deno.env.get('APP_URL') || 'https://ml-pro.lovable.app'

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

    console.log('=== ML OAuth Callback Started ===')
    console.log('Code received:', code ? 'YES' : 'NO')
    console.log('State received:', state ? 'YES' : 'NO')
    console.log('Callback URL:', callbackUrl)
    console.log('APP_ID configured:', appId ? 'YES' : 'NO')
    console.log('SECRET_KEY configured:', secretKey ? 'YES' : 'NO')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Trocar código por tokens
    console.log('Exchanging code for tokens...')
    
    console.log('Token request params:', {
      grant_type: 'authorization_code',
      client_id: appId,
      redirect_uri: callbackUrl,
      code_length: code.length
    })
    
    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
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
      console.error('=== Token Exchange Failed ===')
      console.error('Status:', tokenResponse.status)
      console.error('Error:', errorText)
      
      let mlError = 'Failed to exchange code for tokens'
      try {
        const errorJson = JSON.parse(errorText)
        mlError = errorJson.message || errorJson.error || mlError
      } catch {}
      
      throw new Error(`ML API Error: ${mlError} (Status: ${tokenResponse.status})`)
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

    // Verificar se este state já foi processado (prevenir duplicatas)
    const { data: stateCheck } = await supabase
      .from('mercado_livre_accounts')
      .select('id')
      .eq('ml_user_id', stateId)
      .maybeSingle()
    
    if (!stateCheck) {
      console.log('State already processed, preventing duplicate')
      const dashboardUrl = `${appUrl}/aluno/dashboard?ml_already_processed=true`
      return new Response(null, {
        status: 302,
        headers: {
          'Location': dashboardUrl,
          ...corsHeaders
        }
      })
    }
    
    // Deletar entrada temporária após verificação
    await supabase
      .from('mercado_livre_accounts')
      .delete()
      .eq('ml_user_id', stateId)

    // Calcular expiração do token
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Verificar se conta já existe
    const { data: existingAccount } = await supabase
      .from('mercado_livre_accounts')
      .select('id')
      .eq('student_id', userId)
      .eq('ml_user_id', mlUser.id.toString())
      .single()

    let account;
    if (existingAccount) {
      // Atualizar conta existente
      console.log('Updating existing account:', existingAccount.id)
      const { data: updatedAccount, error: updateError } = await supabase
        .from('mercado_livre_accounts')
        .update({
          ml_nickname: mlUser.nickname,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          is_active: true,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAccount.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating account:', updateError)
        throw new Error('Erro ao atualizar conta do Mercado Livre. Por favor, tente novamente.')
      }
      account = updatedAccount
    } else {
      // Inserir nova conta
      console.log('Creating new account')
      const { data: newAccount, error: insertError } = await supabase
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
        throw new Error('Erro ao conectar conta do Mercado Livre. Por favor, tente novamente.')
      }
      account = newAccount
    }

    console.log('Account saved:', account.id)

    // Configurar webhooks em background
    setupWebhooks(mlUser.id, tokens.access_token, account.id, supabase)

    // Iniciar sincronização inicial em background (só para contas novas)
    if (!existingAccount) {
      initialSync(account.id, mlUser.id.toString(), tokens.access_token, userId, supabase)
    } else {
      console.log('Account reconnected, updating metrics only')
    }

    // Redirecionar para o dashboard com informações adicionais
    const dashboardUrl = `${appUrl}/aluno/dashboard?ml_connected=true&nickname=${encodeURIComponent(mlUser.nickname)}&timestamp=${Date.now()}`
    
    console.log('Redirecting to:', dashboardUrl)
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': dashboardUrl,
        ...corsHeaders
      }
    })
  } catch (error) {
    console.error('Error in ml-oauth-callback:', error)
    
    let errorMessage = 'Erro desconhecido ao conectar conta do Mercado Livre'
    
  if (error instanceof Error) {
    // Tratar erros específicos
    if (error.message.includes('requested path is invalid')) {
      errorMessage = 'URL de callback não autorizada no Mercado Livre. Verifique as configurações do app.'
    } else if (error.message.includes('duplicate key')) {
      errorMessage = 'Esta conta do Mercado Livre já está conectada. Tente desconectar primeiro.'
    } else if (error.message.includes('Failed to exchange code') || error.message.includes('ML API Error')) {
      errorMessage = 'Credenciais do Mercado Livre inválidas. Verifique APP_ID e SECRET_KEY.'
    } else if (error.message.includes('Failed to fetch user info')) {
      errorMessage = 'Não foi possível obter informações da conta do Mercado Livre.'
    } else {
      errorMessage = error.message
    }
  }
    
    const errorUrl = `${appUrl}/aluno/dashboard?ml_error=${encodeURIComponent(errorMessage)}`
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