import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SellerRecoveryResponse {
  seller_id?: number;
  current_level?: string;
  type: 'NEWBIE_GRNTEE' | 'RECOVERY_GRNTEE';
  status: 'AVAILABLE' | 'ACTIVE' | 'UNAVAILABLE' | 'FINISHED_BY_DATE' | 'FINISHED_BY_ISSUES' | 'FINISHED_BY_LEVEL' | 'FINISHED_BY_USER' | 'FINISHED';
  level_id?: string | null;
  site_id: string;
  max_issues_allowed?: number;
  protection_days_limit?: number;
  protection_limits?: {
    max_issues_allowed: number;
    protection_days_limit: number;
  };
  guarantee_limits?: {
    guarantee_price: string | number;
    advertising_amount?: number;
  };
  guarantee_detail?: {
    guarantee_status: 'ON' | 'OFF';
    guarantee_end_date?: string;
    guarantee_buffer?: number;
    guarantee_release_amount?: number;
    guarantee_charge_amount?: number;
  };
  guarantee?: {
    price: number;
    status: 'ON' | 'OFF';
  };
  advertising_amount?: number;
  is_renewal?: boolean;
  protection_detail?: {
    warning?: string | null;
    reactivated?: boolean;
    init_date?: string;
    end_date?: string;
    protection_days?: number;
    start_level?: string;
    end_level?: string;
  };
  protection?: {
    is_renewal: boolean;
    warning: string | null;
    init_date: string;
    end_date: string;
    protection_days: number;
    start_level: string;
    end_level: string;
    orders?: {
      qty: number;
      total_issues: number;
      claims_qty: number;
      cancel_qty: number;
      delay_qty: number;
    };
  };
  sales_detail?: {
    orders_qty: number;
    total_issues: number;
    claims_qty: number;
    cancel_qty: number;
    delay_qty: number;
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
    // Endpoint oficial: https://api.mercadolibre.com/users/reputation/seller_recovery/status
    // Não precisa passar user_id como query param, pois o token já identifica o usuário
    console.log(`Fetching seller recovery status for user ${account.ml_user_id}`);
    const mlResponse = await fetch(
      `https://api.mercadolibre.com/users/reputation/seller_recovery/status`,
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
    console.log('Sales detail:', JSON.stringify(recoveryData.sales_detail, null, 2));
    console.log('Protection detail:', JSON.stringify(recoveryData.protection_detail, null, 2));
    console.log('Status:', recoveryData.status);

    // Seguindo a documentação oficial da API:
    // - protection_limits: contém max_issues_allowed e protection_days_limit
    // - guarantee_limits: contém guarantee_price e advertising_amount
    // - protection_detail: detalhes sobre a proteção atual (init_date, end_date, etc.)
    // - sales_detail: detalhes das vendas durante a proteção (orders_qty, total_issues, claims_qty, cancel_qty, delay_qty)
    // - guarantee_detail: detalhes sobre a garantia (guarantee_status, etc.)
    
    // Extrair limites de proteção
    const maxIssuesAllowed = recoveryData.protection_limits?.max_issues_allowed ?? recoveryData.max_issues_allowed ?? 5;
    const protectionDaysLimit = recoveryData.protection_limits?.protection_days_limit ?? recoveryData.protection_days_limit ?? 365;
    
    // Extrair detalhes de proteção
    const protectionDetail = recoveryData.protection_detail || recoveryData.protection;
    
    // Extrair dados de vendas/problemas de sales_detail (detalhes das vendas durante a proteção)
    // sales_detail existe quando o programa está ATIVE ou tinha estado ACTIVE
    const salesDetail = recoveryData.sales_detail;
    
    // Log detalhado para debug
    if (salesDetail) {
      console.log('Sales detail encontrado na API:', {
        orders_qty: salesDetail.orders_qty,
        total_issues: salesDetail.total_issues,
        claims_qty: salesDetail.claims_qty,
        cancel_qty: salesDetail.cancel_qty,
        delay_qty: salesDetail.delay_qty
      });
    } else {
      console.log('⚠️ Sales detail NÃO encontrado na resposta. Status:', recoveryData.status);
    }
    
    // 🔧 REFATORAÇÃO INTELIGENTE:
    // Quando o programa Decola está ativo, calcular problemas baseado nas vendas reais do período de proteção
    // Usar as métricas REAIS (excluded) que afetam a reputação
    let ordersQty = 0;
    let claimsQty = 0;
    let cancelQty = 0;
    let delayQty = 0;
    let totalIssues = 0;
    
    // Verificar se programa está ativo de múltiplas formas:
    // 1. Status ACTIVE na API
    // 2. has_decola nas métricas (calculado pelo ml-sync-data baseado em real_level + protection_end_date)
    // 3. protection_detail com init_date (programa iniciado)
    const isProgramActiveInAPI = recoveryData.status === 'ACTIVE';
    const protectionStartDate = protectionDetail?.init_date;
    const protectionEndDate = protectionDetail?.end_date;
    
    // Buscar métricas para verificar has_decola (indicador mais confiável)
    const { data: metrics, error: metricsError } = await supabase
      .from('mercado_livre_metrics')
      .select('has_decola, claims_value, delayed_handling_value, cancellations_value, total_sales, protection_end_date')
      .eq('ml_account_id', ml_account_id)
      .maybeSingle();
    
    // Determinar se programa está ativo: has_decola nas métricas OU status ACTIVE na API
    const isProgramActive = metrics?.has_decola === true || isProgramActiveInAPI;
    
    console.log('🔍 Verificando status do programa:', {
      apiStatus: recoveryData.status,
      hasDecolaInMetrics: metrics?.has_decola,
      protectionEndDate: metrics?.protection_end_date,
      initDate: protectionStartDate,
      isProgramActive: isProgramActive
    });
    
    if (isProgramActive) {
      console.log('📊 Calculando problemas baseado nas vendas reais do período de proteção...');
      console.log('Período de proteção:', { 
        start: protectionStartDate || 'não definido na API',
        end: protectionEndDate || metrics?.protection_end_date || 'atual'
      });
      
      if (metricsError && metricsError.code !== 'PGRST116') {
        console.error('Erro ao buscar métricas:', metricsError);
      }
      
      if (metrics) {
        console.log('Métricas reais encontradas:', {
          has_decola: metrics.has_decola,
          claims_value: metrics.claims_value,
          delayed_handling_value: metrics.delayed_handling_value,
          cancellations_value: metrics.cancellations_value,
          total_sales: metrics.total_sales
        });
        
        // Usar os valores REAIS que afetam a reputação
        // claims_value, delayed_handling_value e cancellations_value já são os valores "excluded" quando tem Decola
        claimsQty = metrics.claims_value || 0;
        delayQty = metrics.delayed_handling_value || 0;
        cancelQty = metrics.cancellations_value || 0;
        ordersQty = metrics.total_sales || 0;
        
        // Calcular total de problemas
        totalIssues = claimsQty + delayQty + cancelQty;
        
        console.log('✅ Problemas calculados baseado em vendas reais:', {
          ordersQty,
          claimsQty,
          delayQty,
          cancelQty,
          totalIssues
        });
      } else {
        console.warn('⚠️ Métricas não encontradas, usando dados da API como fallback');
        // Fallback para dados da API se métricas não existirem
        ordersQty = salesDetail?.orders_qty ?? recoveryData.protection?.orders?.qty ?? 0;
        claimsQty = salesDetail?.claims_qty ?? recoveryData.protection?.orders?.claims_qty ?? 0;
        cancelQty = salesDetail?.cancel_qty ?? recoveryData.protection?.orders?.cancel_qty ?? 0;
        delayQty = salesDetail?.delay_qty ?? recoveryData.protection?.orders?.delay_qty ?? 0;
        const totalIssuesFromAPI = salesDetail?.total_issues ?? recoveryData.protection?.orders?.total_issues ?? null;
        totalIssues = totalIssuesFromAPI !== null && totalIssuesFromAPI !== undefined 
          ? totalIssuesFromAPI 
          : (claimsQty + delayQty + cancelQty);
      }
    } else {
      // Se não está ativo, usar dados da API como fallback
      console.log('📊 Programa não está ativo, usando dados da API como fallback');
      ordersQty = salesDetail?.orders_qty ?? recoveryData.protection?.orders?.qty ?? 0;
      claimsQty = salesDetail?.claims_qty ?? recoveryData.protection?.orders?.claims_qty ?? 0;
      cancelQty = salesDetail?.cancel_qty ?? recoveryData.protection?.orders?.cancel_qty ?? 0;
      delayQty = salesDetail?.delay_qty ?? recoveryData.protection?.orders?.delay_qty ?? 0;
      const totalIssuesFromAPI = salesDetail?.total_issues ?? recoveryData.protection?.orders?.total_issues ?? null;
      totalIssues = totalIssuesFromAPI !== null && totalIssuesFromAPI !== undefined 
        ? totalIssuesFromAPI 
        : (claimsQty + delayQty + cancelQty);
    }
    
    console.log('📊 Valores finais de problemas:', {
      ordersQty,
      claimsQty,
      cancelQty,
      delayQty,
      totalIssues,
      isProgramActive,
      calculatedFromMetrics: isProgramActive && protectionStartDate
    });
    
    // Extrair detalhes de garantia
    const guaranteeDetail = recoveryData.guarantee_detail || recoveryData.guarantee;
    const guaranteeLimits = recoveryData.guarantee_limits;
    
    // Converter guarantee_price de string para número se necessário
    let guaranteePriceValue = null;
    if (guaranteeLimits?.guarantee_price) {
      if (typeof guaranteeLimits.guarantee_price === 'string') {
        guaranteePriceValue = parseFloat(guaranteeLimits.guarantee_price.replace(/[^\d.,]/g, '').replace(',', '.'));
      } else {
        guaranteePriceValue = guaranteeLimits.guarantee_price;
      }
    } else if (guaranteeDetail?.price) {
      guaranteePriceValue = guaranteeDetail.price;
    } else if (recoveryData.guarantee?.price) {
      guaranteePriceValue = recoveryData.guarantee.price;
    }
    
    const advertisingAmount = guaranteeLimits?.advertising_amount ?? recoveryData.advertising_amount ?? null;
    const guaranteeStatus = guaranteeDetail?.guarantee_status ?? guaranteeDetail?.status ?? recoveryData.guarantee?.status ?? null;
    
    // Upsert to mercado_livre_seller_recovery table
    const recoveryRecord = {
      ml_account_id,
      program_type: recoveryData.type,
      status: recoveryData.status,
      current_level: recoveryData.current_level ?? recoveryData.level_id ?? 'newbie',
      site_id: recoveryData.site_id,
      max_issues_allowed: maxIssuesAllowed,
      protection_days_limit: protectionDaysLimit,
      guarantee_price: guaranteePriceValue,
      advertising_amount: advertisingAmount,
      guarantee_status: guaranteeStatus,
      is_renewal: recoveryData.is_renewal ?? protectionDetail?.is_renewal ?? false,
      warning: protectionDetail?.warning ?? null,
      init_date: protectionDetail?.init_date ?? null,
      end_date: protectionDetail?.end_date ?? null,
      protection_days: protectionDetail?.protection_days ?? null,
      start_level: protectionDetail?.start_level ?? null,
      end_level: protectionDetail?.end_level ?? null,
      orders_qty: ordersQty,
      claims_qty: claimsQty,
      cancel_qty: cancelQty,
      delay_qty: delayQty,
      total_issues: totalIssues,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    console.log('Registro que será salvo no banco:', JSON.stringify(recoveryRecord, null, 2));

    const { error: upsertError } = await supabase
      .from('mercado_livre_seller_recovery')
      .upsert(recoveryRecord, {
        onConflict: 'ml_account_id',
      });

    if (upsertError) {
      console.error('Error upserting seller recovery data:', upsertError);
      throw upsertError;
    }

    // Update metrics table com a reputação real
    // current_level da API de seller recovery representa a reputação REAL durante a proteção
    const realReputationLevel = recoveryData.current_level ?? 
                                protectionDetail?.start_level ?? 
                                recoveryData.level_id ?? 
                                null;
    
    await supabase
      .from('mercado_livre_metrics')
      .update({
        has_recovery_benefit: recoveryData.status === 'ACTIVE',
        recovery_program_type: recoveryData.type,
        recovery_program_status: recoveryData.status,
        // Atualizar real_reputation_level com current_level da API de seller recovery
        // Este é o campo que mostra a reputação REAL que o vendedor teria sem proteção
        real_reputation_level: realReputationLevel,
      })
      .eq('ml_account_id', ml_account_id);
    
    console.log('Métricas atualizadas com reputação real:', { 
      real_reputation_level: realReputationLevel,
      status: recoveryData.status 
    });

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
