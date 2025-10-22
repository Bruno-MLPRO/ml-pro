import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SellerRecoveryResponse {
  type: 'NEWBIE_GRNTEE' | 'RECOVERY_GRNTEE';
  status: 'AVAILABLE' | 'ACTIVE' | 'UNAVAILABLE' | 'FINISHED_BY_DATE' | 'FINISHED_BY_ISSUES' | 'FINISHED_BY_LEVEL' | 'FINISHED_BY_USER';
  level_id: string | null;
  site_id: string;
  max_issues_allowed: number;
  protection_days_limit: number;
  guarantee?: {
    price: number;
    status: 'ON' | 'OFF';
  };
  advertising_amount?: number;
  protection?: {
    is_renewal: boolean;
    warning: string | null;
    init_date: string;
    end_date: string;
    protection_days: number;
    start_level: string;
    end_level: string;
    orders: {
      qty: number;
      total_issues: number;
      claims_qty: number;
      cancel_qty: number;
      delay_qty: number;
    };
  };
}

async function refreshToken(supabase: any, account: any): Promise<string> {
  console.log(`Refreshing token for account ${account.ml_user_id}`);
  
  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: Deno.env.get('MERCADO_LIVRE_APP_ID')!,
      client_secret: Deno.env.get('MERCADO_LIVRE_SECRET_KEY')!,
      refresh_token: account.refresh_token,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await supabase
    .from('mercado_livre_accounts')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id);

  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ml_account_id } = await req.json();

    if (!ml_account_id) {
      throw new Error('ml_account_id is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch ML account
    const { data: account, error: accountError } = await supabase
      .from('mercado_livre_accounts')
      .select('*')
      .eq('id', ml_account_id)
      .single();

    if (accountError || !account) {
      throw new Error('ML account not found');
    }

    // Check if token needs refresh
    let accessToken = account.access_token;
    const tokenExpiry = new Date(account.token_expires_at);
    const now = new Date();

    if (tokenExpiry <= now) {
      console.log('Token expired, refreshing...');
      accessToken = await refreshToken(supabase, account);
    }

    // Call Mercado Livre API
    console.log(`Fetching seller recovery status for user ${account.ml_user_id}`);
    const mlResponse = await fetch(
      `https://api.mercadolibre.com/users/reputation/seller_recovery/status?user_id=${account.ml_user_id}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!mlResponse.ok) {
      if (mlResponse.status === 404) {
        // User doesn't have a seller recovery program
        console.log('No seller recovery program found for user');
        
        // Update metrics to reflect no program
        await supabase
          .from('mercado_livre_metrics')
          .update({
            has_recovery_benefit: false,
            recovery_program_type: null,
            recovery_program_status: 'UNAVAILABLE',
          })
          .eq('ml_account_id', ml_account_id);

        return new Response(
          JSON.stringify({
            success: true,
            has_program: false,
            message: 'No seller recovery program available',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`ML API error: ${mlResponse.status} ${mlResponse.statusText}`);
    }

    const recoveryData: SellerRecoveryResponse = await mlResponse.json();
    console.log('Seller recovery data:', JSON.stringify(recoveryData, null, 2));

    // Upsert to mercado_livre_seller_recovery table
    const recoveryRecord = {
      ml_account_id,
      program_type: recoveryData.type,
      status: recoveryData.status,
      current_level: recoveryData.level_id || 'newbie',
      site_id: recoveryData.site_id,
      max_issues_allowed: recoveryData.max_issues_allowed,
      protection_days_limit: recoveryData.protection_days_limit,
      guarantee_price: recoveryData.guarantee?.price || null,
      advertising_amount: recoveryData.advertising_amount || null,
      guarantee_status: recoveryData.guarantee?.status || null,
      is_renewal: recoveryData.protection?.is_renewal || false,
      warning: recoveryData.protection?.warning || null,
      init_date: recoveryData.protection?.init_date || null,
      end_date: recoveryData.protection?.end_date || null,
      protection_days: recoveryData.protection?.protection_days || null,
      start_level: recoveryData.protection?.start_level || null,
      end_level: recoveryData.protection?.end_level || null,
      orders_qty: recoveryData.protection?.orders?.qty || 0,
      total_issues: recoveryData.protection?.orders?.total_issues || 0,
      claims_qty: recoveryData.protection?.orders?.claims_qty || 0,
      cancel_qty: recoveryData.protection?.orders?.cancel_qty || 0,
      delay_qty: recoveryData.protection?.orders?.delay_qty || 0,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('mercado_livre_seller_recovery')
      .upsert(recoveryRecord, {
        onConflict: 'ml_account_id',
      });

    if (upsertError) {
      console.error('Error upserting seller recovery data:', upsertError);
      throw upsertError;
    }

    // Update metrics table
    await supabase
      .from('mercado_livre_metrics')
      .update({
        has_recovery_benefit: recoveryData.status === 'ACTIVE',
        recovery_program_type: recoveryData.type,
        recovery_program_status: recoveryData.status,
      })
      .eq('ml_account_id', ml_account_id);

    console.log('Seller recovery status updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        has_program: true,
        program_type: recoveryData.type,
        status: recoveryData.status,
        data: recoveryRecord,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in ml-get-seller-recovery-status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
