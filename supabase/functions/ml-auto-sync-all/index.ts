import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncResult {
  account_id: string
  ml_nickname: string
  success: boolean
  error?: string
  token_renewed?: boolean
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = new Date();
  console.log('🚀 Starting automatic ML accounts synchronization at', startTime.toISOString());

  try {
    // Create Supabase client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Create log entry
    const { data: logEntry, error: logError } = await supabaseAdmin
      .from('ml_auto_sync_logs')
      .insert({
        started_at: startTime.toISOString(),
      })
      .select()
      .single();

    if (logError) {
      console.error('❌ Error creating log entry:', logError);
    }

    const logId = logEntry?.id;

    // Fetch all active ML accounts
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('mercado_livre_accounts')
      .select('*')
      .eq('is_active', true)
      .order('token_expires_at', { ascending: true }); // Prioritize accounts with tokens expiring sooner

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    if (!accounts || accounts.length === 0) {
      console.log('ℹ️ No active accounts found');
      
      if (logId) {
        await supabaseAdmin
          .from('ml_auto_sync_logs')
          .update({
            finished_at: new Date().toISOString(),
            total_accounts: 0,
            successful_syncs: 0,
            failed_syncs: 0,
          })
          .eq('id', logId);
      }

      return new Response(
        JSON.stringify({ message: 'No active accounts to sync', total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${accounts.length} active accounts to sync`);

    // Prioritize accounts by urgency
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const prioritizedAccounts = [...accounts].sort((a, b) => {
      const aExpires = new Date(a.token_expires_at);
      const bExpires = new Date(b.token_expires_at);

      // Tokens expired or expiring soon = highest priority
      if (aExpires < oneDayFromNow && bExpires >= oneDayFromNow) return -1;
      if (bExpires < oneDayFromNow && aExpires >= oneDayFromNow) return 1;

      // Never synced = second priority
      if (!a.last_sync_at && b.last_sync_at) return -1;
      if (!b.last_sync_at && a.last_sync_at) return 1;

      return 0;
    });

    const results: SyncResult[] = [];
    let successCount = 0;
    let failCount = 0;
    let tokensRenewed = 0;
    let consecutiveFailures = 0;

    // Sync each account with rate limiting
    for (let i = 0; i < prioritizedAccounts.length; i++) {
      const account = prioritizedAccounts[i];
      console.log(`\n🔄 [${i + 1}/${prioritizedAccounts.length}] Syncing account: ${account.ml_nickname} (ID: ${account.id})`);

      // Circuit breaker: if 3 consecutive failures, pause
      if (consecutiveFailures >= 3) {
        console.warn('⚠️ Circuit breaker activated: 3 consecutive failures, pausing for 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        consecutiveFailures = 0;
      }

      try {
        const tokenExpires = new Date(account.token_expires_at);
        const needsRenewal = tokenExpires < oneDayFromNow;

        if (needsRenewal) {
          console.log(`⚠️ Token expires soon or expired: ${tokenExpires.toISOString()}`);
        }

        // Call ml-sync-data function
        const syncDataResponse = await supabaseAdmin.functions.invoke('ml-sync-data', {
          body: { ml_account_id: account.id }
        });

        if (syncDataResponse.error) {
          throw new Error(`ml-sync-data failed: ${syncDataResponse.error.message}`);
        }

        console.log(`✅ Data synced for ${account.ml_nickname}`);

        // Wait 500ms before calling next function (same account)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Call ml-get-item-health function
        const healthResponse = await supabaseAdmin.functions.invoke('ml-get-item-health', {
          body: { ml_account_id: account.id }
        });

        if (healthResponse.error) {
          console.warn(`⚠️ Health sync failed for ${account.ml_nickname}: ${healthResponse.error.message}`);
          // Don't throw, health is optional
        } else {
          console.log(`✅ Health synced for ${account.ml_nickname}`);
        }

        // Check if token was renewed
        const { data: updatedAccount } = await supabaseAdmin
          .from('mercado_livre_accounts')
          .select('token_expires_at')
          .eq('id', account.id)
          .single();

        const wasRenewed = updatedAccount && 
          new Date(updatedAccount.token_expires_at) > tokenExpires;

        if (wasRenewed) {
          tokensRenewed++;
          console.log(`🔄 Token renewed for ${account.ml_nickname}`);
        }

        results.push({
          account_id: account.id,
          ml_nickname: account.ml_nickname,
          success: true,
          token_renewed: wasRenewed
        });

        successCount++;
        consecutiveFailures = 0;

      } catch (error) {
        console.error(`❌ Error syncing ${account.ml_nickname}:`, error);
        
        results.push({
          account_id: account.id,
          ml_nickname: account.ml_nickname,
          success: false,
          error: error.message
        });

        failCount++;
        consecutiveFailures++;
      }

      // Rate limiting: 2 seconds between accounts (except for last one)
      if (i < prioritizedAccounts.length - 1) {
        console.log('⏳ Waiting 2 seconds before next account...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    console.log(`\n✨ Synchronization completed in ${duration.toFixed(2)} seconds`);
    console.log(`📊 Results: ${successCount} successful, ${failCount} failed, ${tokensRenewed} tokens renewed`);

    // Update log entry
    if (logId) {
      await supabaseAdmin
        .from('ml_auto_sync_logs')
        .update({
          finished_at: endTime.toISOString(),
          total_accounts: accounts.length,
          successful_syncs: successCount,
          failed_syncs: failCount,
          tokens_renewed: tokensRenewed,
          error_details: failCount > 0 ? results.filter(r => !r.success) : null
        })
        .eq('id', logId);
    }

    // If more than 50% failed, log critical error
    if (failCount > successCount) {
      console.error('🚨 CRITICAL: More than 50% of syncs failed!');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Synchronization completed',
        total_accounts: accounts.length,
        successful: successCount,
        failed: failCount,
        tokens_renewed: tokensRenewed,
        duration_seconds: duration,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Fatal error in ml-auto-sync-all:', error);

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
