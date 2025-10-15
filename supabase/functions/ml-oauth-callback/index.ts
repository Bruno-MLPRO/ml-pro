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
    console.log('=== ML User Info ===')
    console.log('ML User ID:', mlUser.id)
    console.log('ML Nickname:', mlUser.nickname)
    console.log('Student ID:', userId)

    // Calcular expiração do token
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    console.log('Token expires at:', expiresAt)

    // Verificar se conta já existe
    console.log('Checking for existing account...')
    const { data: existingAccount, error: checkError } = await supabase
      .from('mercado_livre_accounts')
      .select('id, ml_nickname')
      .eq('student_id', userId)
      .eq('ml_user_id', mlUser.id.toString())
      .maybeSingle()
    
    if (checkError) {
      console.error('Error checking existing account:', checkError)
    } else if (existingAccount) {
      console.log('Found existing account:', existingAccount.id)
    } else {
      console.log('No existing account found, will create new one')
    }

    let account;
    let isNewAccount = false;
    
    if (existingAccount) {
      // Atualizar conta existente
      console.log('=== Updating Existing Account ===')
      console.log('Account ID:', existingAccount.id)
      
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
        console.error('=== Update Error ===')
        console.error('Error details:', updateError)
        
        // Log to webhook logs for audit
        await supabase
          .from('mercado_livre_webhook_logs')
          .insert({
            topic: 'oauth_callback',
            payload: { error: updateError, ml_user_id: mlUser.id, student_id: userId },
            error: `Failed to update account: ${updateError.message}`,
            processed: false
          })
        
        throw new Error('Erro ao atualizar conta do Mercado Livre. Por favor, tente novamente.')
      }
      
      console.log('Account updated successfully')
      account = updatedAccount
    } else {
      // Inserir nova conta
      console.log('=== Creating New Account ===')
      console.log('Student ID:', userId)
      console.log('ML User ID:', mlUser.id)
      
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
        console.error('=== Insert Error ===')
        console.error('Error details:', insertError)
        
        // Log to webhook logs for audit
        await supabase
          .from('mercado_livre_webhook_logs')
          .insert({
            topic: 'oauth_callback',
            payload: { error: insertError, ml_user_id: mlUser.id, student_id: userId },
            error: `Failed to insert account: ${insertError.message}`,
            processed: false
          })
        
        throw new Error('Erro ao conectar conta do Mercado Livre. Por favor, tente novamente.')
      }
      
      console.log('New account created successfully')
      account = newAccount
      isNewAccount = true
    }

    console.log('=== Account Saved Successfully ===')
    console.log('Account ID:', account.id)
    console.log('Is New Account:', isNewAccount)

    // Configurar webhooks em background
    console.log('Starting webhook setup...')
    setupWebhooks(mlUser.id, tokens.access_token, account.id, supabase)

    // Iniciar sincronização inicial em background (só para contas novas)
    if (isNewAccount) {
      console.log('Starting initial sync for new account...')
      initialSync(account.id, mlUser.id.toString(), tokens.access_token, userId, supabase)
    } else {
      console.log('Account reconnected, skipping initial sync')
    }

    // Redirecionar para o dashboard com informações adicionais
    const dashboardUrl = `${appUrl}/aluno/dashboard?ml_connected=true&nickname=${encodeURIComponent(mlUser.nickname)}&is_new=${isNewAccount}&timestamp=${Date.now()}`
    
    console.log('=== Redirect Info ===')
    console.log('Dashboard URL:', dashboardUrl)
    console.log('Connection successful!')
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': dashboardUrl,
        ...corsHeaders
      }
    })
  } catch (error) {
    console.error('=== FATAL ERROR in ml-oauth-callback ===')
    console.error('Error:', error)
    
    let errorMessage = 'Erro desconhecido ao conectar conta do Mercado Livre'
    let errorDetails = {};
    
    if (error instanceof Error) {
      errorDetails = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
      
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
    
    // Log error to database for audit
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      await supabase
        .from('mercado_livre_webhook_logs')
        .insert({
          topic: 'oauth_callback_error',
          payload: errorDetails,
          error: errorMessage,
          processed: false
        })
    } catch (logError) {
      console.error('Failed to log error to database:', logError)
    }
    
    const errorUrl = `${appUrl}/aluno/dashboard?ml_error=${encodeURIComponent(errorMessage)}`
    console.log('Redirecting to error URL:', errorUrl)
    
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