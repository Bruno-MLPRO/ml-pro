import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ActionItem {
  id: string
  type: string
  status: 'completed' | 'pending' | 'in_progress'
  name?: string
  description?: string
}

interface PerformanceResponse {
  score: number
  level: 'basic' | 'standard' | 'professional'
  actions: ActionItem[]
}

// Função para calcular score estimado baseado em dados do produto
function calculateEstimatedHealth(product: any): PerformanceResponse {
  let score = 0.5 // Base score
  const actions: ActionItem[] = []
  
  // Fotos: +15% se tem 5+ fotos de boa qualidade
  const photoCount = product.photo_count || 0
  const photosCompleted = !product.has_low_quality_photos && photoCount >= 5
  
  if (photosCompleted) {
    score += 0.15
    actions.push({
      id: 'photos_ok',
      name: 'Fotos de Qualidade',
      description: 'Produto tem fotos de boa qualidade (5+ fotos)',
      progress: photoCount,
      progress_max: 5,
      apply: true,
      status: 'completed',
      type: 'photos',
      completed: new Date().toISOString()
    })
  } else {
    actions.push({
      id: 'improve_photos',
      name: 'Melhorar Fotos',
      description: `Adicione mais fotos de alta qualidade (atualmente ${photoCount}/5)`,
      progress: photoCount,
      progress_max: 5,
      apply: true,
      status: 'pending',
      type: 'photos'
    })
  }
  
  // Descrição: +15% se tem descrição
  const hasDescription = product.has_description
  if (hasDescription) {
    score += 0.15
    actions.push({
      id: 'description_ok',
      name: 'Descrição Completa',
      description: 'Produto tem descrição detalhada',
      progress: 1,
      progress_max: 1,
      apply: true,
      status: 'completed',
      type: 'description',
      completed: new Date().toISOString()
    })
  } else {
    actions.push({
      id: 'add_description',
      name: 'Adicionar Descrição',
      description: 'Complete a descrição do produto com detalhes importantes',
      progress: 0,
      progress_max: 1,
      apply: true,
      status: 'pending',
      type: 'description'
    })
  }
  
  // Dados Fiscais: +10% se tem dados fiscais
  const hasTaxData = product.has_tax_data
  if (hasTaxData) {
    score += 0.10
    actions.push({
      id: 'tax_data_ok',
      name: 'Dados Fiscais OK',
      description: 'Dados fiscais configurados corretamente',
      progress: 1,
      progress_max: 1,
      apply: true,
      status: 'completed',
      type: 'tax',
      completed: new Date().toISOString()
    })
  } else {
    actions.push({
      id: 'add_tax_data',
      name: 'Adicionar Dados Fiscais',
      description: 'Configure os dados fiscais do produto (NCM, origem)',
      progress: 0,
      progress_max: 1,
      apply: true,
      status: 'pending',
      type: 'tax'
    })
  }
  
  // Status Ativo: +10% se está ativo
  const isActive = product.status === 'active'
  if (isActive) {
    score += 0.10
    actions.push({
      id: 'status_active',
      name: 'Anúncio Ativo',
      description: 'Produto está ativo e visível no marketplace',
      progress: 1,
      progress_max: 1,
      apply: true,
      status: 'completed',
      type: 'status',
      completed: new Date().toISOString()
    })
  } else {
    actions.push({
      id: 'activate_listing',
      name: 'Ativar Anúncio',
      description: 'Ative o anúncio para começar a vender',
      progress: 0,
      progress_max: 1,
      apply: true,
      status: 'pending',
      type: 'status'
    })
  }
  
  // Determinar nível
  let level: 'basic' | 'standard' | 'professional' = 'basic'
  if (score >= 0.7) level = 'professional'
  else if (score >= 0.5) level = 'standard'
  
  // Log estrutura para debug
  console.log('[ML-HEALTH] Goals structure:', {
    totalGoals: actions.length,
    sample: actions[0],
    photoProgress: `${photoCount}/5`,
    validStructure: actions.every(a => 
      typeof a.progress === 'number' && 
      typeof a.progress_max === 'number' && 
      typeof a.apply === 'boolean'
    )
  })
  
  return {
    score: Math.min(score, 1.0),
    level,
    actions
  }
}

