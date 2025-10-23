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

    console.log('🚀 Iniciando cálculo de métricas mensais...');

    // Definir período: últimos 30 dias a partir de HOJE
    const now = new Date();
    const periodEnd = new Date(); // HOJE
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30); // 30 dias atrás de hoje

    // Primeiro dia do mês atual (referência)
    const referenceMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    console.log('📅 Período de cálculo:', {
      referenceMonth: referenceMonth.toISOString().split('T')[0],
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    });

    // Query 1: Faturamento e Vendas (apenas pedidos pagos)
    const { data: ordersData, error: ordersError } = await supabase
      .from('mercado_livre_orders')
      .select('paid_amount')
      .eq('status', 'paid')
      .gte('date_created', periodStart.toISOString())
      .lt('date_created', periodEnd.toISOString())
      .limit(10000);

    if (ordersError) {
      console.error('❌ Erro ao buscar pedidos:', ordersError);
      throw ordersError;
    }

    const totalRevenue = ordersData?.reduce((sum, order) => sum + (Number(order.paid_amount) || 0), 0) || 0;
    const totalSales = ordersData?.length || 0;

    console.log('💰 Vendas:', { totalRevenue, totalSales, orders: ordersData?.length });

    // Query 2: Produtos Ativos por Tipo de Envio
    const { data: productsData, error: productsError } = await supabase
      .from('mercado_livre_products')
      .select('logistic_type, shipping_mode')
      .eq('status', 'active');

    if (productsError) {
      console.error('❌ Erro ao buscar produtos:', productsError);
      throw productsError;
    }

    const shippingStats = {
      // Correios: drop_off + me2
      correios: productsData?.filter(p => 
        p.logistic_type === 'drop_off' && p.shipping_mode === 'me2'
      ).length || 0,
      
      // Flex: cross_docking (raramente usado no ML Brasil)
      flex: productsData?.filter(p => 
        p.logistic_type === 'cross_docking'
      ).length || 0,
      
      // Agências: drop_off SEM me2, ou not_specified
      agencias: productsData?.filter(p => 
        (p.logistic_type === 'drop_off' && p.shipping_mode !== 'me2') ||
        (p.logistic_type === 'not_specified')
      ).length || 0,
      
      // Coleta: xd_drop_off
      coleta: productsData?.filter(p => 
        p.logistic_type === 'xd_drop_off'
      ).length || 0,
      
      // Full: fulfillment
      full: productsData?.filter(p => 
        p.logistic_type === 'fulfillment'
      ).length || 0,
    };

    console.log('📦 Produtos por tipo de envio (DETALHADO):', {
      total_products: productsData?.length || 0,
      by_logistic_type: {
        fulfillment: productsData?.filter(p => p.logistic_type === 'fulfillment').length || 0,
        drop_off: productsData?.filter(p => p.logistic_type === 'drop_off').length || 0,
        xd_drop_off: productsData?.filter(p => p.logistic_type === 'xd_drop_off').length || 0,
        cross_docking: productsData?.filter(p => p.logistic_type === 'cross_docking').length || 0,
        not_specified: productsData?.filter(p => p.logistic_type === 'not_specified').length || 0,
      },
      shipping_stats: shippingStats,
      validation: {
        sum: Object.values(shippingStats).reduce((a, b) => a + b, 0),
        total_products: productsData?.length || 0
      }
    });

    // Query 3: Métricas de Product Ads - CÁLCULO CORRETO
    const { data: campaignsData, error: campaignsError } = await supabase
      .from('mercado_livre_campaigns')
      .select('total_spend, ad_revenue, advertised_sales')
      .gte('synced_at', periodStart.toISOString())
      .lt('synced_at', periodEnd.toISOString());

    if (campaignsError) {
      console.error('❌ Erro ao buscar campanhas:', campaignsError);
      throw campaignsError;
    }

    const totalSpend = campaignsData?.reduce((sum, c) => sum + (Number(c.total_spend) || 0), 0) || 0;
    const totalAdRevenue = campaignsData?.reduce((sum, c) => sum + (Number(c.ad_revenue) || 0), 0) || 0;
    const totalAdSales = campaignsData?.reduce((sum, c) => sum + (Number(c.advertised_sales) || 0), 0) || 0;

    // ✅ CÁLCULO CORRETO: baseado em totais consolidados
    const roas = totalSpend > 0 ? totalAdRevenue / totalSpend : 0;
    const acos = totalAdRevenue > 0 ? (totalSpend / totalAdRevenue) * 100 : 0;

    console.log('📊 Métricas de Ads (CORRETAS):', {
      totalSpend,
      totalAdRevenue,
      totalAdSales,
      roas: roas.toFixed(2),
      acos: acos.toFixed(2) + '%'
    });

    // Upsert na tabela de métricas consolidadas
    const metricsData = {
      reference_month: referenceMonth.toISOString().split('T')[0],
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      total_revenue: totalRevenue,
      total_sales: totalSales,
      ads_total_spend: totalSpend,
      ads_total_revenue: totalAdRevenue,
      ads_total_sales: totalAdSales,
      ads_roas: roas,
      ads_acos: acos,
      shipping_correios: shippingStats.correios,
      shipping_flex: shippingStats.flex,
      shipping_agencias: shippingStats.agencias,
      shipping_coleta: shippingStats.coleta,
      shipping_full: shippingStats.full,
      calculated_at: now.toISOString(),
    };

    const { data: upsertData, error: upsertError } = await supabase
      .from('consolidated_metrics_monthly')
      .upsert(metricsData, { onConflict: 'reference_month' })
      .select()
      .single();

    if (upsertError) {
      console.error('❌ Erro ao salvar métricas:', upsertError);
      throw upsertError;
    }

    console.log('✅ Métricas salvas com sucesso:', upsertData.id);

    return new Response(
      JSON.stringify({
        success: true,
        metrics: upsertData,
        message: 'Métricas calculadas e salvas com sucesso'
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
