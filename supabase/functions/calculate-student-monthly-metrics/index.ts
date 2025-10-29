import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🚀 Iniciando cálculo de métricas mensais por aluno...');

    // Calcular período: MÊS ANTERIOR completo
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const referenceMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const periodStart = referenceMonth;
    const periodEnd = new Date(today.getFullYear(), today.getMonth(), 1);

    console.log('📅 Período de cálculo:', {
      referenceMonth: referenceMonth.toISOString().split('T')[0],
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    });

    // Buscar todos os alunos
    const { data: students, error: studentsError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'student');

    if (studentsError) {
      console.error('❌ Erro ao buscar alunos:', studentsError);
      throw studentsError;
    }

    console.log(`👥 Total de alunos: ${students?.length || 0}`);

    const results = [];

    // Processar cada aluno
    for (const student of students || []) {
      const studentId = student.user_id;
      
      console.log(`\n👤 Processando aluno: ${studentId}`);

      // 1. Buscar pedidos do mês usando paginação
      let allOrders: any[] = [];
      let currentPage = 0;
      const PAGE_SIZE = 1000;
      let hasMore = true;

      while (hasMore) {
        const rangeStart = currentPage * PAGE_SIZE;
        const rangeEnd = rangeStart + PAGE_SIZE - 1;
        
        const { data: pageOrders, error: ordersError } = await supabase
          .from('mercado_livre_orders')
          .select('paid_amount, total_amount')
          .eq('student_id', studentId)
          .eq('status', 'paid')
          .gte('date_created', periodStart.toISOString())
          .lt('date_created', periodEnd.toISOString())
          .order('date_created', { ascending: false })
          .range(rangeStart, rangeEnd);

        if (ordersError) {
          console.error(`❌ Erro ao buscar pedidos do aluno ${studentId}:`, ordersError);
          break;
        }

        if (pageOrders && pageOrders.length > 0) {
          allOrders = [...allOrders, ...pageOrders];
          currentPage++;
          
          if (pageOrders.length < PAGE_SIZE) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }

        if (currentPage >= 10) {
          hasMore = false;
        }
      }

      const totalSales = allOrders.length;
      const totalRevenue = allOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      // 2. Buscar campanhas de Product Ads
      const { data: accountsData } = await supabase
        .from('mercado_livre_accounts')
        .select('id')
        .eq('student_id', studentId);

      const accountIds = accountsData?.map(a => a.id) || [];

      let adsSpend = 0;
      let adsRevenue = 0;
      let adsSales = 0;

      if (accountIds.length > 0) {
        const { data: campaigns } = await supabase
          .from('mercado_livre_campaigns')
          .select('total_spend, ad_revenue, advertised_sales')
          .in('ml_account_id', accountIds)
          .gte('synced_at', periodStart.toISOString())
          .lt('synced_at', periodEnd.toISOString());

        adsSpend = campaigns?.reduce((sum, c) => sum + (Number(c.total_spend) || 0), 0) || 0;
        adsRevenue = campaigns?.reduce((sum, c) => sum + (Number(c.ad_revenue) || 0), 0) || 0;
        adsSales = campaigns?.reduce((sum, c) => sum + (Number(c.advertised_sales) || 0), 0) || 0;
      }

      const roas = adsSpend > 0 ? adsRevenue / adsSpend : 0;
      const acos = adsRevenue > 0 ? (adsSpend / adsRevenue) * 100 : 0;

      // 3. Buscar produtos ativos (snapshot do último dia do mês)
      const { data: products } = await supabase
        .from('mercado_livre_products')
        .select('logistic_type, shipping_mode, shipping_modes, logistic_types')
        .in('ml_account_id', accountIds)
        .eq('status', 'active');

      // 📦 Lógica atualizada: Um produto pode contar em MÚLTIPLAS categorias
      // Exemplo: um produto pode ter ME2 (FLEX) + Custom (Correios) simultaneamente
      
      let flex = 0;
      let agencias = 0;
      let coleta = 0;
      let full = 0;
      let correios = 0;
      let envio_proprio = 0;

      for (const product of products || []) {
        // Verificar shipping_modes (novo campo JSONB) ou fallback para shipping_mode (compatibilidade)
        const modes = product.shipping_modes || (product.shipping_mode ? [product.shipping_mode] : []);
        const types = product.logistic_types || (product.logistic_type ? [product.logistic_type] : []);

        // Verificar se produto tem ME2 disponível
        const hasMe2 = modes.includes('me2');
        
        // Se tem ME2, verificar todos os tipos logísticos
        if (hasMe2) {
          if (types.includes('self_service') || product.logistic_type === 'self_service') flex++;
          if (types.includes('xd_drop_off') || product.logistic_type === 'xd_drop_off') agencias++;
          if (types.includes('cross_docking') || product.logistic_type === 'cross_docking') coleta++;
          if (types.includes('fulfillment') || product.logistic_type === 'fulfillment') full++;
        }

        // CORREIOS = Mercado Envios (drop_off)
        // drop_off = vendedor leva produtos ao correio ou ponto de entrega (ME1 ou ME2 com drop_off)
        const hasDropOffMode = modes.includes('drop_off') || product.shipping_mode === 'drop_off';
        const hasDropOffType = types.includes('drop_off') || (hasMe2 && product.logistic_type === 'drop_off');
        if (hasDropOffMode || hasDropOffType) {
          correios++;
        }

        // ENVIO PRÓPRIO = Not Specified (not_specified)
        // Not Specified = vendedor NÃO especifica preço e deve entrar em contato com comprador
        if (modes.includes('not_specified') || product.shipping_mode === 'not_specified') {
          envio_proprio++;
        }
      }

      const shippingStats = {
        correios,
        envio_proprio,
        flex,
        agencias,
        coleta,
        full
      };

      // 4. Salvar no banco
      const metricsData = {
        student_id: studentId,
        reference_month: referenceMonth.toISOString().split('T')[0],
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        total_revenue: totalRevenue,
        total_sales: totalSales,
        average_ticket: averageTicket,
        ads_total_spend: adsSpend,
        ads_total_revenue: adsRevenue,
        ads_total_sales: adsSales,
        ads_roas: roas,
        ads_acos: acos,
        shipping_correios: shippingStats.correios,
        shipping_envio_proprio: shippingStats.envio_proprio,
        shipping_flex: shippingStats.flex,
        shipping_agencias: shippingStats.agencias,
        shipping_coleta: shippingStats.coleta,
        shipping_full: shippingStats.full,
        calculated_at: new Date().toISOString(),
      };

      const { error: saveError } = await supabase
        .from('student_monthly_metrics')
        .upsert(metricsData, { onConflict: 'student_id,reference_month' })
        .select()
        .single();

      if (saveError) {
        console.error(`❌ Erro ao salvar métricas do aluno ${studentId}:`, saveError);
        continue;
      }

      console.log(`✅ Aluno ${studentId}: ${totalSales} vendas, R$ ${totalRevenue.toFixed(2)}`);
      results.push({ studentId, totalSales, totalRevenue });
    }

    console.log(`\n✅ Processamento concluído: ${results.length} alunos`);

    return new Response(
      JSON.stringify({
        success: true,
        studentsProcessed: results.length,
        referenceMonth: referenceMonth.toISOString().split('T')[0],
        results,
        message: 'Métricas mensais calculadas com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
