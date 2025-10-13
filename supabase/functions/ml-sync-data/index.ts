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
    // Use SERVICE_ROLE_KEY to bypass RLS for backend operations
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Validate that request comes from authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Create client with SERVICE_ROLE_KEY (without authHeader to bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar conta
    const { data: account, error: accountError } = await supabase
      .from('mercado_livre_accounts')
      .select('*')
      .eq('id', ml_account_id)
      .single()

    if (accountError || !account) {
      throw new Error('Account not found')
    }

    // Verificar se token precisa refresh
    const needsRefresh = new Date(account.token_expires_at) < new Date(Date.now() + 60 * 60 * 1000)
    let accessToken = account.access_token

    if (needsRefresh) {
      console.log('Token needs refresh')
      accessToken = await refreshToken(account, supabase)
    }

    console.log('Starting data sync for account:', account.id)

    // Sincronizar em paralelo
    const [userInfo, products, orders] = await Promise.all([
      syncUserInfo(account, accessToken),
      syncProducts(account, accessToken, supabase),
      syncOrders(account, accessToken, supabase)
    ])

    // Atualizar métricas
    await updateMetrics(account, userInfo, products, orders, supabase)

    // Validar milestones
    await validateMilestones(account.student_id, supabase)

    // Atualizar last_sync_at
    await supabase
      .from('mercado_livre_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', account.id)

    return new Response(
      JSON.stringify({
        success: true,
        products_synced: products.length,
        orders_synced: orders.length,
        metrics_updated: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in ml-sync-data:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function syncUserInfo(account: any, accessToken: string) {
  console.log('Syncing user info...')
  
  const response = await fetch('https://api.mercadolibre.com/users/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch user info')
  }

  return await response.json()
}

async function syncProducts(account: any, accessToken: string, supabase: any) {
  console.log('Syncing products...')
  
  const products: any[] = []
  let offset = 0
  let hasMore = true
  const limit = 50
  
  while (hasMore) {
    const activeResponse = await fetch(
      `https://api.mercadolibre.com/users/${account.ml_user_id}/items/search?status=active&limit=${limit}&offset=${offset}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )

    if (!activeResponse.ok) {
      console.error('Failed to fetch items')
      break
    }

    const activeData = await activeResponse.json()
    
    for (const itemId of activeData.results || []) {
      const itemResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      
      if (itemResponse.ok) {
        const item = await itemResponse.json()
        
        // Analisar qualidade das fotos
        let minDimension = 9999
        let hasLowQualityPhotos = false
        const photoCount = item.pictures?.length || 0
        
        if (item.pictures && item.pictures.length > 0) {
          for (const picture of item.pictures) {
            const sizeMatch = picture.max_size?.match(/(\d+)x(\d+)/)
            if (sizeMatch) {
              const width = parseInt(sizeMatch[1])
              const height = parseInt(sizeMatch[2])
              const smallestDimension = Math.min(width, height)
              minDimension = Math.min(minDimension, smallestDimension)
              
              if (smallestDimension < 1200) {
                hasLowQualityPhotos = true
              }
            }
          }
        }
        
        const { error } = await supabase
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
            has_low_quality_photos: hasLowQualityPhotos,
            min_photo_dimension: minDimension === 9999 ? null : minDimension,
            photo_count: photoCount,
            synced_at: new Date().toISOString()
          }, {
            onConflict: 'ml_account_id,ml_item_id'
          })
        
        if (error) {
          console.error(`Error syncing product ${item.id}:`, error)
        } else {
          products.push(item)
          
          if (item.shipping?.mode === 'me2' && item.inventory_id) {
            await syncFullStock(account, item, accessToken, supabase)
          }
        }
      }
    }
    
    hasMore = activeData.paging && activeData.paging.total > (offset + limit)
    offset += limit
    
    console.log(`Synced batch: ${activeData.results?.length || 0} products, total so far: ${products.length}`)
    
    // Proteção: máximo 500 produtos
    if (offset >= 500) break
  }

  console.log(`Synced ${products.length} total products`)
  return products
}

async function syncOrders(account: any, accessToken: string, supabase: any) {
  console.log('Syncing orders...')
  
  const orders: any[] = []
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  
  let offset = 0
  let hasMore = true
  const limit = 50
  
  // Paginar pedidos
  while (hasMore) {
    const response = await fetch(
      `https://api.mercadolibre.com/orders/search?seller=${account.ml_user_id}&order.date_created.from=${thirtyDaysAgo}&limit=${limit}&offset=${offset}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )

    if (!response.ok) {
      console.error('Failed to fetch orders')
      break
    }

    const data = await response.json()
    
    for (const order of data.results || []) {
      // Salvar pedido
      const { error } = await supabase
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
      
      if (error) {
        console.error(`Error syncing order ${order.id}:`, error)
      } else {
        orders.push(order)
      }
    }
    
    hasMore = data.paging && data.paging.total > (offset + limit)
    offset += limit
    
    console.log(`Synced batch: ${data.results?.length || 0} orders, total so far: ${orders.length}`)
    
    // Proteção: máximo 1000 pedidos
    if (offset >= 1000) break
  }

  console.log(`Synced ${orders.length} total orders`)
  return orders
}

async function updateMetrics(account: any, userInfo: any, products: any[], orders: any[], supabase: any) {
  console.log('Updating metrics...')

  const paidOrders = orders.filter(o => o.status === 'paid')
  const totalSales = paidOrders.length
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0)
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0

  const activeListings = products.filter(p => p.status === 'active').length
  const pausedListings = products.filter(p => p.status === 'paused').length

  // Detectar FULL: produtos com shipping mode 'me2' (Fulfillment)
  const hasFull = products.some(p => p.shipping?.mode === 'me2')
  
  // Detectar Decola: programa para sellers com menos de 10 vendas
  // Indicado por tags específicas ou reputação verde-claro com poucas vendas
  const hasDecola = userInfo.tags?.includes('decola') || 
                    (totalSales < 10 && userInfo.seller_reputation?.level_id === 'green')
  
  // Detectar Mercado Lider
  const isMercadoLider = userInfo.tags?.includes('mercado_lider') || 
                         userInfo.tags?.includes('mercadolider') ||
                         userInfo.seller_reputation?.power_seller_status === 'platinum'
  
  let mercadoLiderLevel = null
  if (isMercadoLider) {
    mercadoLiderLevel = userInfo.seller_reputation?.power_seller_status || 'Bronze'
  }

  const { error } = await supabase
    .from('mercado_livre_metrics')
    .upsert({
      ml_account_id: account.id,
      student_id: account.student_id,
      total_sales: totalSales,
      total_revenue: totalRevenue,
      average_ticket: averageTicket,
      active_listings: activeListings,
      paused_listings: pausedListings,
      total_listings: products.length,
      reputation_level: userInfo.seller_reputation?.level_id || null,
      reputation_score: userInfo.seller_reputation?.transactions?.ratings?.positive 
        ? userInfo.seller_reputation.transactions.ratings.positive * 5 
        : 0,
      reputation_transactions_total: userInfo.seller_reputation?.transactions?.total || 0,
      has_decola: hasDecola,
      has_full: hasFull,
      is_mercado_lider: isMercadoLider,
      mercado_lider_level: mercadoLiderLevel,
      period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      period_end: new Date().toISOString().split('T')[0],
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'ml_account_id'
    })

  if (error) {
    console.error('Error updating metrics:', error)
  } else {
    console.log('Metrics updated:', { hasFull, hasDecola, isMercadoLider })
  }
}

async function validateMilestones(studentId: string, supabase: any) {
  console.log('Validating milestones...')
  
  // Implementação similar ao webhook-receiver
  const { data: metrics } = await supabase
    .from('mercado_livre_metrics')
    .select('*')
    .eq('student_id', studentId)

  if (!metrics || metrics.length === 0) return

  const totalSales = metrics.reduce((sum: number, m: any) => sum + m.total_sales, 0)

  const { data: journey } = await supabase
    .from('student_journeys')
    .select('id')
    .eq('student_id', studentId)
    .single()

  if (!journey) return

  const { data: milestones } = await supabase
    .from('milestones')
    .select('*')
    .eq('journey_id', journey.id)
    .neq('status', 'completed')

  const salesMilestone = milestones?.find((m: any) => 
    m.title.toLowerCase().includes('10 vendas')
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
}

async function syncFullStock(account: any, item: any, accessToken: string, supabase: any) {
  try {
    const inventoryId = item.inventory_id
    if (!inventoryId) return

    const response = await fetch(
      `https://api.mercadolibre.com/inventories/${inventoryId}/stock/fulfillment`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )

    if (!response.ok) {
      console.error(`Failed to fetch FULL stock for ${inventoryId}`)
      return
    }

    const stockData = await response.json()
    
    // Calcular totais
    const availableUnits = stockData.available_quantity || 0
    const reservedUnits = stockData.reserved_quantity || 0
    const damagedUnits = stockData.unavailable_quantity?.damaged || 0
    const lostUnits = stockData.unavailable_quantity?.lost || 0
    
    // Determinar status
    let stockStatus = 'good_quality'
    if (availableUnits === 0) {
      stockStatus = 'out_of_stock'
    } else if (damagedUnits + lostUnits > availableUnits * 0.1) {
      stockStatus = 'low_quality'
    }

    const { error } = await supabase
      .from('mercado_livre_full_stock')
      .upsert({
        ml_account_id: account.id,
        student_id: account.student_id,
        inventory_id: inventoryId,
        ml_item_id: item.id,
        available_units: availableUnits,
        reserved_units: reservedUnits,
        inbound_units: stockData.inbound_quantity || 0,
        damaged_units: damagedUnits,
        lost_units: lostUnits,
        stock_status: stockStatus,
        synced_at: new Date().toISOString()
      }, {
        onConflict: 'ml_account_id,inventory_id'
      })

    if (error) {
      console.error(`Error syncing FULL stock for ${inventoryId}:`, error)
    } else {
      console.log(`Synced FULL stock for ${inventoryId}`)
    }
  } catch (error) {
    console.error('Error in syncFullStock:', error)
  }
}

async function refreshToken(account: any, supabase: any): Promise<string> {
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

  const { error } = await supabase
    .from('mercado_livre_accounts')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt
    })
    .eq('id', account.id)

  if (error) {
    console.error('Error updating tokens:', error)
    throw new Error('Failed to update access tokens')
  }

  return tokens.access_token
}