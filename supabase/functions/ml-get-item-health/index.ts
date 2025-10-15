import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HealthGoal {
  id: string
  name: string
  progress: number
  progress_max: number
  apply: boolean
  completed?: string
}

interface HealthResponse {
  health: number
  level: 'basic' | 'standard' | 'professional'
  goals: HealthGoal[]
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

    console.log('Syncing health for account:', ml_account_id, 'item:', item_id || 'all')

    const { data: account, error: accountError } = await supabaseAdmin
      .from('mercado_livre_accounts')
      .select('*')
      .eq('id', ml_account_id)
      .single()

    if (accountError) throw accountError
    if (!account) throw new Error('ML account not found')

    const accessToken = account.access_token

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

    console.log(`Syncing health for ${itemsToSync.length} items`)

    const results = []

    for (const mlItemId of itemsToSync) {
      try {
        const healthResponse = await fetch(
          `https://api.mercadolibre.com/items/${mlItemId}/health`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        )

        if (!healthResponse.ok) {
          console.error(`Failed to fetch health for ${mlItemId}:`, healthResponse.status)
          continue
        }

        const healthData: HealthResponse = await healthResponse.json()

        const goalsCompleted = healthData.goals.filter(
          g => g.apply && g.progress === g.progress_max
        ).length
        
        const goalsApplicable = healthData.goals.filter(g => g.apply).length
        
        const completionPercentage = goalsApplicable > 0 
          ? (goalsCompleted / goalsApplicable) 
          : 0

        const { data: existingHealth } = await supabaseAdmin
          .from('mercado_livre_item_health')
          .select('health_score')
          .eq('ml_account_id', ml_account_id)
          .eq('ml_item_id', mlItemId)
          .single()

        let scoreTrend = 'stable'
        if (existingHealth) {
          const scoreDiff = healthData.health - existingHealth.health_score
          if (scoreDiff > 0.05) scoreTrend = 'improving'
          else if (scoreDiff < -0.05) scoreTrend = 'declining'
        }

        const { error: upsertError } = await supabaseAdmin
          .from('mercado_livre_item_health')
          .upsert({
            ml_account_id,
            student_id: account.student_id,
            ml_item_id: mlItemId,
            health_score: healthData.health,
            health_level: healthData.level,
            goals: healthData.goals,
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
          console.error('Error upserting health:', upsertError)
          continue
        }

        await supabaseAdmin
          .from('mercado_livre_health_history')
          .insert({
            ml_item_id: mlItemId,
            ml_account_id,
            student_id: account.student_id,
            health_score: healthData.health,
            health_level: healthData.level,
            recorded_at: new Date().toISOString(),
          })

        results.push({
          item_id: mlItemId,
          health_score: healthData.health,
          health_level: healthData.level,
          goals_completed: goalsCompleted,
          goals_applicable: goalsApplicable,
        })

      } catch (error) {
        console.error(`Error processing item ${mlItemId}:`, error)
      }
    }

    console.log(`Successfully synced ${results.length} items`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced_count: results.length,
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error('Error in ml-get-item-health:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
