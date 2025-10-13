import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log('Webhook received:', payload.topic, payload.resource)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Logar webhook
    const { error: logError } = await supabase
      .from('mercado_livre_webhook_logs')
      .insert({
        topic: payload.topic,
        resource: payload.resource,
        user_id: payload.user_id?.toString(),
        application_id: payload.application_id?.toString(),
        payload: payload,
        processed: false
      })

    if (logError) {
      console.error('Error logging webhook:', logError)
    }

    // Processar em background para responder rápido
    processWebhook(payload, supabase)

    // Responder imediatamente ao ML
    return new Response('OK', {
      status: 200,
      headers: corsHeaders
    })
  } catch (error) {
    console.error('Error in webhook receiver:', error)
    return new Response('OK', {
      status: 200,
      headers: corsHeaders
    })
  }
})

async function processWebhook(payload: any, supabase: any) {
  console.log('Processing webhook:', payload.topic)
  
  try {
    // Buscar conta ML pelo user_id
    const { data: account } = await supabase
      .from('mercado_livre_accounts')
      .select('*')
      .eq('ml_user_id', payload.user_id?.toString())
      .eq('is_active', true)
      .single()

    if (!account) {
      console.log('Account not found for user:', payload.user_id)
      return
    }

    // Verificar se token precisa refresh
    const needsRefresh = new Date(account.token_expires_at) < new Date(Date.now() + 60 * 60 * 1000)
    let accessToken = account.access_token

    if (needsRefresh) {
      console.log('Token needs refresh')
      accessToken = await refreshToken(account, supabase)
    }

    // Processar baseado no topic
    if (payload.topic === 'orders_v2') {
      await processOrderWebhook(payload, account, accessToken, supabase)
    } else if (payload.topic === 'items') {
      await processItemWebhook(payload, account, accessToken, supabase)
    }

    // Marcar webhook como processado
    await supabase
      .from('mercado_livre_webhook_logs')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('resource', payload.resource)
      .eq('topic', payload.topic)

    console.log('Webhook processed successfully')
  } catch (error) {
    console.error('Error processing webhook:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Logar erro
    await supabase
      .from('mercado_livre_webhook_logs')
      .update({ 
        processed: false, 
        error: errorMessage,
        processed_at: new Date().toISOString()
      })
      .eq('resource', payload.resource)
      .eq('topic', payload.topic)
  }
}

async function processOrderWebhook(payload: any, account: any, accessToken: string, supabase: any) {
  // Extrair order_id do resource
  const orderId = payload.resource.split('/').pop()
  console.log('Processing order:', orderId)

  // Buscar detalhes do pedido
  const orderResponse = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })

  if (!orderResponse.ok) {
    console.error('Failed to fetch order details')
    return
  }

  const order = await orderResponse.json()
  
  // Salvar/atualizar pedido
  await supabase
    .from('mercado_livre_orders')
    .upsert({
      ml_account_id: account.id,
      student_id: account.student_id,
      ml_order_id: order.id.toString(),
      status: order.status,
      date_created: order.date_created,
      date_closed: order.date_closed,
      total_amount: order.total_amount,
      paid_amount: order.paid_amount,
      buyer_nickname: order.buyer?.nickname,
      shipping_mode: order.shipping?.shipping_mode
    }, {
      onConflict: 'ml_account_id,ml_order_id'
    })

  console.log('Order saved/updated')

  // Recalcular métricas
  await updateMetrics(account, supabase)

  // Validar milestones
  await validateMilestones(account.student_id, supabase)
}

async function processItemWebhook(payload: any, account: any, accessToken: string, supabase: any) {
  const itemId = payload.resource.split('/').pop()
  console.log('Processing item:', itemId)

  // Buscar detalhes do item
  const itemResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })

  if (!itemResponse.ok) {
    console.error('Failed to fetch item details')
    return
  }

  const item = await itemResponse.json()
  
  // Salvar/atualizar produto
  await supabase
    .from('mercado_livre_products')
    .upsert({
      ml_account_id: account.id,
      student_id: account.student_id,
      ml_item_id: item.id,
      title: item.title,
      price: item.price,
      available_quantity: item.available_quantity,
      sold_quantity: item.sold_quantity,
      status: item.status,
      permalink: item.permalink,
      thumbnail: item.thumbnail,
      listing_type: item.listing_type_id,
      shipping_mode: item.shipping?.mode,
      synced_at: new Date().toISOString()
    }, {
      onConflict: 'ml_account_id,ml_item_id'
    })

  console.log('Item saved/updated')

  // Atualizar contador de listings nas métricas
  await updateMetrics(account, supabase)
}

