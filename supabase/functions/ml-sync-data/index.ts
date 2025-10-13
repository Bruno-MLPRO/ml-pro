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
        
        // Buscar descrição
        let hasDescription = false
        try {
          const descResponse = await fetch(
            `https://api.mercadolibre.com/items/${item.id}/description`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          )
          if (descResponse.ok) {
            const descData = await descResponse.json()
            hasDescription = descData.plain_text && descData.plain_text.length > 50
          }
        } catch (e) {
          console.log('Error fetching description for', item.id)
        }

        // Buscar dados fiscais
        let hasTaxData = false
        try {
          const taxResponse = await fetch(
            `https://api.mercadolibre.com/items/${item.id}/tax_info`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          )
          if (taxResponse.ok) {
            const taxData = await taxResponse.json()
            hasTaxData = !!(taxData.ncm && taxData.origin)
          }
        } catch (e) {
          console.log('Error fetching tax info for', item.id)
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
            logistic_type: item.shipping?.logistic_type,
            has_description: hasDescription,
            has_tax_data: hasTaxData,
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

// Função auxiliar para converter level_id em cor
function getReputationColor(levelId: string | null): string {
  if (!levelId) return 'gray';
  
  // level_id format: "5_green", "4_light_green", "3_yellow", "2_orange", "1_red"
  if (levelId.includes('green') && levelId.startsWith('5')) return 'dark_green';
  if (levelId.includes('green')) return 'light_green';
  if (levelId.includes('yellow')) return 'yellow';
  if (levelId.includes('orange')) return 'orange';
  if (levelId.includes('red')) return 'red';
  return 'gray';
}

async function updateMetrics(account: any, userInfo: any, products: any[], orders: any[], supabase: any) {
  console.log('Updating metrics...');
  
  // Calcular métricas dos últimos 30 dias
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentOrders = orders.filter((order: any) => 
    new Date(order.date_created) >= thirtyDaysAgo &&
    order.status === 'paid'
  );

  const totalSales = recentOrders.length;
  const totalRevenue = recentOrders.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  // Contar anúncios ativos e pausados
  const activeListings = products.filter((p: any) => p.status === 'active').length;
  const pausedListings = products.filter((p: any) => p.status === 'paused').length;

  // Verificar FULL: Só está ativo se há estoque FULL gerenciado recentemente
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
  const { data: fullStockItems } = await supabase
    .from('mercado_livre_full_stock')
    .select('id, available_units')
    .eq('ml_account_id', account.id)
    .gt('available_units', 0)
    .gte('synced_at', thirtyDaysAgoISO);

  const hasFull = fullStockItems && fullStockItems.length > 0;

  // Verificar Decola usando os campos corretos da API
  // Decola é um programa de proteção para vendedores novos onde:
  // - level_id mostra a reputação "protegida" (ex: "5_green")
  // - real_level mostra a reputação real (ex: "red")
  // - protection_end_date indica até quando a proteção é válida
  const sellerReputation = userInfo.seller_reputation || {};
  const hasRealLevel = sellerReputation.real_level !== undefined && sellerReputation.real_level !== null;
  const hasProtectionEndDate = sellerReputation.protection_end_date !== undefined && sellerReputation.protection_end_date !== null;

  // Decola está ativo se existe real_level, protection_end_date e a proteção ainda não expirou
  let hasDecola = false;
  if (hasRealLevel && hasProtectionEndDate) {
    const protectionEndDate = new Date(sellerReputation.protection_end_date);
    const now = new Date();
    hasDecola = protectionEndDate > now; // Proteção ainda ativa
  }

  console.log('Decola detection:', {
    hasRealLevel,
    hasProtectionEndDate,
    protectionEndDate: sellerReputation.protection_end_date,
    hasDecola,
    levelId: sellerReputation.level_id,
    realLevel: sellerReputation.real_level
  });

  const isMercadoLider = userInfo.seller_reputation?.power_seller_status === 'gold' ||
                         userInfo.seller_reputation?.power_seller_status === 'platinum'
  
  let mercadoLiderLevel = null
  if (isMercadoLider) {
    mercadoLiderLevel = userInfo.seller_reputation?.power_seller_status || 'Bronze'
  }

  // Extrair cor da reputação
  const reputationColor = getReputationColor(userInfo.seller_reputation?.level_id);
  
  // Extrair métricas de qualidade
  const metrics = userInfo.seller_reputation?.metrics || {};

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
      
      // Reputação por CORES (sistema do ML)
      reputation_level: userInfo.seller_reputation?.level_id || null,
      reputation_color: reputationColor,
      reputation_score: null,
      reputation_transactions_total: userInfo.seller_reputation?.transactions?.total || 0,
      
      // Porcentagens de avaliações
      positive_ratings_rate: userInfo.seller_reputation?.transactions?.ratings?.positive || 0,
      neutral_ratings_rate: userInfo.seller_reputation?.transactions?.ratings?.neutral || 0,
      negative_ratings_rate: userInfo.seller_reputation?.transactions?.ratings?.negative || 0,
      
      // Métricas de qualidade (últimos 60 dias)
      claims_rate: metrics.claims?.rate || 0,
      claims_value: metrics.claims?.value || 0,
      delayed_handling_rate: metrics.delayed_handling_time?.rate || 0,
      delayed_handling_value: metrics.delayed_handling_time?.value || 0,
      cancellations_rate: metrics.cancellations?.rate || 0,
      cancellations_value: metrics.cancellations?.value || 0,
      
      // Programa Decola
      has_decola: hasDecola,
      real_reputation_level: sellerReputation.real_level || null,
      protection_end_date: sellerReputation.protection_end_date || null,
      
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
    console.log('Metrics updated:', { hasFull, hasDecola, isMercadoLider, reputationColor })
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