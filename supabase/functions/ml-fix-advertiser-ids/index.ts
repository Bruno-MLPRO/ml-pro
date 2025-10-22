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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[FIX] Starting advertiser_id correction script...');

    // Buscar todas as contas com Product Ads habilitado mas sem advertiser_id
    const { data: accounts, error: fetchError } = await supabase
      .from('mercado_livre_accounts')
      .select('*')
      .eq('has_product_ads_enabled', true)
      .is('advertiser_id', null);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`[FIX] Found ${accounts?.length || 0} accounts to fix`);
    
    const results = [];
    
    for (const account of accounts || []) {
      try {
        console.log(`[FIX] Processing account: ${account.ml_nickname} (${account.id})`);
        
        // Chamar ml-check-product-ads-status para cada conta
        const { data, error } = await supabase.functions.invoke('ml-check-product-ads-status', {
          body: { ml_account_id: account.id }
        });
        
        results.push({
          account_id: account.id,
          nickname: account.ml_nickname,
          success: !error,
          data,
          error: error?.message
        });
        
        console.log(`[FIX] Result for ${account.ml_nickname}:`, { success: !error, data });
        
        // Aguardar 500ms entre chamadas para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err: any) {
        console.error(`[FIX] Error for account ${account.id}:`, err);
        results.push({
          account_id: account.id,
          nickname: account.ml_nickname,
          success: false,
          error: err?.message || 'Unknown error'
        });
      }
    }

    console.log('[FIX] Script completed!');

    return new Response(JSON.stringify({
      total_accounts: accounts?.length || 0,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[FIX] Script error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