async function updateMetrics(account: any, supabase: any) {
  console.log('Updating metrics for account:', account.id)

  // Contar vendas dos últimos 30 dias
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  
  const { data: orders } = await supabase
    .from('mercado_livre_orders')
    .select('paid_amount, status')
    .eq('ml_account_id', account.id)
    .eq('status', 'paid')
    .gte('date_created', thirtyDaysAgo.toISOString())

  const totalSales = orders?.length || 0
  const totalRevenue = orders?.reduce((sum: number, o: any) => sum + (parseFloat(o.paid_amount) || 0), 0) || 0
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0

  // Contar produtos
  const { data: products } = await supabase
    .from('mercado_livre_products')
    .select('status')
    .eq('ml_account_id', account.id)

  const activeListings = products?.filter((p: any) => p.status === 'active').length || 0
  const pausedListings = products?.filter((p: any) => p.status === 'paused').length || 0
  const totalListings = products?.length || 0

  // Atualizar métricas
  await supabase
    .from('mercado_livre_metrics')
    .update({
      total_sales: totalSales,
      total_revenue: totalRevenue,
      average_ticket: averageTicket,
      active_listings: activeListings,
      paused_listings: pausedListings,
      total_listings: totalListings,
      last_updated: new Date().toISOString()
    })
    .eq('ml_account_id', account.id)

  console.log('Metrics updated:', { totalSales, totalRevenue, activeListings })
}

async function validateMilestones(studentId: string, supabase: any) {
  console.log('Validating milestones for student:', studentId)

  try {
    // Buscar métricas consolidadas
    const { data: metrics } = await supabase
      .from('mercado_livre_metrics')
      .select('*')
      .eq('student_id', studentId)

    if (!metrics || metrics.length === 0) return

    const totalSales = metrics.reduce((sum: number, m: any) => sum + m.total_sales, 0)
    const hasDecola = metrics.some((m: any) => m.has_decola)
    const hasFull = metrics.some((m: any) => m.has_full)

    // Buscar jornada do aluno
    const { data: journey } = await supabase
      .from('student_journeys')
      .select('id')
      .eq('student_id', studentId)
      .single()

    if (!journey) return

    // Buscar milestones
    const { data: milestones } = await supabase
      .from('milestones')
      .select('*')
      .eq('journey_id', journey.id)
      .neq('status', 'completed')

    // Validar "10 Vendas concluídas"
    const salesMilestone = milestones?.find((m: any) => 
      m.title.toLowerCase().includes('10 vendas') || m.title.toLowerCase().includes('10 vendas')
    )
    
    if (salesMilestone && totalSales >= 10) {
      await supabase
        .from('milestones')
        .update({
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          notes: `✅ Validado automaticamente via Mercado Livre: ${totalSales} vendas concluídas`
        })
        .eq('id', salesMilestone.id)
      
      console.log('Milestone validated: 10 Vendas')
    }

    // Validar "Ativar Decola"
    const decolaMilestone = milestones?.find((m: any) => 
      m.title.toLowerCase().includes('decola')
    )
    
    if (decolaMilestone && hasDecola) {
      await supabase
        .from('milestones')
        .update({
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          notes: `✅ Validado automaticamente: Decola ativo no Mercado Livre`
        })
        .eq('id', decolaMilestone.id)
      
      console.log('Milestone validated: Decola')
    }

    // Validar "FULL Liberado"
    const fullMilestone = milestones?.find((m: any) => 
      m.title.toLowerCase().includes('full')
    )
    
    if (fullMilestone && hasFull) {
      await supabase
        .from('milestones')
        .update({
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          notes: `✅ Validado automaticamente: FULL ativo no Mercado Livre`
        })
        .eq('id', fullMilestone.id)
      
      console.log('Milestone validated: FULL')
    }
  } catch (error) {
    console.error('Error validating milestones:', error)
  }
}

async function refreshToken(account: any, supabase: any): Promise<string> {
  console.log('Refreshing token for account:', account.id)
  
  const appId = Deno.env.get('MERCADO_LIVRE_APP_ID')!
  const secretKey = Deno.env.get('MERCADO_LIVRE_SECRET_KEY')!

  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: appId,
      client_secret: secretKey,
      refresh_token: account.refresh_token
    })
  })

  if (!response.ok) {
    throw new Error('Failed to refresh token')
  }

  const tokens = await response.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await supabase
    .from('mercado_livre_accounts')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt
    })
    .eq('id', account.id)

  console.log('Token refreshed successfully')
  return tokens.access_token
}