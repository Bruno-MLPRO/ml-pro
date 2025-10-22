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
                advertiser_id: null,
                has_active_campaigns: null
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

        if (!advertiserData.advertisers || advertiserData.advertisers.length === 0) {
          console.error('[PRODUCT ADS SYNC] ❌ No advertisers found in response');
          throw new Error('No advertisers found for this user');
        }

        const advertiser = advertiserData.advertisers.find((adv: any) => adv.site_id === 'MLB') 
          || advertiserData.advertisers[0];

        advertiserId = advertiser.advertiser_id?.toString();
        console.log('[PRODUCT ADS SYNC] ✅ Advertiser ID obtained:', advertiserId, 'for site:', advertiser.site_id);

        if (!advertiserId) {
          throw new Error('Invalid advertiser_id received from API');
        }

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

    // Step 2: Fetch campaigns to verify if there are active campaigns
    console.log('[PRODUCT ADS SYNC] Fetching campaigns...');
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);
    const dateTo = new Date();

    const campaignsUrl = `https://api.mercadolibre.com/advertising/advertisers/${advertiserId}/product_ads/campaigns?date_from=${dateFrom.toISOString().split('T')[0]}&date_to=${dateTo.toISOString().split('T')[0]}&metrics=clicks,prints,cost,cpc,acos,organic_units_quantity,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount`;

    const campaignsResponse = await fetch(campaignsUrl, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'api-version': '2'
      }
    });

    if (!campaignsResponse.ok) {
      const errorText = await campaignsResponse.text();
      console.error('[PRODUCT ADS SYNC] Campaigns API error:', campaignsResponse.status, errorText);
      
      // If 404, means no active campaigns
      if (campaignsResponse.status === 404) {
        console.log('[PRODUCT ADS SYNC] No active campaigns found');
        
        await supabase
          .from('mercado_livre_accounts')
          .update({ 
            has_active_campaigns: false,
            has_product_ads_enabled: true
          })
          .eq('id', ml_account_id);
          
        return new Response(JSON.stringify({
          success: true,
          message: 'Product Ads habilitado mas sem campanhas ativas',
          advertiser_id: advertiserId,
          has_active_campaigns: false,
          has_product_ads: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`Failed to fetch campaigns: ${errorText}`);
    }

    const campaignsData = await campaignsResponse.json();
    console.log('[PRODUCT ADS SYNC] Campaigns found:', campaignsData.paging?.total || 0);

    // If no campaigns, update and return
    if (!campaignsData.results || campaignsData.results.length === 0) {
      console.log('[PRODUCT ADS SYNC] No campaigns in response');
      
      await supabase
        .from('mercado_livre_accounts')
        .update({ 
          has_active_campaigns: false,
          has_product_ads_enabled: true
        })
        .eq('id', ml_account_id);
        
      return new Response(JSON.stringify({
        success: true,
        message: 'Product Ads habilitado mas sem campanhas ativas',
        advertiser_id: advertiserId,
        has_active_campaigns: false,
        has_product_ads: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update account to indicate active campaigns
    await supabase
      .from('mercado_livre_accounts')
      .update({ 
        has_active_campaigns: true,
        has_product_ads_enabled: true
      })
      .eq('id', ml_account_id);

    // Step 3: Get active products for this account
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
          has_active_campaigns: true,
          advertiser_id: advertiserId,
          message: 'Nenhum produto ativo encontrado para sincronizar'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Get Product Ads item details with metrics
    const productAdsData = [];
    let processedCount = 0;
    
    for (const product of products) {
      try {
        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`[PRODUCT ADS SYNC] Progress: ${processedCount}/${products.length}`);
        }

        // Wait 200ms between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

        // Get item details from Product Ads API (v2)
        const itemUrl = `https://api.mercadolibre.com/advertising/product_ads/items/${product.ml_item_id}`;
        
        const itemResponse = await fetch(itemUrl, {
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'api-version': '2'
          }
        });

        if (!itemResponse.ok) {
          if (itemResponse.status === 404) {
            console.log(`[PRODUCT ADS SYNC] Item ${product.ml_item_id} not in Product Ads`);
            
            // Save without metrics
            productAdsData.push({
              ml_account_id,
              student_id: account.student_id,
              advertiser_id: advertiserId,
              ml_item_id: product.ml_item_id,
              title: product.title,
              thumbnail: product.thumbnail,
              price: product.price,
              status: 'not_in_campaign',
              campaign_id: null,
              is_recommended: false,
              total_sales: 0,
              advertised_sales: 0,
              non_advertised_sales: 0,
              ad_revenue: 0,
              non_ad_revenue: 0,
              total_spend: 0,
              roas: null,
              impressions: 0,
              clicks: 0,
              ctr: null,
              acos: null,
            });
            
            continue;
          }
          
          const errorText = await itemResponse.text();
          console.error(`[PRODUCT ADS SYNC] Error fetching item ${product.ml_item_id}:`, itemResponse.status, errorText);
          throw new Error(`Failed to fetch item details: ${itemResponse.status}`);
        }

        const itemData = await itemResponse.json();
        console.log(`[PRODUCT ADS SYNC] Item ${product.ml_item_id} - Campaign: ${itemData.campaign_id}, Status: ${itemData.status}, Recommended: ${itemData.recommended}`);

        // Note: The Product Ads API v2 doesn't return individual item metrics
        // Metrics are only available aggregated by campaign
        // So we only track if the item is in a campaign and if it's recommended

        productAdsData.push({
          ml_account_id,
          student_id: account.student_id,
          advertiser_id: advertiserId,
          ml_item_id: product.ml_item_id,
          title: product.title || itemData.title,
          thumbnail: product.thumbnail || itemData.thumbnail,
          price: product.price || itemData.price,
          status: itemData.status,
          campaign_id: itemData.campaign_id || null,
          is_recommended: itemData.recommended || false,
          // Metrics are not available per individual item in Product Ads API v2
          total_sales: 0,
          advertised_sales: 0,
          non_advertised_sales: 0,
          ad_revenue: 0,
          non_ad_revenue: 0,
          total_spend: 0,
          roas: null,
          impressions: 0,
          clicks: 0,
          ctr: null,
          acos: null,
        });
        
      } catch (error) {
        console.error(`[PRODUCT ADS SYNC] Error processing item ${product.ml_item_id}:`, error);
        
        // On error, save with zeroed metrics
        productAdsData.push({
          ml_account_id,
          student_id: account.student_id,
          advertiser_id: advertiserId,
          ml_item_id: product.ml_item_id,
          title: product.title,
          thumbnail: product.thumbnail,
          price: product.price,
          status: 'error',
          campaign_id: null,
          is_recommended: false,
          total_sales: 0,
          advertised_sales: 0,
          non_advertised_sales: 0,
          ad_revenue: 0,
          non_ad_revenue: 0,
          total_spend: 0,
          roas: null,
          impressions: 0,
          clicks: 0,
          ctr: null,
          acos: null,
        });
      }
    }

    // Step 5: Upsert data
    if (productAdsData.length > 0) {
      const { error: upsertError } = await supabase
        .from('mercado_livre_product_ads')
        .upsert(productAdsData, {
          onConflict: 'ml_account_id,ml_item_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        throw new Error(`Failed to upsert data: ${upsertError.message}`);
      }
    }

    console.log(`[PRODUCT ADS SYNC] ✅ Successfully synced ${productAdsData.length} product ads items`);
    console.log(`[PRODUCT ADS SYNC] Summary:`);
    console.log(`  - Total products: ${products.length}`);
    console.log(`  - Recommended: ${productAdsData.filter(i => i.is_recommended).length}`);
    console.log(`  - Active campaigns: ${productAdsData.filter(i => i.campaign_id).length}`);
    console.log(`  - Not in campaigns: ${productAdsData.filter(i => i.status === 'not_in_campaign').length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        items_synced: productAdsData.length,
        has_product_ads: true,
        has_active_campaigns: true,
        advertiser_id: advertiserId,
        recommended_count: productAdsData.filter(i => i.is_recommended).length,
        in_campaigns: productAdsData.filter(i => i.campaign_id).length,
        not_in_campaigns: productAdsData.filter(i => i.status === 'not_in_campaign').length
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
