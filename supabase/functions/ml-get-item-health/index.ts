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

    // Check if token is expired
    const tokenExpiresAt = new Date(account.token_expires_at)
    const now = new Date()
    if (tokenExpiresAt <= now) {
      console.error('[ML-HEALTH] Token expired for account:', ml_account_id)
      throw new Error('Token expirado. Reconecte sua conta do Mercado Livre.')
    }

    const accessToken = account.access_token
    console.log('[ML-HEALTH] Token expires at:', tokenExpiresAt.toISOString())

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
        
        const performanceResponse = await fetch(
          `https://api.mercadolibre.com/items/${mlItemId}/performance`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        )

        if (!performanceResponse.ok) {
          const errorText = await performanceResponse.text()
          console.error(`[ML-HEALTH] Failed to fetch performance for ${mlItemId}:`, {
            status: performanceResponse.status,
            statusText: performanceResponse.statusText,
            body: errorText.substring(0, 200)
          })
          continue
        }

        const performanceData: PerformanceResponse = await performanceResponse.json()
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
            goals: actions, // Store actions in goals field for compatibility
            goals_completed: goalsCompleted,
            goals_applicable: goalsApplicable,
            completion_percentage: completionPercentage,
            previous_score: existingHealth?.health_score || null,
            score_trend: scoreTrend,
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
    console.log(`[ML-HEALTH] Sync complete: ${results.length} successful, ${failedCount} failed`)

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
