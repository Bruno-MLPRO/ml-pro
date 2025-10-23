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

    console.log('🚀 Iniciando cálculo de métricas do MÊS ANTERIOR COMPLETO...');

    // Calcular o mês anterior completo
    const now = new Date();
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth.getTime() - 1);
    const firstDayOfPreviousMonth = new Date(lastDayOfPreviousMonth.getFullYear(), lastDayOfPreviousMonth.getMonth(), 1);

    // Referência do mês (primeiro dia do mês anterior)
    const referenceMonth = new Date(firstDayOfPreviousMonth);

    console.log('📅 Período de cálculo (MÊS ANTERIOR COMPLETO):', {
      referenceMonth: referenceMonth.toISOString().split('T')[0],
      periodStart: firstDayOfPreviousMonth.toISOString(),
      periodEnd: firstDayOfCurrentMonth.toISOString()
    });

    // Query 1: Faturamento e Vendas com PAGINAÇÃO
    let allOrders: any[] = [];
    let currentPage = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    console.log('🔄 Iniciando paginação de pedidos...');

    while (hasMore && allOrders.length < 10000) {
      const rangeStart = currentPage * PAGE_SIZE;
      const rangeEnd = rangeStart + PAGE_SIZE - 1;
      
      const { data: pageOrders, error: ordersError } = await supabase
        .from('mercado_livre_orders')
        .select('paid_amount')
        .eq('status', 'paid')
        .gte('date_created', firstDayOfPreviousMonth.toISOString())
        .lt('date_created', firstDayOfCurrentMonth.toISOString())
        .order('date_created', { ascending: false })
        .range(rangeStart, rangeEnd);

      if (ordersError) {
        console.error('❌ Erro ao buscar pedidos:', ordersError);
        throw ordersError;
      }

      if (!pageOrders || pageOrders.length === 0) {
        hasMore = false;
        break;
      }

      allOrders = [...allOrders, ...pageOrders];
      console.log(`📦 Página ${currentPage + 1}: ${pageOrders.length} pedidos (Total: ${allOrders.length})`);

      if (pageOrders.length < PAGE_SIZE) {
        hasMore = false;
      }

      currentPage++;
    }

    const totalRevenue = allOrders.reduce((sum, order) => sum + (Number(order.paid_amount) || 0), 0);
    const totalSales = allOrders.length;

    console.log('💰 Vendas do mês anterior:', { totalRevenue, totalSales, orders: allOrders.length });

    // Query 2: Produtos Ativos por Tipo de Envio
    const { data: productsData, error: productsError } = await supabase
      .from('mercado_livre_products')
      .select('logistic_type, shipping_mode')
      .eq('status', 'active');

    if (productsError) {
      console.error('❌ Erro ao buscar produtos:', productsError);
      throw productsError;
    }

    const total = productsData?.length || 0;
    
    // Seguir padrão do StudentDashboard
    const flex = productsData?.filter(p => 
      p.shipping_mode === 'me2' && p.logistic_type === 'drop_off'
    ).length || 0;
    
    const agencias = productsData?.filter(p => 
      p.shipping_mode === 'me2' && p.logistic_type === 'xd_drop_off'
    ).length || 0;
    
    const coleta = productsData?.filter(p => 
      p.shipping_mode === 'me2' && p.logistic_type === 'cross_docking'
    ).length || 0;
    
    const full = productsData?.filter(p => 
      p.shipping_mode === 'me2' && p.logistic_type === 'fulfillment'
    ).length || 0;
    
    const correios = total - (flex + agencias + coleta + full);

    console.log('📦 Produtos por tipo de envio:', { correios, flex, agencias, coleta, full });

    // Query 3: Métricas de Product Ads
    const { data: campaignsData, error: campaignsError } = await supabase
      .from('mercado_livre_campaigns')
      .select('total_spend, ad_revenue, advertised_sales')
      .gte('synced_at', firstDayOfPreviousMonth.toISOString())
      .lt('synced_at', firstDayOfCurrentMonth.toISOString());

    if (campaignsError) {
      console.error('❌ Erro ao buscar campanhas:', campaignsError);
      throw campaignsError;
    }

    const totalSpend = campaignsData?.reduce((sum, c) => sum + (Number(c.total_spend) || 0), 0) || 0;
    const totalAdRevenue = campaignsData?.reduce((sum, c) => sum + (Number(c.ad_revenue) || 0), 0) || 0;
    const totalAdSales = campaignsData?.reduce((sum, c) => sum + (Number(c.advertised_sales) || 0), 0) || 0;

    const roas = totalSpend > 0 ? totalAdRevenue / totalSpend : 0;
    const acos = totalAdRevenue > 0 ? (totalSpend / totalAdRevenue) * 100 : 0;

    console.log('📊 Métricas de Ads:', {
      totalSpend,
      totalAdRevenue,
      totalAdSales,
      roas: roas.toFixed(2),
      acos: acos.toFixed(2) + '%'
    });

    // Upsert na tabela de métricas consolidadas
    const metricsData = {
      reference_month: referenceMonth.toISOString().split('T')[0],
      period_start: firstDayOfPreviousMonth.toISOString(),
      period_end: firstDayOfCurrentMonth.toISOString(),
      total_revenue: totalRevenue,
      total_sales: totalSales,
      ads_total_spend: totalSpend,
      ads_total_revenue: totalAdRevenue,
      ads_total_sales: totalAdSales,
      ads_roas: roas,
      ads_acos: acos,
      shipping_correios: correios,
      shipping_flex: flex,
      shipping_agencias: agencias,
      shipping_coleta: coleta,
      shipping_full: full,
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
