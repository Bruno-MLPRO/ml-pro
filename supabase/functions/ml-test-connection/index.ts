import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to renew token
async function renewToken(refreshToken: string, supabaseAdmin: any, accountId: string) {
  const appId = Deno.env.get('MERCADO_LIVRE_APP_ID');
  const secretKey = Deno.env.get('MERCADO_LIVRE_SECRET_KEY');

  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: appId!,
      client_secret: secretKey!,
      refresh_token: refreshToken
    })
  });

  const tokenData = await response.json();

  if (!response.ok) {
    // Invalidate tokens if refresh fails
    await supabaseAdmin.from('mercado_livre_accounts').update({ 
      access_token: null, 
      refresh_token: null,
      is_active: false,
      last_sync_status: 'reconnect_needed',
      token_expires_at: new Date().toISOString()
    }).eq('id', accountId);
    throw new Error(tokenData.message || 'Failed to renew token');
  }

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  
  const { error: updateError } = await supabaseAdmin
    .from('mercado_livre_accounts')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      is_active: true,
      last_sync_status: 'success'
    })
    .eq('id', accountId);

  if (updateError) {
    throw new Error(`Failed to update tokens: ${updateError.message}`);
  }

  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { ml_account_id } = await req.json();
    if (!ml_account_id) {
      return new Response(JSON.stringify({ error: 'ml_account_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Fetch account details
    const { data: account, error: accountError } = await supabaseAdmin
      .from('mercado_livre_accounts')
      .select('id, ml_user_id, ml_nickname, access_token, refresh_token, token_expires_at')
      .eq('id', ml_account_id)
      .single();

    if (accountError) throw new Error(`Account not found: ${accountError.message}`);
    
    let accessToken = account.access_token;

    // 2. Check if token is expired
    const isExpired = new Date(account.token_expires_at) < new Date();
    
    if (isExpired) {
      if (!account.refresh_token) {
        return new Response(
          JSON.stringify({ success: false, nickname: account.ml_nickname, message: 'Token expirado e sem refresh token. É necessário reconectar.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      try {
        accessToken = await renewToken(account.refresh_token, supabaseAdmin, account.id);
      } catch (e) {
         return new Response(
          JSON.stringify({ success: false, nickname: account.ml_nickname, message: 'Falha ao renovar o token. Por favor, reconecte a conta.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, nickname: account.ml_nickname, message: 'O token de acesso é inválido ou expirou.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 3. Test API connection
    const testResponse = await fetch(`https://api.mercadolibre.com/users/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (testResponse.ok) {
      const userData = await testResponse.json();
      if (userData.id.toString() === account.ml_user_id.toString()) {
        return new Response(
          JSON.stringify({ success: true, nickname: account.ml_nickname, message: `Conexão com ${account.ml_nickname} bem-sucedida!` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ success: false, nickname: account.ml_nickname, message: 'Token é válido, mas não corresponde ao usuário esperado.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      if (testResponse.status === 401 || testResponse.status === 403) {
         return new Response(
          JSON.stringify({ success: false, nickname: account.ml_nickname, message: 'O token de acesso é inválido ou expirou.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorData = await testResponse.json();
      throw new Error(`API Error: ${errorData.message || 'Failed to connect to ML API'}`);
    }
    
  } catch (error) {
    console.error('Error in ml-test-connection:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