async function refreshToken(account: any, supabaseAdmin: any): Promise<string> {
  console.log('[ML-HEALTH] Refreshing access token for account:', account.id)
  
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
    const errorText = await response.text()
    console.error('[ML-HEALTH] Token refresh failed:', errorText)
    throw new Error('Falha ao renovar token. Reconecte sua conta.')
  }

  const tokens = await response.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await supabaseAdmin
    .from('mercado_livre_accounts')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString()
    })
    .eq('id', account.id)

  console.log('[ML-HEALTH] Token refreshed successfully, expires at:', expiresAt)
  return tokens.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { ml_account_id, item_id } = await req.json()

    console.log('[ML-HEALTH] Starting sync for account:', ml_account_id, 'item:', item_id || 'all items')

    const { data: account, error: accountError } = await supabaseAdmin
      .from('mercado_livre_accounts')
      .select('*')
      .eq('id', ml_account_id)
      .single()

    if (accountError) throw accountError
    if (!account) throw new Error('ML account not found')

    console.log('[ML-HEALTH] Account info:', {
      id: ml_account_id,
      nickname: account.ml_nickname,
      token_expires_at: account.token_expires_at,
      is_active: account.is_active
    })

    // Check if token needs refresh (expires in less than 5 minutes)
    const tokenExpiresAt = new Date(account.token_expires_at)
    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)
    
    let accessToken = account.access_token
    const needsRefresh = tokenExpiresAt <= fiveMinutesFromNow
    
    if (needsRefresh) {
      console.log('[ML-HEALTH] Token needs refresh (expires at:', tokenExpiresAt.toISOString(), ')')
      try {
        accessToken = await refreshToken(account, supabaseAdmin)
        console.log('[ML-HEALTH] Using refreshed token (first 20 chars):', accessToken.substring(0, 20))
      } catch (error) {
        console.error('[ML-HEALTH] Failed to refresh token:', error)
        throw new Error('Token expirado e não foi possível renovar. Reconecte sua conta do Mercado Livre.')
      }
    } else {
      console.log('[ML-HEALTH] Token is valid, expires at:', tokenExpiresAt.toISOString())
    }

    let itemsToSync: string[] = []
    
    if (item_id) {
      itemsToSync = [item_id]
    } else {
      const { data: products } = await supabaseAdmin
        .from('mercado_livre_products')
        .select('ml_item_id')
        .eq('ml_account_id', ml_account_id)
        .eq('status', 'active')
      
      itemsToSync = products?.map(p => p.ml_item_id) || []
    }

    console.log(`[ML-HEALTH] Found ${itemsToSync.length} items to sync`)
    
    if (itemsToSync.length === 0) {
      console.log('[ML-HEALTH] No active items found for this account')
      return new Response(
        JSON.stringify({ 
          success: true, 
          synced_count: 0,
          message: 'Nenhum anúncio ativo encontrado'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    const results = []

    for (const mlItemId of itemsToSync) {
      try {
        console.log(`[ML-HEALTH] Fetching performance for item: ${mlItemId}`)
        
        // Implementar fallback multi-endpoint
        let performanceData: PerformanceResponse | null = null
        let dataSource = 'unknown'
        let confidence = 0
        let lastError = ''
        
        // TENTATIVA 1: Endpoint /performance (atual)
        try {
          console.log(`[ML-HEALTH-DIAGNOSTIC] Attempt 1: /performance for ${mlItemId}`)
          const performanceResponse = await fetch(
            `https://api.mercadolibre.com/items/${mlItemId}/performance`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          )
          
          if (performanceResponse.ok) {
            performanceData = await performanceResponse.json()
            dataSource = 'api_performance'
            confidence = 1.0
            console.log(`[ML-HEALTH-DIAGNOSTIC] ✅ Got data from /performance`)
          } else {
            lastError = `Performance API: ${performanceResponse.status} - ${performanceResponse.statusText}`
            console.log(`[ML-HEALTH-DIAGNOSTIC] ❌ /performance failed: ${performanceResponse.status}`)
          }
        } catch (e: any) {
          lastError = `Performance API error: ${e.message}`
          console.log(`[ML-HEALTH-DIAGNOSTIC] ❌ /performance exception:`, e.message)
        }
        
        // TENTATIVA 2: Endpoint /health (antigo)
        if (!performanceData) {
          try {
            console.log(`[ML-HEALTH-DIAGNOSTIC] Attempt 2: /health for ${mlItemId}`)
            const healthResponse = await fetch(
              `https://api.mercadolibre.com/items/${mlItemId}/health`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            )
            
            if (healthResponse.ok) {
              performanceData = await healthResponse.json()
              dataSource = 'api_health'
              confidence = 0.9
              console.log(`[ML-HEALTH-DIAGNOSTIC] ✅ Got data from /health`)
            } else {
              lastError += ` | Health API: ${healthResponse.status}`
              console.log(`[ML-HEALTH-DIAGNOSTIC] ❌ /health failed: ${healthResponse.status}`)
            }
          } catch (e: any) {
            lastError += ` | Health API error: ${e.message}`
            console.log(`[ML-HEALTH-DIAGNOSTIC] ❌ /health exception:`, e.message)
          }
        }
        
        // TENTATIVA 3: Calcular score estimado baseado em dados do produto
        if (!performanceData) {
          console.log(`[ML-HEALTH-DIAGNOSTIC] Attempt 3: Calculating estimated score for ${mlItemId}`)
          
          const { data: productData } = await supabaseAdmin
            .from('mercado_livre_products')
            .select('*')
            .eq('ml_item_id', mlItemId)
            .maybeSingle()
          
          if (productData) {
            performanceData = calculateEstimatedHealth(productData)
            dataSource = 'estimated'
            confidence = 0.6
            console.log(`[ML-HEALTH-DIAGNOSTIC] ✅ Using estimated score: ${performanceData.score}`)
          } else {
            lastError += ' | Product data not found'
            console.log(`[ML-HEALTH-DIAGNOSTIC] ❌ Product not found in database`)
          }
        }
        
        // Se ainda não temos dados, pular este item
        if (!performanceData) {
          console.log(`[ML-HEALTH-DIAGNOSTIC] ❌ No data available for ${mlItemId} - skipping`)
          console.log(`[ML-HEALTH-DIAGNOSTIC] Final error chain: ${lastError}`)
          continue
        }
        
        console.log(`[ML-HEALTH-DIAGNOSTIC] Final result for ${mlItemId}: source=${dataSource}, confidence=${confidence}, score=${performanceData.score}`)
        console.log(`[ML-HEALTH] Performance data for ${mlItemId}:`, {
          score: performanceData.score,
          level: performanceData.level,
          actionsCount: performanceData.actions?.length || 0
        })

        // Map actions to goals format for compatibility
        const actions = performanceData.actions || []
        const goalsCompleted = actions.filter(a => a.status === 'completed').length
        const goalsApplicable = actions.length
        const completionPercentage = goalsApplicable > 0 
          ? (goalsCompleted / goalsApplicable) 
          : 0

        console.log(`[ML-HEALTH] Item ${mlItemId} metrics:`, {
          goalsCompleted,
          goalsApplicable,
          completionPercentage: (completionPercentage * 100).toFixed(1) + '%'
        })

        const { data: existingHealth } = await supabaseAdmin
          .from('mercado_livre_item_health')
          .select('health_score')
          .eq('ml_account_id', ml_account_id)
          .eq('ml_item_id', mlItemId)
          .single()

        let scoreTrend = 'stable'
        if (existingHealth) {
          const scoreDiff = performanceData.score - existingHealth.health_score
          if (scoreDiff > 0.05) scoreTrend = 'improving'
          else if (scoreDiff < -0.05) scoreTrend = 'declining'
        }

        const { error: upsertError } = await supabaseAdmin
          .from('mercado_livre_item_health')
          .upsert({
            ml_account_id,
            student_id: account.student_id,
            ml_item_id: mlItemId,
            health_score: performanceData.score,
            health_level: performanceData.level,
            goals: actions,
            goals_completed: goalsCompleted,
            goals_applicable: goalsApplicable,
            completion_percentage: completionPercentage,
            previous_score: existingHealth?.health_score || null,
            score_trend: scoreTrend,
            data_source: dataSource,
            confidence: confidence,
            last_error: lastError || null,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'ml_account_id,ml_item_id'
          })

        if (upsertError) {
          console.error('[ML-HEALTH] Error upserting health:', upsertError)
          continue
        }

        console.log(`[ML-HEALTH] Successfully saved health data for ${mlItemId}`)

        await supabaseAdmin
          .from('mercado_livre_health_history')
          .insert({
            ml_item_id: mlItemId,
            ml_account_id,
            student_id: account.student_id,
            health_score: performanceData.score,
            health_level: performanceData.level,
            recorded_at: new Date().toISOString(),
          })

        results.push({
          item_id: mlItemId,
          health_score: performanceData.score,
          health_level: performanceData.level,
          goals_completed: goalsCompleted,
          goals_applicable: goalsApplicable,
        })

      } catch (error) {
        console.error(`[ML-HEALTH] Error processing item ${mlItemId}:`, error)
      }
    }

    const failedCount = itemsToSync.length - results.length
    console.log('[ML-HEALTH] Sync summary:', {
      total: itemsToSync.length,
      success: results.length,
      failed: failedCount,
      account: account.ml_nickname
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced_count: results.length,
        failed_count: itemsToSync.length - results.length,
        total_count: itemsToSync.length,
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error('[ML-HEALTH] Fatal error in ml-get-item-health:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
