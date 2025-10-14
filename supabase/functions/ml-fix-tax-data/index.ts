import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { ml_account_id, fix_all } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Validar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar conta ML
    const { data: account, error: accountError } = await supabase
      .from('mercado_livre_accounts')
      .select('*')
      .eq('id', ml_account_id)
      .single()

    if (accountError || !account) {
      throw new Error('Account not found')
    }

    console.log('Starting tax data correction for account:', account.id)

    // Buscar produtos com has_tax_data = false (ou todos se fix_all = true)
    let query = supabase
      .from('mercado_livre_products')
      .select('*')
      .eq('ml_account_id', account.id)

    if (!fix_all) {
      query = query.eq('has_tax_data', false)
    }

    const { data: products, error: productsError } = await query

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }

    console.log(`Found ${products?.length || 0} products to reprocess`)

    let correctedCount = 0
    let unchangedCount = 0
    let errorCount = 0

    // Verificar se token precisa refresh
    const needsRefresh = new Date(account.token_expires_at) < new Date(Date.now() + 60 * 60 * 1000)
    let accessToken = account.access_token

    if (needsRefresh) {
      console.log('Token needs refresh')
      accessToken = await refreshToken(account, supabase)
    }

    // Processar cada produto
    for (const product of products || []) {
      try {
        // Buscar dados atualizados do item na API do ML
        const itemResponse = await fetch(
          `https://api.mercadolibre.com/items/${product.ml_item_id}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        )

        if (!itemResponse.ok) {
          console.error(`Failed to fetch item ${product.ml_item_id}`)
          errorCount++
          continue
        }

        const item = await itemResponse.json()

        // Aplicar nova lógica de detecção de dados fiscais
        const fiscalAttributeIds = ['GTIN', 'EAN', 'NCM', 'SELLER_SKU'];
        
        const fiscalAttributesFound = item.attributes?.filter((attr: any) => 
          fiscalAttributeIds.includes(attr.id) && 
          (attr.value_name || attr.value_id || attr.values?.[0]?.name)
        ) || [];
        
        const fiscalSaleTermsFound = item.sale_terms?.filter((term: any) => 
          term.id === 'SELLER_SKU' && term.value_name
        ) || [];
        
        const hasTaxData = fiscalAttributesFound.length > 0 || fiscalSaleTermsFound.length > 0;

        // Se o status mudou, atualizar
        if (hasTaxData !== product.has_tax_data) {
          const { error: updateError } = await supabase
            .from('mercado_livre_products')
            .update({
              has_tax_data: hasTaxData,
              synced_at: new Date().toISOString()
            })
            .eq('id', product.id)

          if (updateError) {
            console.error(`Error updating product ${product.ml_item_id}:`, updateError)
            errorCount++
          } else {
            correctedCount++
            console.log(`✅ Corrigido: ${product.ml_item_id} - ${product.title}`)
            console.log(`   Dados fiscais: ${hasTaxData ? 'SIM' : 'NÃO'}`)
            if (hasTaxData) {
              console.log(`   Atributos encontrados:`, fiscalAttributesFound.map((a: any) => 
                `${a.id}=${a.value_name || a.value_id}`
              ))
            }
          }
        } else {
          unchangedCount++
        }

        // Rate limiting: aguardar 100ms entre requisições (max 10 req/seg)
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Error processing product ${product.ml_item_id}:`, error)
        errorCount++
      }
    }

    console.log('Tax data correction completed:', {
      total: products?.length || 0,
      corrected: correctedCount,
      unchanged: unchangedCount,
      errors: errorCount
    })

    return new Response(
      JSON.stringify({
        success: true,
        total_processed: products?.length || 0,
        corrected: correctedCount,
        unchanged: unchangedCount,
        errors: errorCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in ml-fix-tax-data:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function refreshToken(account: any, supabase: any): Promise<string> {
  console.log('Refreshing access token...')
  
  const mlAppId = Deno.env.get('MERCADO_LIVRE_APP_ID')!
  const mlSecretKey = Deno.env.get('MERCADO_LIVRE_SECRET_KEY')!
  
  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: mlAppId,
      client_secret: mlSecretKey,
      refresh_token: account.refresh_token
    })
  })

  if (!response.ok) {
    throw new Error('Failed to refresh token')
  }

  const data = await response.json()
  
  // Calcular nova data de expiração
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()
  
  // Atualizar tokens no banco
  await supabase
    .from('mercado_livre_accounts')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString()
    })
    .eq('id', account.id)
  
  console.log('Token refreshed successfully')
  return data.access_token
}
