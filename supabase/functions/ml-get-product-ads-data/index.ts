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
    console.log('📊 [PRODUCT ADS SYNC] Starting for account:', ml_account_id);

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
      console.error('❌ Account not found:', accountError);
      throw new Error('Account not found');
    }

    let accessToken = account.access_token;

    // Check if token is expired and refresh if needed
    if (new Date(account.token_expires_at) <= new Date()) {
      console.log('🔄 Token expired, refreshing...');
      accessToken = await refreshToken(account, supabase);
    }

    // Step 1: Get advertiser_id
    let advertiserId = account.advertiser_id;
    console.log('🎯 Advertiser ID:', advertiserId || 'not set');
    
    if (!advertiserId) {
      console.log('🔍 Fetching advertiser_id from API...');
      
      try {
        const advertiserResponse = await fetch(
          `https://api.mercadolibre.com/advertising/advertisers?product_id=PADS`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );

        if (!advertiserResponse.ok) {
          if (advertiserResponse.status === 404) {
            console.log('❌ Product Ads not enabled (404)');
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
          throw new Error(`Failed to get advertiser (${advertiserResponse.status})`);
        }

        const advertiserData = await advertiserResponse.json();

        if (!advertiserData.advertisers || advertiserData.advertisers.length === 0) {
          throw new Error('No advertisers found for this user');
        }

        const advertiser = advertiserData.advertisers.find((adv: any) => adv.site_id === 'MLB') 
          || advertiserData.advertisers[0];

        advertiserId = advertiser.advertiser_id?.toString();
        console.log('✅ Advertiser ID obtained:', advertiserId);

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
        console.error('❌ Error fetching advertiser:', fetchError);
        throw fetchError;
      }
    }

    // Step 2: Fetch campaigns with metrics from last 30 days
    console.log('📊 Step 2: Fetching campaigns with metrics...');
    
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];
    
    const metricsParams = [
      'clicks', 'prints', 'ctr', 'cost', 'cpc', 'acos',
      'organic_units_quantity', 'organic_units_amount',
      'direct_items_quantity', 'indirect_items_quantity',
      'advertising_items_quantity', 'cvr', 'roas',
      'direct_units_quantity', 'indirect_units_quantity',
      'units_quantity', 'direct_amount', 'indirect_amount', 'total_amount'
    ].join(',');
    
    const campaignsUrl = `https://api.mercadolibre.com/advertising/advertisers/${advertiserId}/product_ads/campaigns?date_from=${dateFrom}&date_to=${dateTo}&metrics=${metricsParams}&limit=50`;
    
    const campaignsResponse = await fetch(campaignsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'api-version': '2'
      }
    });

    if (!campaignsResponse.ok) {
      if (campaignsResponse.status === 404) {
        console.log('❌ No active campaigns found');
        
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
      
      throw new Error(`Failed to fetch campaigns: ${campaignsResponse.status}`);
    }

    const campaignsData = await campaignsResponse.json();
    const campaigns = campaignsData.results || [];
    console.log(`✅ Found ${campaigns.length} campaigns`);
    
    if (campaigns.length === 0) {
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

    // Step 2.1: Save campaigns to database
    console.log('💾 Saving campaigns to database...');
    const campaignsToUpsert = campaigns.map(campaign => ({
      ml_account_id: account.id,
      student_id: account.student_id,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      status: campaign.status,
      strategy: campaign.strategy,
      budget: campaign.budget,
      acos_target: campaign.acos_target,
      
      // Metrics
      total_spend: campaign.metrics?.cost || 0,
      ad_revenue: campaign.metrics?.direct_amount || 0,
      organic_revenue: campaign.metrics?.organic_units_amount || 0,
      total_revenue: campaign.metrics?.total_amount || 0,
      
      advertised_sales: campaign.metrics?.advertising_items_quantity || 0,
      organic_sales: campaign.metrics?.organic_units_quantity || 0,
      total_sales: campaign.metrics?.units_quantity || 0,
      
      impressions: campaign.metrics?.prints || 0,
      clicks: campaign.metrics?.clicks || 0,
      ctr: campaign.metrics?.ctr || null,
      roas: campaign.metrics?.roas || null,
      acos: campaign.metrics?.acos || null,
      
      synced_at: new Date().toISOString()
    }));
    
    if (campaignsToUpsert.length > 0) {
      const { error: campaignsError } = await supabase
        .from('mercado_livre_campaigns')
        .upsert(campaignsToUpsert, {
          onConflict: 'ml_account_id,campaign_id'
        });
      
      if (campaignsError) {
        console.error('❌ Error saving campaigns:', campaignsError);
        throw campaignsError;
      }
      
      console.log(`✅ Saved ${campaignsToUpsert.length} campaigns`);
    }
    
    // Create campaign map for quick lookup
    const campaignMap = new Map(campaigns.map(c => [c.id, c.name]));

    // Update account to indicate active campaigns
    await supabase
      .from('mercado_livre_accounts')
      .update({ 
        has_active_campaigns: true,
        has_product_ads_enabled: true
      })
      .eq('id', ml_account_id);

    // Step 3: Get active products
    console.log('📦 Step 3: Fetching active products...');
    const { data: products, error: productsError } = await supabase
      .from('mercado_livre_products')
      .select('ml_item_id, title, thumbnail, price, status')
      .eq('ml_account_id', ml_account_id)
      .eq('status', 'active')
      .limit(100);

    if (productsError) {
      throw new Error(`Failed to get products: ${productsError.message}`);
    }

    console.log(`✅ Found ${products.length} active products`);

    if (products.length === 0) {
      console.log('⚠️ No active products found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          campaigns: campaigns.length,
          products_synced: 0,
          message: 'Campanhas sincronizadas, mas nenhum produto ativo encontrado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Process products and save status/recommendation only
    console.log('🔍 Step 4: Processing product details...');
    const productAdsData = [];
    let processedCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        // Wait 200ms between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

        const itemUrl = `https://api.mercadolibre.com/advertising/product_ads/items/${product.ml_item_id}`;
        const itemResponse = await fetch(itemUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'api-version': '2'
          }
        });

        if (!itemResponse.ok) {
          if (itemResponse.status === 404) {
            // Product not in Product Ads
            productAdsData.push({
              ml_account_id: account.id,
              student_id: account.student_id,
              advertiser_id: advertiserId,
              ml_item_id: product.ml_item_id,
              title: product.title,
              thumbnail: product.thumbnail,
              price: product.price,
              status: 'not_in_campaign',
              campaign_id: null,
              campaign_name: null,
              ad_group_id: null,
              is_recommended: false,
              synced_at: new Date().toISOString()
            });
            errorCount++;
            continue;
          }
          
          console.warn(`⚠️ Failed to fetch ${product.ml_item_id}: ${itemResponse.status}`);
          errorCount++;
          continue;
        }

        const itemData = await itemResponse.json();
        
        productAdsData.push({
          ml_account_id: account.id,
          student_id: account.student_id,
          advertiser_id: advertiserId,
          ml_item_id: product.ml_item_id,
          title: product.title,
          thumbnail: product.thumbnail,
          price: product.price,
          status: itemData.status || 'inactive',
          campaign_id: itemData.campaign_id || null,
          campaign_name: campaignMap.get(itemData.campaign_id) || null,
          ad_group_id: itemData.ad_group_id || null,
          is_recommended: itemData.recommended || false,
          synced_at: new Date().toISOString()
        });
        
        processedCount++;
        
        if (processedCount % 10 === 0) {
          console.log(`Progress: ${processedCount}/${products.length}`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${product.ml_item_id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`✅ Processed ${processedCount} products (${errorCount} errors)`);

    // Step 5: Upsert product ads data
    if (productAdsData.length > 0) {
      console.log('💾 Saving product ads data...');
      
      const { error: upsertError } = await supabase
        .from('mercado_livre_product_ads')
        .upsert(productAdsData, {
          onConflict: 'ml_account_id,ml_item_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('❌ Error upserting product ads:', upsertError);
        throw new Error(`Failed to upsert data: ${upsertError.message}`);
      }
      
      console.log(`✅ Saved ${productAdsData.length} products`);
    }

    // Step 6: Update products_count in campaigns
    console.log('🔢 Updating campaign product counts...');
    const campaignProductCounts = new Map();
    for (const product of productAdsData) {
      if (product.campaign_id) {
        campaignProductCounts.set(
          product.campaign_id,
          (campaignProductCounts.get(product.campaign_id) || 0) + 1
        );
      }
    }
    
    for (const [campaignId, count] of campaignProductCounts) {
      await supabase
        .from('mercado_livre_campaigns')
        .update({ products_count: count })
        .eq('ml_account_id', account.id)
        .eq('campaign_id', campaignId);
    }

    console.log('✅ Product Ads sync completed successfully');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Product Ads data synced successfully',
      summary: {
        campaigns: campaigns.length,
        products_synced: productAdsData.length,
        products_in_campaigns: productAdsData.filter(p => p.campaign_id).length,
        recommended_products: productAdsData.filter(p => p.is_recommended).length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in ml-get-product-ads-data:', error);
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
  console.log('🔄 Refreshing access token...');
  
  const clientId = Deno.env.get('MERCADO_LIVRE_APP_ID');
  const clientSecret = Deno.env.get('MERCADO_LIVRE_SECRET_KEY');

  const refreshResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: account.refresh_token
    })
  });

  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text();
    console.error('❌ Failed to refresh token:', refreshResponse.status, errorText);
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  const tokenData = await refreshResponse.json();
  
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

  await supabase
    .from('mercado_livre_accounts')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString()
    })
    .eq('id', account.id);

  console.log('✅ Token refreshed successfully');
  return tokenData.access_token;
}
