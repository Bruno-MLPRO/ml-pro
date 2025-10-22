import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ml_account_id } = await req.json();
    
    if (!ml_account_id) {
      throw new Error('ml_account_id é obrigatório');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[DEBUG] Iniciando debug para ml_account_id:', ml_account_id);

    // Buscar dados da conta
    const { data: account, error: accountError } = await supabase
      .from('mercado_livre_accounts')
      .select('*')
      .eq('id', ml_account_id)
      .single();

    if (accountError || !account) {
      throw new Error('Conta não encontrada');
    }

    console.log('[DEBUG] Conta encontrada:', {
      nickname: account.ml_nickname,
      advertiser_id: account.advertiser_id,
      site_id: account.site_id,
      has_product_ads: account.has_product_ads_enabled,
      has_campaigns: account.has_active_campaigns
    });

    // Refresh token se necessário
    let accessToken = account.access_token;
    const tokenExpiresAt = new Date(account.token_expires_at);
    
    if (tokenExpiresAt <= new Date()) {
      console.log('[DEBUG] Token expirado, fazendo refresh...');
      accessToken = await refreshToken(supabase, account);
    }

    const results: any = {
      account_info: {
        ml_nickname: account.ml_nickname,
        advertiser_id: account.advertiser_id,
        site_id: account.site_id,
        has_product_ads_enabled: account.has_product_ads_enabled,
        has_active_campaigns: account.has_active_campaigns
      },
      endpoints_tested: {}
    };

    // TEST 1: Buscar campanhas com métricas (ENDPOINT CORRETO v2)
    console.log('[DEBUG] TEST 1: Buscando campanhas com métricas (API v2)...');
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
      const dateTo = today.toISOString().split('T')[0];
      
      const metrics = 'clicks,prints,ctr,cost,cpc,acos,organic_units_quantity,organic_units_amount,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,cvr,roas,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount';
      
      const campaignsUrl = `https://api.mercadolibre.com/advertising/advertisers/${account.advertiser_id}/product_ads/campaigns?date_from=${dateFrom}&date_to=${dateTo}&metrics=${metrics}&limit=50`;
      const campaignsResponse = await fetch(campaignsUrl, {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'api-version': '2'
        }
      });
      
      const campaignsData = await campaignsResponse.json();
      
      results.endpoints_tested.campaigns_with_metrics_v2 = {
        url: campaignsUrl,
        date_from: dateFrom,
        date_to: dateTo,
        status: campaignsResponse.status,
        response: campaignsData,
        notes: '✅ ENDPOINT CORRETO: /advertising/advertisers/{ID}/product_ads/campaigns com api-version: 2'
      };
      
      console.log('[DEBUG] Campanhas v2 response:', JSON.stringify(campaignsData, null, 2));
    } catch (error: any) {
      results.endpoints_tested.campaigns_with_metrics_v2 = {
        error: error.message
      };
    }

    // TEST 2: Buscar detalhes de um produto específico (API v2)
    console.log('[DEBUG] TEST 2: Buscando detalhes de produto (API v2)...');
    try {
      const { data: sampleProduct } = await supabase
        .from('mercado_livre_products')
        .select('ml_item_id')
        .eq('ml_account_id', ml_account_id)
        .limit(1)
        .single();

      if (sampleProduct) {
        const itemUrl = `https://api.mercadolibre.com/advertising/product_ads/items/${sampleProduct.ml_item_id}`;
        const itemResponse = await fetch(itemUrl, {
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'api-version': '2'
          }
        });
        
        const itemData = await itemResponse.json();
        
        results.endpoints_tested.product_ads_item_v2 = {
          url: itemUrl,
          item_id: sampleProduct.ml_item_id,
          status: itemResponse.status,
          response: itemData,
          notes: '✅ ENDPOINT CORRETO: /advertising/product_ads/items/{ITEM_ID} com api-version: 2'
        };
        
        console.log('[DEBUG] Product Ads Item v2 response:', JSON.stringify(itemData, null, 2));
      }
    } catch (error: any) {
      results.endpoints_tested.product_ads_item_v2 = {
        error: error.message
      };
    }

    // TEST 3: Buscar anúncios (ads) ativos (ENDPOINT CORRETO v2)
    console.log('[DEBUG] TEST 3: Buscando ads ativos (API v2)...');
    try {
      const siteId = account.site_id || 'MLB';
      const adsSearchUrl = `https://api.mercadolibre.com/marketplace/advertising/${siteId}/advertisers/${account.advertiser_id}/product_ads/ads/search?status=active&limit=50`;
      const adsResponse = await fetch(adsSearchUrl, {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'api-version': '2'
        }
      });
      
      const adsData = await adsResponse.json();
      
      results.endpoints_tested.ads_search_v2 = {
        url: adsSearchUrl,
        site_id: siteId,
        status: adsResponse.status,
        response: adsData,
        notes: '✅ ENDPOINT CORRETO: /marketplace/advertising/{SITE_ID}/advertisers/{ID}/product_ads/ads/search com api-version: 2'
      };
      
      console.log('[DEBUG] Ads Search v2 response:', JSON.stringify(adsData, null, 2));
    } catch (error: any) {
      results.endpoints_tested.ads_search_v2 = {
        error: error.message
      };
    }

    // TEST 4: Buscar ads de campanha específica (ENDPOINT CORRETO v2)
    console.log('[DEBUG] TEST 4: Buscando ads de campanha específica (API v2)...');
    try {
      // Pegar primeira campanha ativa do TEST 1
      const campaignsData = results.endpoints_tested.campaigns_with_metrics_v2?.response;
      if (campaignsData?.results?.[0]?.id) {
        const campaignId = campaignsData.results[0].id;
        const siteId = account.site_id || 'MLB';
        
        const campaignAdsUrl = `https://api.mercadolibre.com/marketplace/advertising/${siteId}/advertisers/${account.advertiser_id}/product_ads/ads/search?campaign_id=${campaignId}&status=active&limit=50`;
        const campaignAdsResponse = await fetch(campaignAdsUrl, {
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'api-version': '2'
          }
        });
        
        const campaignAdsData = await campaignAdsResponse.json();
        
        results.endpoints_tested.campaign_ads_v2 = {
          url: campaignAdsUrl,
          site_id: siteId,
          campaign_id: campaignId,
          status: campaignAdsResponse.status,
          response: campaignAdsData,
          notes: '✅ ENDPOINT CORRETO: Ads filtrados por campaign_id com api-version: 2'
        };
        
        console.log('[DEBUG] Campaign Ads v2 response:', JSON.stringify(campaignAdsData, null, 2));
      }
    } catch (error: any) {
      results.endpoints_tested.campaign_ads_v2 = {
        error: error.message
      };
    }

    // TEST 5: Buscar métricas sumarizadas (metrics_summary)
    console.log('[DEBUG] TEST 5: Buscando métricas sumarizadas...');
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
      const dateTo = today.toISOString().split('T')[0];
      
      const metrics = 'clicks,prints,ctr,cost,cpc,acos,organic_units_amount,direct_amount,indirect_amount,total_amount,roas';
      
      const summaryUrl = `https://api.mercadolibre.com/advertising/advertisers/${account.advertiser_id}/product_ads/campaigns?date_from=${dateFrom}&date_to=${dateTo}&metrics=${metrics}&metrics_summary=true&limit=50`;
      const summaryResponse = await fetch(summaryUrl, {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'api-version': '2'
        }
      });
      
      const summaryData = await summaryResponse.json();
      
      results.endpoints_tested.metrics_summary = {
        url: summaryUrl,
        date_from: dateFrom,
        date_to: dateTo,
        status: summaryResponse.status,
        response: summaryData,
        notes: '✅ Métricas sumarizadas de todas as campanhas - campo metrics_summary deve ter totais'
      };
      
      console.log('[DEBUG] Metrics Summary response:', JSON.stringify(summaryData, null, 2));
    } catch (error: any) {
      results.endpoints_tested.metrics_summary = {
        error: error.message
      };
    }

    console.log('[DEBUG] ===== DEBUG COMPLETO =====');
    console.log(JSON.stringify(results, null, 2));

    return new Response(JSON.stringify({
      success: true,
      message: 'Debug completo. Analise as respostas dos endpoints abaixo.',
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[DEBUG] Erro no debug:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function refreshToken(supabase: any, account: any): Promise<string> {
  const refreshUrl = 'https://api.mercadolibre.com/oauth/token';
  const appId = Deno.env.get('MERCADO_LIVRE_APP_ID')!;
  const secretKey = Deno.env.get('MERCADO_LIVRE_SECRET_KEY')!;

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: appId,
    client_secret: secretKey,
    refresh_token: account.refresh_token,
  });

  const response = await fetch(refreshUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error('Falha ao renovar token');
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await supabase
    .from('mercado_livre_accounts')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id);

  return data.access_token;
}
