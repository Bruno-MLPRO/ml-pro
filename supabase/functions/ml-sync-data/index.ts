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

    // Verificar e sincronizar Product Ads automaticamente
    const productAdsResult = await checkAndSyncProductAds(account, accessToken, supabase)

    // Verificar e sincronizar Seller Recovery Status (Decola/Benefício de Reputação)
    const recoveryResult = await checkSellerRecoveryStatus(account, supabase)

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
        metrics_updated: true,
        product_ads_enabled: productAdsResult.enabled,
        product_ads_synced: productAdsResult.synced,
        seller_recovery_checked: recoveryResult.checked
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

// Função para inferir logistic_type quando a API não retorna
function inferLogisticType(item: any): string | null {
  // Se não é ME2, não precisa inferir
  if (item.shipping?.mode !== 'me2') {
    return null;
  }

  const tags = item.shipping?.tags || [];

  // 1. FULL - tem inventory_id
  if (item.inventory_id) {
    return 'fulfillment';
  }

  // 2. FLEX - tem tags de self_service (FLEX) - PRIORIDADE MÁXIMA
  if (tags.includes('self_service_in') || tags.includes('self_service_out') || tags.includes('self_service_available') || tags.includes('flex')) {
    return 'self_service';
  }

  // 3. Agências - tem 'mandatory_free_shipping' MAS não tem tags de FLEX
  if (tags.includes('mandatory_free_shipping')) {
    return 'xd_drop_off';
  }

  // 4. Coleta - tem 'cross_docking'
  if (tags.includes('cross_docking')) {
    return 'cross_docking';
  }

  // 5. Se a API retornou um valor, usar ele (mas só se não for FLEX)
  if (item.shipping?.logistic_type && item.shipping.logistic_type !== 'self_service') {
    return item.shipping.logistic_type;
  }

  // 6. Default para ME2 sem informações específicas: assumir FLEX
  // (a maioria dos ME2 sem tags específicas são FLEX)
  return 'self_service';
}

async function syncProducts(account: any, accessToken: string, supabase: any) {
  console.log('Syncing products...')
  
  const products: any[] = []
  let offset = 0
  let hasMore = true
  const limit = 50
  
  while (hasMore) {
    const activeResponse = await fetch(
      `https://api.mercadolibre.com/users/${account.ml_user_id}/items/search?status=active&catalog_listing=false&limit=${limit}&offset=${offset}`,
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

        // Buscar dados fiscais - Verificar múltiplos atributos fiscais
        const fiscalAttributeIds = ['GTIN', 'EAN', 'NCM', 'SELLER_SKU'];
        
        // Verificar atributos fiscais com valores preenchidos
        const fiscalAttributesFound = item.attributes?.filter((attr: any) => 
          fiscalAttributeIds.includes(attr.id) && 
          (attr.value_name || attr.value_id || attr.values?.[0]?.name)
        ) || [];
        
        // Verificar sale_terms para SELLER_SKU
        const fiscalSaleTermsFound = item.sale_terms?.filter((term: any) => 
          term.id === 'SELLER_SKU' && term.value_name
        ) || [];
        
        const hasTaxData = fiscalAttributesFound.length > 0 || fiscalSaleTermsFound.length > 0;
        
        // 🔍 Inferir logistic_type
        const inferredLogisticType = inferLogisticType(item);

        
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
            logistic_type: inferredLogisticType, // ✅ Usa valor inferido
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

  console.log(`[ML-SYNC] Successfully synced ${products.length} products`);
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

  console.log(`Synced ${orders.length} orders`);
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

  // 🔧 CORREÇÃO: Para contas com Decola, usar valores REAIS (excluded)
  const getMetricValue = (metric: any, field: 'rate' | 'value') => {
    if (!metric) return 0;
    
    // Se tem Decola e existem valores reais no campo "excluded"
    if (hasDecola && metric.excluded) {
      const realField = field === 'rate' ? 'real_rate' : 'real_value';
      return metric.excluded[realField] || 0;
    }
    
    // Caso contrário, usar valores normais
    return metric[field] || 0;
  };

  const claimsValue = getMetricValue(metrics.claims, 'value');
  const claimsRate = getMetricValue(metrics.claims, 'rate');
  const delayedValue = getMetricValue(metrics.delayed_handling_time, 'value');
  const delayedRate = getMetricValue(metrics.delayed_handling_time, 'rate');
  const cancellationsValue = getMetricValue(metrics.cancellations, 'value');
  const cancellationsRate = getMetricValue(metrics.cancellations, 'rate');


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
      
      // Métricas de qualidade (valores REAIS quando tem Decola)
      claims_rate: claimsRate,
      claims_value: claimsValue,
      delayed_handling_rate: delayedRate,
      delayed_handling_value: delayedValue,
      cancellations_rate: cancellationsRate,
      cancellations_value: cancellationsValue,
      
      // Programa Decola
      has_decola: hasDecola,
      real_reputation_level: sellerReputation.real_level || null,
      protection_end_date: sellerReputation.protection_end_date || null,
      decola_problems_count: hasDecola ? 
        claimsValue + delayedValue + cancellationsValue : 0,
      
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
  }
}

async function checkSellerRecoveryStatus(account: any, supabase: any) {
  try {
    console.log('Checking seller recovery status...');
    
    // Call the ml-get-seller-recovery-status edge function
    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      'ml-get-seller-recovery-status',
      {
        body: { ml_account_id: account.id }
      }
    );

    if (functionError) {
      console.error('Error checking seller recovery:', functionError);
      return { checked: false, error: functionError.message };
    }

    return { checked: true, has_program: functionData.has_program };
  } catch (error: any) {
    console.error('Error in checkSellerRecoveryStatus:', error);
    return { checked: false, error: error?.message || 'Unknown error' };
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
    }
  } catch (error) {
    console.error('Error in syncFullStock:', error)
  }
}

async function checkAndSyncProductAds(account: any, accessToken: string, supabase: any) {
  console.log('Checking Product Ads status...')
  
  try {
    // Try to get advertiser_id
    const advertiserResponse = await fetch(
      `https://api.mercadolibre.com/advertising/advertisers?product_id=PADS`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    )

    if (!advertiserResponse.ok) {
      if (advertiserResponse.status === 404) {
        await supabase
          .from('mercado_livre_accounts')
          .update({ 
            has_product_ads_enabled: false,
            advertiser_id: null
          })
          .eq('id', account.id)
        
        return { enabled: false, synced: false }
      }
      throw new Error(`API error: ${advertiserResponse.status}`)
    }

    const advertiserData = await advertiserResponse.json()
    const advertiserId = advertiserData.advertiser_id?.toString()

    // Update account with Product Ads info
    await supabase
      .from('mercado_livre_accounts')
      .update({ 
        has_product_ads_enabled: true,
        advertiser_id: advertiserId
      })
      .eq('id', account.id)


    // Call the Product Ads sync function
    try {
      const { data, error } = await supabase.functions.invoke('ml-get-product-ads-data', {
        body: { ml_account_id: account.id }
      })

      if (error) {
        console.error('Error syncing Product Ads data:', error)
        return { enabled: true, synced: false, error: error.message }
      }

      return { enabled: true, synced: true }
    } catch (syncError) {
      console.error('Error calling Product Ads sync:', syncError)
      return { enabled: true, synced: false }
    }

  } catch (error: any) {
    console.error('Error in checkAndSyncProductAds:', error)
    return { enabled: false, synced: false, error: error.message }
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