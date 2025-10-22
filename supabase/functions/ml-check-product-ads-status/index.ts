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
    console.log('Checking Product Ads status for account:', ml_account_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get ML account
    const { data: account, error: accountError } = await supabase
      .from('mercado_livre_accounts')
      .select('*')
      .eq('id', ml_account_id)
      .single();

    if (accountError || !account) {
      throw new Error('Account not found');
    }

    let accessToken = account.access_token;

    // Check if token is expired and refresh if needed
    if (new Date(account.token_expires_at) <= new Date()) {
      console.log('Token expired, refreshing...');
      accessToken = await refreshToken(account, supabase);
    }

    // Try to get advertiser_id
    const advertiserResponse = await fetch(
      `https://api.mercadolibre.com/advertising/advertisers?product_id=PADS`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!advertiserResponse.ok) {
      if (advertiserResponse.status === 404) {
        console.log('Product Ads not enabled');
        await supabase
          .from('mercado_livre_accounts')
          .update({ 
            has_product_ads_enabled: false,
            advertiser_id: null
          })
          .eq('id', ml_account_id);
        
        return new Response(
          JSON.stringify({ 
            enabled: false,
            message: 'Product Ads não está habilitado nesta conta'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`API error: ${advertiserResponse.status}`);
    }

    const advertiserData = await advertiserResponse.json();
    console.log('Advertiser API Response:', JSON.stringify(advertiserData));

    // A API retorna um array de advertisers
    if (!advertiserData.advertisers || advertiserData.advertisers.length === 0) {
      console.log('Product Ads not enabled - no advertisers found');
      await supabase
        .from('mercado_livre_accounts')
        .update({ 
          has_product_ads_enabled: false,
          advertiser_id: null
        })
        .eq('id', ml_account_id);
      
      return new Response(
        JSON.stringify({ 
          enabled: false,
          message: 'Product Ads não está habilitado nesta conta'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar advertiser do site MLB (Brasil) ou pegar o primeiro
    const advertiser = advertiserData.advertisers.find((adv: any) => adv.site_id === 'MLB') 
      || advertiserData.advertisers[0];

    const advertiserId = advertiser.advertiser_id?.toString();
    
    if (!advertiserId) {
      throw new Error('Invalid advertiser_id received from API');
    }
    
    console.log('Advertiser ID obtained:', advertiserId, 'for site:', advertiser.site_id);

    // Update account
    await supabase
      .from('mercado_livre_accounts')
      .update({ 
        has_product_ads_enabled: true,
        advertiser_id: advertiserId
      })
      .eq('id', ml_account_id);

    return new Response(
      JSON.stringify({ 
        enabled: true,
        advertiser_id: advertiserId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in ml-check-product-ads-status:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
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
