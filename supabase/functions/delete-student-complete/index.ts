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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verificar autorização
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Verificar se é manager
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['manager', 'administrator'])
      .maybeSingle()

    if (!roleData) {
      throw new Error('Only managers can delete students')
    }

    const { student_id } = await req.json()

    if (!student_id) {
      throw new Error('Missing student_id parameter')
    }

    console.log(`🗑️ === DELETANDO ALUNO E TODOS OS DADOS ===`)
    console.log(`Student ID: ${student_id}`)

    // 1. Buscar informações do aluno antes de deletar
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', student_id)
      .single()

    if (!studentProfile) {
      throw new Error('Student not found')
    }

    console.log(`👤 Aluno: ${studentProfile.full_name} (${studentProfile.email})`)

    // 2. Buscar contas ML do aluno
    const { data: mlAccounts } = await supabase
      .from('mercado_livre_accounts')
      .select('id, ml_nickname, ml_user_id')
      .eq('student_id', student_id)

    console.log(`📱 Contas ML encontradas: ${mlAccounts?.length || 0}`)

    // 3. Desconectar webhooks do Mercado Livre antes de deletar
    if (mlAccounts && mlAccounts.length > 0) {
      for (const account of mlAccounts) {
        try {
          // Buscar webhooks da conta
          const { data: webhooks } = await supabase
            .from('mercado_livre_webhooks')
            .select('webhook_id')
            .eq('ml_account_id', account.id)

          if (webhooks && webhooks.length > 0) {
            console.log(`🔗 Removendo ${webhooks.length} webhooks da conta ${account.ml_nickname}`)
            
            // Buscar access_token para deletar webhooks
            const { data: accountWithToken } = await supabase
              .from('mercado_livre_accounts')
              .select('access_token')
              .eq('id', account.id)
              .single()

            if (accountWithToken?.access_token) {
              for (const webhook of webhooks) {
                try {
                  const deleteResponse = await fetch(
                    `https://api.mercadolibre.com/users/${account.ml_user_id}/webhooks/${webhook.webhook_id}`,
                    {
                      method: 'DELETE',
                      headers: { 'Authorization': `Bearer ${accountWithToken.access_token}` }
                    }
                  )

                  if (deleteResponse.ok) {
                    console.log(`✅ Webhook ${webhook.webhook_id} removido`)
                  } else {
                    console.log(`⚠️ Falha ao remover webhook ${webhook.webhook_id}`)
                  }
                } catch (error) {
                  console.error(`❌ Erro ao remover webhook ${webhook.webhook_id}:`, error)
                }
              }
            }
          }
        } catch (error) {
          console.error(`❌ Erro ao processar conta ${account.ml_nickname}:`, error)
        }
      }
    }

    // 4. Contar dados que serão deletados
    const counts = await Promise.all([
      supabase.from('mercado_livre_accounts').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('mercado_livre_products').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('mercado_livre_orders').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('mercado_livre_metrics').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('mercado_livre_item_health').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('mercado_livre_full_stock').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('mercado_livre_product_ads').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('mercado_livre_campaigns').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('mercado_livre_seller_recovery').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('student_journeys').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('milestones').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('student_monthly_metrics').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('student_bonus_delivery').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('student_apps').select('id', { count: 'exact' }).eq('student_id', student_id),
      supabase.from('call_schedules').select('id', { count: 'exact' }).eq('student_id', student_id)
    ])

    const dataCounts = {
      ml_accounts: counts[0].count || 0,
      ml_products: counts[1].count || 0,
      ml_orders: counts[2].count || 0,
      ml_metrics: counts[3].count || 0,
      ml_item_health: counts[4].count || 0,
      ml_full_stock: counts[5].count || 0,
      ml_product_ads: counts[6].count || 0,
      ml_campaigns: counts[7].count || 0,
      ml_seller_recovery: counts[8].count || 0,
      student_journeys: counts[9].count || 0,
      milestones: counts[10].count || 0,
      student_monthly_metrics: counts[11].count || 0,
      student_bonus_delivery: counts[12].count || 0,
      student_apps: counts[13].count || 0,
      call_schedules: counts[14].count || 0
    }

    console.log('\n📊 === DADOS QUE SERÃO DELETADOS ===')
    Object.entries(dataCounts).forEach(([table, count]) => {
      if (count > 0) {
        console.log(`${table}: ${count} registros`)
      }
    })

    // 5. Deletar usuário do auth.users (isso vai cascatear para todas as tabelas relacionadas)
    console.log('\n🗑️ Deletando usuário do auth.users...')
    const { error: deleteError } = await supabase.auth.admin.deleteUser(student_id)

    if (deleteError) {
      console.error('❌ Erro ao deletar usuário:', deleteError)
      throw deleteError
    }

    console.log('✅ Usuário deletado com sucesso!')

    const summary = {
      success: true,
      student_name: studentProfile.full_name,
      student_email: studentProfile.email,
      data_deleted: dataCounts,
      total_records_deleted: Object.values(dataCounts).reduce((sum, count) => sum + count, 0)
    }

    console.log('\n✅ === RESUMO DA EXCLUSÃO ===')
    console.log(`Aluno: ${studentProfile.full_name}`)
    console.log(`Total de registros deletados: ${summary.total_records_deleted}`)

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro na exclusão do aluno:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
