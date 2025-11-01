import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { ml_account_id } = await req.json();

    if (!ml_account_id) {
      throw new Error('ml_account_id é obrigatório');
    }

    // Buscar conta
    const { data: account, error: accountError } = await supabaseClient
      .from('mercado_livre_accounts')
      .select('*')
      .eq('id', ml_account_id)
      .single();

    if (accountError) throw accountError;

    console.log('🔍 Testando conta:', account.ml_nickname, '- User ID:', account.ml_user_id);

    // Fazer chamada para API do ML
    const userResponse = await fetch(
      `https://api.mercadolibre.com/users/${account.ml_user_id}?access_token=${account.access_token}`
    );

    if (!userResponse.ok) {
      throw new Error(`API ML retornou erro: ${userResponse.status} ${userResponse.statusText}`);
    }

    const userInfo = await userResponse.json();

    // Extrair informações relevantes
    const debugInfo = {
      account: {
        id: account.id,
        ml_user_id: account.ml_user_id,
        ml_nickname: account.ml_nickname,
      },
      seller_reputation: userInfo.seller_reputation,
      power_seller_status: userInfo.seller_reputation?.power_seller_status,
      level_id: userInfo.seller_reputation?.level_id,
      transactions: {
        total: userInfo.seller_reputation?.transactions?.total,
        completed: userInfo.seller_reputation?.transactions?.completed,
        canceled: userInfo.seller_reputation?.transactions?.canceled,
        ratings: userInfo.seller_reputation?.transactions?.ratings,
      },
      metrics: userInfo.seller_reputation?.metrics,
      status: userInfo.status?.site_status,
    };

    console.log('📊 Resultado da API:', JSON.stringify(debugInfo, null, 2));

    // Verificar lógica atual
    const powerSellerStatus = userInfo.seller_reputation?.power_seller_status;
    const isMercadoLider = powerSellerStatus === 'platinum' ||
                           powerSellerStatus === 'gold' ||
                           powerSellerStatus === 'silver';

    const result = {
      success: true,
      debug_info: debugInfo,
      analysis: {
        power_seller_status_raw: powerSellerStatus,
        is_mercado_lider_by_logic: isMercadoLider,
        is_mercado_lider_in_db: false, // Vamos buscar do banco
        recommendation: isMercadoLider 
          ? `✅ Esta conta DEVERIA ser Mercado Líder (${powerSellerStatus})`
          : `❌ Esta conta NÃO é Mercado Líder segundo a API (power_seller_status: ${powerSellerStatus})`,
      },
      full_api_response: userInfo,
    };

    // Buscar status atual no banco
    const { data: metrics } = await supabaseClient
      .from('mercado_livre_metrics')
      .select('is_mercado_lider, mercado_lider_level')
      .eq('ml_account_id', ml_account_id)
      .single();

    if (metrics) {
      result.analysis.is_mercado_lider_in_db = metrics.is_mercado_lider || false;
      result.analysis.mercado_lider_level_in_db = metrics.mercado_lider_level;
    }

    return new Response(
      JSON.stringify(result, null, 2),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack,
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

