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
    console.log('[PRODUCT ADS SYNC] Starting for account:', ml_account_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get ML account with access token
    const { data: account, error: accountError } = await supabase
      .from('mercado_livre_accounts')
      .select('*')
      .eq('id', ml_account_id)
      .single();

    if (accountError || !account) {
      console.error('[PRODUCT ADS SYNC] Account not found:', accountError);
      throw new Error('Account not found');
    }

    let accessToken = account.access_token;

    // Check if token is expired and refresh if needed
    if (new Date(account.token_expires_at) <= new Date()) {
      console.log('[PRODUCT ADS SYNC] Token expired, refreshing...');
      accessToken = await refreshToken(account, supabase);
    }

    // Step 1: Get advertiser_id
    let advertiserId = account.advertiser_id;
    console.log('[PRODUCT ADS SYNC] Advertiser ID:', advertiserId || 'not set');
    
    if (!advertiserId) {
      console.log('[PRODUCT ADS SYNC] Fetching advertiser_id from API...');
      
      try {
        const advertiserResponse = await fetch(
          `https://api.mercadolibre.com/advertising/advertisers?product_id=PADS`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );

        if (!advertiserResponse.ok) {
          if (advertiserResponse.status === 404) {
            console.log('[PRODUCT ADS SYNC] ❌ Product Ads not enabled (404)');
            await supabase
              .from('mercado_livre_accounts')
              .update({ 
                has_product_ads_enabled: false,
                advertiser_id: null
              })
              .eq('id', ml_account_id);
            
            return new Response(
              JSON.stringify({ 
                success: false, 
                message: 'Product Ads não está habilitado nesta conta. Ative Product Ads no painel do Mercado Livre.',
                has_product_ads: false
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          const errorText = await advertiserResponse.text();
          console.error('[PRODUCT ADS SYNC] API error:', advertiserResponse.status, errorText);
          throw new Error(`Failed to get advertiser (${advertiserResponse.status}): ${errorText}`);
        }

    const advertiserData = await advertiserResponse.json();
    console.log('[PRODUCT ADS SYNC] API Response:', JSON.stringify(advertiserData));

    // A API retorna um array de advertisers
    if (!advertiserData.advertisers || advertiserData.advertisers.length === 0) {
      console.error('[PRODUCT ADS SYNC] ❌ No advertisers found in response');
      throw new Error('No advertisers found for this user');
    }

    // Buscar advertiser do site MLB (Brasil) ou pegar o primeiro
    const advertiser = advertiserData.advertisers.find((adv: any) => adv.site_id === 'MLB') 
      || advertiserData.advertisers[0];

    advertiserId = advertiser.advertiser_id?.toString();
    console.log('[PRODUCT ADS SYNC] ✅ Advertiser ID obtained:', advertiserId, 'for site:', advertiser.site_id);

    if (!advertiserId) {
      throw new Error('Invalid advertiser_id received from API');
    }

        // Update account with advertiser_id
        await supabase
          .from('mercado_livre_accounts')
          .update({ 
            advertiser_id: advertiserId,
            has_product_ads_enabled: true
          })
          .eq('id', ml_account_id);
          
      } catch (fetchError) {
        console.error('[PRODUCT ADS SYNC] Error fetching advertiser:', fetchError);
        throw fetchError;
      }
    }

    // Step 2: Get active products for this account
    const { data: products, error: productsError } = await supabase
      .from('mercado_livre_products')
      .select('ml_item_id, title, thumbnail, price, status')
      .eq('ml_account_id', ml_account_id)
      .eq('status', 'active')
      .limit(100);

    if (productsError) {
      throw new Error(`Failed to get products: ${productsError.message}`);
    }

    console.log(`[PRODUCT ADS SYNC] Processing ${products.length} active products`);

    if (products.length === 0) {
      console.log('[PRODUCT ADS SYNC] ⚠️ No active products found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          items_synced: 0,
          has_product_ads: true,
          advertiser_id: advertiserId,
          message: 'Nenhum produto ativo encontrado para sincronizar'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Get Product Ads item details and metrics
    const productAdsData = [];
    let processedCount = 0;
    
    for (const product of products) {
      try {
        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`[PRODUCT ADS SYNC] Progress: ${processedCount}/${products.length}`);
        }

        // Wait 100ms between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get item details from Product Ads API
        const itemResponse = await fetch(
          `https://api.mercadolibre.com/advertising/product_ads/items/${product.ml_item_id}`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );

        let isRecommended = false;
        let campaignId = null;
        let adStatus = 'inactive';

        if (itemResponse.ok) {
          const itemData = await itemResponse.json();
          isRecommended = itemData.recommended === true;
          campaignId = itemData.campaign_id;
          adStatus = itemData.status || 'inactive';
        } else if (itemResponse.status === 404) {
          // Item not in Product Ads yet, that's ok
          console.log(`[PRODUCT ADS SYNC] Item ${product.ml_item_id} not in Product Ads`);
        } else {
          console.error(`[PRODUCT ADS SYNC] Error fetching item ${product.ml_item_id}: ${itemResponse.status}`);
        }

        productAdsData.push({
          ml_item_id: product.ml_item_id,
          title: product.title,
          thumbnail: product.thumbnail,
          price: product.price,
          status: adStatus,
          is_recommended: isRecommended,
          campaign_id: campaignId
        });

      } catch (err) {
        console.error(`[PRODUCT ADS SYNC] Error processing item ${product.ml_item_id}:`, err);
        // Continue with next item
      }
    }

    // Step 4: Get metrics for items (if we have any with campaigns)
    const itemIds = productAdsData.map(p => p.ml_item_id).join(',');
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);
    const dateTo = new Date();

    let metricsMap = new Map();

    // Fetch metrics for all items
    if (itemIds) {
      if (!advertiserId) {
        console.error('[PRODUCT ADS SYNC] ❌ Cannot fetch metrics: advertiserId is null');
        console.log('[PRODUCT ADS SYNC] Saving items without metrics...');
      } else {
        try {
          const metricsUrl = `https://api.mercadolibre.com/advertising/pads/reports/${advertiserId}/item-metrics?date_from=${dateFrom.toISOString().split('T')[0]}&date_to=${dateTo.toISOString().split('T')[0]}&item_ids=${itemIds}`;
          console.log('[PRODUCT ADS SYNC] Fetching metrics from:', metricsUrl);
          
          const metricsResponse = await fetch(metricsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          console.log('[PRODUCT ADS SYNC] Metrics response status:', metricsResponse.status);

          if (metricsResponse.ok) {
            const metricsData = await metricsResponse.json();
            console.log('[PRODUCT ADS SYNC] Metrics data received:', metricsData.results?.length || 0, 'items');
            
            if (metricsData.results && metricsData.results.length > 0) {
              console.log(`[PRODUCT ADS SYNC] Found metrics for ${metricsData.results.length} items`);
              for (const metric of metricsData.results) {
                metricsMap.set(metric.item_id, {
                  total_sales: metric.sales || 0,
                  advertised_sales: metric.advertised_sales || 0,
                  ad_revenue: metric.revenue || 0,
                  total_spend: metric.cost || 0,
                  impressions: metric.impressions || 0,
                  clicks: metric.clicks || 0,
                });
              }
            } else {
              console.log('[PRODUCT ADS SYNC] ⚠️ API returned empty results');
            }
          } else {
            const errorText = await metricsResponse.text();
            console.error('[PRODUCT ADS SYNC] Metrics API error:', metricsResponse.status, errorText);
          }
        } catch (err) {
          console.error('[PRODUCT ADS SYNC] Error fetching metrics:', err);
        }
      }
    }

    // Step 5: Calculate derived metrics and upsert data
    const upsertData = [];

    for (const item of productAdsData) {
      const metrics = metricsMap.get(item.ml_item_id) || {
        total_sales: 0,
        advertised_sales: 0,
        ad_revenue: 0,
        total_spend: 0,
        impressions: 0,
        clicks: 0,
      };

      const nonAdvertisedSales = metrics.total_sales - metrics.advertised_sales;
      const nonAdRevenue = item.price ? (nonAdvertisedSales * parseFloat(item.price.toString())) : 0;
      const roas = metrics.total_spend > 0 ? metrics.ad_revenue / metrics.total_spend : null;
      const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : null;
      const acos = metrics.ad_revenue > 0 ? (metrics.total_spend / metrics.ad_revenue) * 100 : null;

      upsertData.push({
        ml_account_id: ml_account_id,
        student_id: account.student_id,
        ml_item_id: item.ml_item_id,
        advertiser_id: advertiserId,
        campaign_id: item.campaign_id,
        title: item.title,
        thumbnail: item.thumbnail,
        status: item.status,
        is_recommended: item.is_recommended,
        price: item.price,
        total_sales: metrics.total_sales,
        advertised_sales: metrics.advertised_sales,
        non_advertised_sales: nonAdvertisedSales,
        ad_revenue: metrics.ad_revenue,
        non_ad_revenue: nonAdRevenue,
        total_spend: metrics.total_spend,
        roas: roas,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        ctr: ctr,
        acos: acos,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Batch upsert
    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from('mercado_livre_product_ads')
        .upsert(upsertData, {
          onConflict: 'ml_account_id,ml_item_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        throw new Error(`Failed to upsert data: ${upsertError.message}`);
      }
    }

    console.log(`[PRODUCT ADS SYNC] ✅ Successfully synced ${upsertData.length} product ads items`);
    console.log(`[PRODUCT ADS SYNC] Summary:`);
    console.log(`  - Total products: ${products.length}`);
    console.log(`  - Recommended: ${upsertData.filter(i => i.is_recommended).length}`);
    console.log(`  - Active campaigns: ${upsertData.filter(i => i.campaign_id).length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        items_synced: upsertData.length,
        has_product_ads: true,
        advertiser_id: advertiserId,
        recommended_count: upsertData.filter(i => i.is_recommended).length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[PRODUCT ADS SYNC] ❌ Error:', error);
    return new Response(
      JSON.stringify({ 
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

async function refreshToken(account: any, supabase: any): Promise<string> {
  const clientId = Deno.env.get('MERCADO_LIVRE_APP_ID');
  const clientSecret = Deno.env.get('MERCADO_LIVRE_SECRET_KEY');

  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: account.refresh_token,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const data = await response.json();
  
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);

  await supabase
    .from('mercado_livre_accounts')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', account.id);

  return data.access_token;
}
