// Edge Function: ml-get-product-details
// Busca dados completos de um produto do Mercado Livre

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const mlApiBaseHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
};

let cachedAppToken: {
  token: string;
  expiresAt: number;
} | null = null;

async function getAppAccessToken(): Promise<string> {
  if (cachedAppToken && cachedAppToken.expiresAt > Date.now() + 60_000) { // 1 min buffer
    return cachedAppToken.token;
  }

  console.log('Gerando novo token de aplicação do Mercado Livre...');
  const clientId = Deno.env.get('MERCADO_LIVRE_APP_ID');
  const clientSecret = Deno.env.get('MERCADO_LIVRE_SECRET_KEY');

  if (!clientId || !clientSecret) {
    throw new Error('Credenciais do Mercado Livre (APP_ID/SECRET_KEY) não configuradas.');
  }

  const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...mlApiBaseHeaders,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Falha ao obter token de app do Mercado Livre:', errorText);
    throw new Error('Não foi possível autenticar com o Mercado Livre (client_credentials).');
  }

  const tokenData = await tokenResponse.json();
  cachedAppToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in || 0) * 1000,
  };

  return cachedAppToken.token;
}

async function getStudentAccessToken(supabaseAdmin: SupabaseClient, studentId: string): Promise<string | null> {
  try {
    const { data: account, error } = await supabaseAdmin
      .from('mercado_livre_accounts')
      .select('id, access_token, refresh_token, token_expires_at')
      .eq('student_id', studentId)
      .eq('is_primary', true)
      .single();

    if (error || !account) {
      console.warn('Conta principal do Mercado Livre não encontrada para o studentId:', studentId);
      return null;
    }

    const isExpired = new Date(account.token_expires_at) < new Date(Date.now() - 5 * 60 * 1000); // 5 min buffer

    if (isExpired) {
      console.log('Token de acesso do estudante expirado. Renovando...');
      if (!account.refresh_token) {
        console.warn('Token expirado e sem refresh_token. Não é possível renovar.');
        return null;
      }
      return await renewStudentToken(account.refresh_token, supabaseAdmin, account.id);
    }

    return account.access_token;
  } catch (e) {
    console.error("Erro ao buscar token do estudante:", e.message);
    return null;
  }
}

async function renewStudentToken(refreshToken: string, supabaseAdmin: SupabaseClient, accountId: string): Promise<string> {
  const appId = Deno.env.get('MERCADO_LIVRE_APP_ID');
  const secretKey = Deno.env.get('MERCADO_LIVRE_SECRET_KEY');

  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: appId!,
      client_secret: secretKey!,
      refresh_token: refreshToken
    })
  });

  const tokenData = await response.json();

  if (!response.ok) {
    console.error('Falha ao renovar o token do estudante:', tokenData);
    await supabaseAdmin.from('mercado_livre_accounts').update({
      is_active: false,
      last_sync_status: 'reconnect_needed'
    }).eq('id', accountId);
    throw new Error('Não foi possível renovar o token. Por favor, reconecte a conta.');
  }

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  await supabaseAdmin.from('mercado_livre_accounts').update({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: expiresAt,
    is_active: true,
  }).eq('id', accountId);

  return tokenData.access_token;
}

async function buildAppMlHeaders() {
  const token = await getAppAccessToken();
  return { ...mlApiBaseHeaders, Authorization: `Bearer ${token}` };
}

async function buildUserMlHeaders(supabaseAdmin: SupabaseClient, studentId: string) {
  const token = await getStudentAccessToken(supabaseAdmin, studentId);
  if (!token) return null;
  return { ...mlApiBaseHeaders, Authorization: `Bearer ${token}` };
}

interface ProductDetails {
  id: string;
  resolved_item_id: string;
  original_product_id: string;
  catalog_product_id?: string;
  title: string;
  price: number;
  description: string;
  brand?: string;
  category_id: string;
  sold_quantity: number;
  available_quantity: number;
  condition: string;
  permalink: string;
  thumbnail: string;
  pictures: Array<{ url: string }>;
  daily_visits?: number;
  monthly_visits?: number;
  conversion_rate?: number;
  competitors?: CompetitorInfo[];
  seller?: {
    id: number;
    reputation: string;
    sales: number;
  };
  catalog_data?: any;
  source: 'item' | 'catalog' | 'search';
}

interface CompetitorInfo {
  item_id: string;
  seller_id: number;
  price: number;
  available_quantity: number;
  sold_quantity: number;
  listing_type?: string;
  shipping?: {
    logistic_type?: string;
    mode?: string;
    free_shipping?: boolean;
  };
  visits_total?: number;
  reputation?: string;
  is_buy_box_winner?: boolean;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 Edge Function iniciada');
    console.log('📋 Request method:', req.method);
    console.log('📋 Request headers:', Object.fromEntries(req.headers.entries()));
    
    let body;
    try {
      body = await req.json();
      console.log('📋 Request body recebido:', body);
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse do body:', parseError);
      throw new Error('Erro ao processar o corpo da requisição. Certifique-se de enviar JSON válido.');
    }
    
    const { productId: rawProductId, studentId } = body;

    console.log('📋 Dados extraídos:', { rawProductId, studentId });

    if (!rawProductId) {
      throw new Error('ID do produto é obrigatório (ex: MLB123456789)');
    }
    // studentId is optional for public data but required for private data like visits

    const productId = normalizeProductId(rawProductId);

    if (!productId) {
      throw new Error('ID inválido. Utilize um código como MLB123456789.');
    }

    console.log('ID normalizado:', productId);

    // Verificar variáveis de ambiente
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const mlAppId = Deno.env.get('MERCADO_LIVRE_APP_ID');
    const mlSecret = Deno.env.get('MERCADO_LIVRE_SECRET_KEY');

    console.log('🔑 Variáveis de ambiente:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasMlAppId: !!mlAppId,
      hasMlSecret: !!mlSecret
    });

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    console.log(`Buscando detalhes do produto ID: ${productId}`);

    const appApiHeaders = await buildAppMlHeaders();
    console.log('🔑 Headers da aplicação gerados:', {
      hasAuthorization: !!appApiHeaders.Authorization,
      authPreview: appApiHeaders.Authorization ? appApiHeaders.Authorization.substring(0, 20) + '...' : 'MISSING'
    });
    
    const userApiHeaders = studentId ? await buildUserMlHeaders(supabaseAdmin, studentId) : null;
    console.log('🔑 Headers do usuário:', {
      hasUserHeaders: !!userApiHeaders,
      hasAuthorization: !!userApiHeaders?.Authorization
    });

    const originalProductId = productId;
    let resolvedItemId = productId;
    let catalogData: any = null;
    let source: 'item' | 'catalog' | 'search' = 'item';

    // Tentar buscar como item individual primeiro
    let productResponse = await fetch(
      `https://api.mercadolibre.com/items/${resolvedItemId}`,
      { headers: appApiHeaders }
    );

    if (!productResponse.ok) {
      const status = productResponse.status;
      console.log(`Tentativa de /items falhou (${status}). Tentando resolver via catálogo...`);

      let resolvedFromCatalog = false;

      // 1) Tentativa via /products (estrutura de catálogo)
      const catalogProductResponse = await fetch(
        `https://api.mercadolibre.com/products/${originalProductId}`,
        { headers: appApiHeaders }
      );

      if (catalogProductResponse.ok) {
        catalogData = await catalogProductResponse.json();
        
        // Extrair TODOS os possíveis IDs de itens que vêm na resposta do catálogo
        const possibleItemIds: string[] = [];
        
        // 1. Buy box winner (preferência máxima)
        if (catalogData?.buy_box_winner?.item_id) {
          possibleItemIds.push(catalogData.buy_box_winner.item_id);
        }
        
        // 2. Array items (pode conter vários IDs)
        if (Array.isArray(catalogData?.items)) {
          catalogData.items.forEach((item: any) => {
            const itemId = typeof item === 'string' ? item : item?.id;
            if (itemId) possibleItemIds.push(itemId);
          });
        }
        
        // 3. Array variations
        if (Array.isArray(catalogData?.variations)) {
          catalogData.variations.forEach((variation: any) => {
            if (variation?.item_id) possibleItemIds.push(variation.item_id);
          });
        }
        
        // 4. Children IDs (produtos filhos do catálogo)
        if (Array.isArray(catalogData?.children_ids) && catalogData.children_ids.length > 0) {
          console.log(`📌 Catálogo PAI encontrado com ${catalogData.children_ids.length} filhos`);
          // Se é produto pai, buscar o primeiro filho
          const firstChildResponse = await fetch(
            `https://api.mercadolibre.com/products/${catalogData.children_ids[0]}`,
            { headers: appApiHeaders }
          );
          if (firstChildResponse.ok) {
            const firstChild = await firstChildResponse.json();
            if (firstChild?.buy_box_winner?.item_id) {
              possibleItemIds.push(firstChild.buy_box_winner.item_id);
            }
          }
        }
        
        console.log('📦 IDs extraídos do catálogo:', {
          hasBuyBoxWinner: !!catalogData?.buy_box_winner,
          buyBoxPrice: catalogData?.buy_box_winner?.price,
          totalIds: possibleItemIds.length,
          ids: possibleItemIds.slice(0, 3),
          catalogId: catalogData?.id,
          catalogName: catalogData?.name?.substring(0, 50),
          isParent: catalogData?.children_ids?.length > 0
        });

        // Tentar cada ID até encontrar um que funcione
        for (const candidateId of possibleItemIds) {
          console.log(`🔍 Tentando buscar item: ${candidateId}`);
          
          const itemResponse = await fetch(
            `https://api.mercadolibre.com/items/${candidateId}`,
            { headers: appApiHeaders }
          );
          
          if (itemResponse.ok) {
            resolvedItemId = candidateId;
            source = 'catalog';
            resolvedFromCatalog = true;
            productResponse = itemResponse;
            console.log(`✅ Item encontrado: ${resolvedItemId}`);
            break;
          } else {
            console.log(`⚠️ Item ${candidateId} retornou ${itemResponse.status}`);
          }
        }

        if (!resolvedFromCatalog) {
          console.log('⚠️ Catálogo encontrado mas sem buy_box_winner. Buscando anúncios ativos via catalog_product_id...');
          
          // Fallback: buscar anúncios usando catalog_product_id
          // Este endpoint requer token de usuário, não apenas token de app
          console.log(`🔍 Tentando buscar anúncios com catalog_product_id=${catalogData.id}`);
          const searchHeaders = userApiHeaders || appApiHeaders;
          console.log(`🔑 Usando headers:`, { isUserToken: !!userApiHeaders });
          
          const catalogSearchResponse = await fetch(
            `https://api.mercadolibre.com/sites/MLB/search?catalog_product_id=${catalogData.id}&limit=1`,
            { headers: searchHeaders }
          );
          
          console.log(`📊 Status da busca por catalog_product_id: ${catalogSearchResponse.status}`);
          
          if (catalogSearchResponse.ok) {
            const catalogSearchData = await catalogSearchResponse.json();
            console.log(`📦 Dados da busca:`, {
              total: catalogSearchData.paging?.total,
              resultsCount: catalogSearchData.results?.length,
              firstItemId: catalogSearchData.results?.[0]?.id
            });
            
            const firstActiveItem = catalogSearchData.results?.[0]?.id;
            
            if (firstActiveItem) {
              resolvedItemId = firstActiveItem;
              source = 'catalog';
              resolvedFromCatalog = true;
              console.log(`✅ Encontrado anúncio ativo ${resolvedItemId} para o catálogo via search`);
            } else {
              console.log('⚠️ Nenhum anúncio ativo encontrado para este catálogo (results vazio)');
            }
          } else {
            const errorBody = await catalogSearchResponse.text();
            console.log(`❌ Busca por catalog_product_id falhou: ${catalogSearchResponse.status} - ${errorBody}`);
          }
          
          // Se ainda não resolveu e temos catalogData válido, tentar estratégias alternativas
          if (!resolvedFromCatalog && catalogData && catalogData.id) {
            console.log('🔍 Tentando estratégias alternativas para encontrar anúncios...');
            
            // Estratégia 1: Buscar por marca + modelo específico
            const brand = catalogData.attributes?.find((a: any) => a.id === 'BRAND')?.value_name;
            const model = catalogData.attributes?.find((a: any) => a.id === 'MODEL')?.value_name;
            
            if (brand && model) {
              const brandModelQuery = encodeURIComponent(`${brand} ${model}`);
              console.log(`🔍 Buscando por marca+modelo: ${brand} ${model}`);
              
              const brandSearchResponse = await fetch(
                `https://api.mercadolibre.com/sites/MLB/search?q=${brandModelQuery}&limit=20`,
                { headers: appApiHeaders }
              );
              
              if (brandSearchResponse.ok) {
                const brandSearchData = await brandSearchResponse.json();
                console.log(`📊 Busca por marca+modelo retornou ${brandSearchData.results?.length || 0} resultados`);
                
                // Procurar por um item que tenha o EXATO catalog_product_id
                const exactMatch = brandSearchData.results?.find(
                  (item: any) => item.catalog_product_id === catalogData.id
                );
                
                if (exactMatch && exactMatch.id) {
                  resolvedItemId = exactMatch.id;
                  source = 'catalog';
                  resolvedFromCatalog = true;
                  console.log(`✅ Encontrado anúncio exato ${resolvedItemId} via busca por marca+modelo`);
                }
              }
            }
            
            // Estratégia 2: Buscar por título completo (fallback)
            if (!resolvedFromCatalog) {
              const titleQuery = encodeURIComponent(catalogData.name?.substring(0, 60) || '');
              console.log(`🔍 Buscando por título: ${catalogData.name?.substring(0, 60)}`);
              
              const titleSearchResponse = await fetch(
                `https://api.mercadolibre.com/sites/MLB/search?q=${titleQuery}&limit=20`,
                { headers: appApiHeaders }
              );
              
              if (titleSearchResponse.ok) {
                const titleSearchData = await titleSearchResponse.json();
                console.log(`📊 Busca por título retornou ${titleSearchData.results?.length || 0} resultados`);
                
                // Procurar por um item que tenha o EXATO catalog_product_id
                const exactMatch = titleSearchData.results?.find(
                  (item: any) => item.catalog_product_id === catalogData.id
                );
                
                if (exactMatch && exactMatch.id) {
                  resolvedItemId = exactMatch.id;
                  source = 'catalog';
                  resolvedFromCatalog = true;
                  console.log(`✅ Encontrado anúncio exato ${resolvedItemId} via busca por título`);
                } else {
                  // Se não achou match exato, pegar o primeiro resultado e buscar competidores
                  if (titleSearchData.results?.length > 0) {
                    const firstResult = titleSearchData.results[0];
                    resolvedItemId = firstResult.id;
                    source = 'search';
                    resolvedFromCatalog = true;
                    console.log(`⚠️ Usando primeiro resultado da busca: ${resolvedItemId} (catalog_product_id: ${firstResult.catalog_product_id})`);
                  } else {
                    // Log dos catalog_product_ids encontrados para debug
                    const foundCatalogIds = titleSearchData.results
                      ?.map((r: any) => r.catalog_product_id)
                      .filter(Boolean)
                      .slice(0, 5);
                    console.log(`⚠️ Não encontrou match exato. IDs encontrados:`, foundCatalogIds);
                    console.log(`⚠️ Procurando por: ${catalogData.id}`);
                  }
                }
              }
            }
            
            // SOLUÇÃO ALTERNATIVA: Usar dados do próprio catalogData quando API de search falha
            if (!resolvedFromCatalog && catalogData) {
              console.log('💡 Sem item específico. Usando dados agregados do catálogo...');
              
              // Extrair informações disponíveis no catalogData
              const hasPriceRange = catalogData.buy_box_winner_price_range;
              const avgPrice = hasPriceRange 
                ? Math.round((hasPriceRange.min?.price + hasPriceRange.max?.price) / 2 || 0)
                : 0;
              
              console.log(`📊 Dados do catálogo:`, {
                hasPriceRange: !!hasPriceRange,
                minPrice: hasPriceRange?.min?.price,
                maxPrice: hasPriceRange?.max?.price,
                avgPrice
              });
              
              // CRIAR um produto "virtual" baseado nos dados do catálogo
              // Isso permite que o usuário veja pelo menos informações básicas
              const virtualProduct = {
                id: catalogData.id,
                title: catalogData.name || 'Produto de Catálogo',
                price: avgPrice,
                sold_quantity: 0,
                available_quantity: 0,
                seller_id: 0,
                category_id: catalogData.domain_id || '',
                condition: 'new',
                permalink: catalogData.permalink || `https://www.mercadolibre.com.br/p/${catalogData.id}`,
                thumbnail: catalogData.pictures?.[0]?.url || '',
                pictures: catalogData.pictures || [],
                attributes: catalogData.attributes || [],
                catalog_product_id: catalogData.id
              };
              
              // Simular resposta bem-sucedida para continuar o fluxo
              productResponse = new Response(JSON.stringify(virtualProduct), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
              
              resolvedItemId = catalogData.id;
              source = 'catalog';
              resolvedFromCatalog = true;
              
              console.log(`✅ Usando dados virtuais do catálogo (preço médio: ${avgPrice})`);
            }
          }
        }
      } else {
        console.log(`Endpoint /products retornou ${catalogProductResponse.status}.`);
      }

      // Attempt /products with numeric ID (strip prefix) if previous returned 404
      if (!resolvedFromCatalog && !catalogProductResponse.ok && /^ML[ABM](\d+)$/.test(originalProductId)) {
        const numericId = originalProductId.replace(/^ML[ABM]/, '');
        console.log('Tentando /products com ID numérico:', numericId);
        const altProdResp = await fetch(
          `https://api.mercadolibre.com/products/${numericId}`,
          { headers: appApiHeaders }
        );
        if (altProdResp.ok) {
          catalogData = await altProdResp.json();
          const buyBoxItemId = catalogData?.buy_box_winner?.item_id || catalogData?.items?.[0]?.id;
        if (buyBoxItemId) {
          resolvedItemId = buyBoxItemId;
          source = 'catalog';
          resolvedFromCatalog = true;
            console.log(`Item ${resolvedItemId} resolvido via /products numérico`);
            productResponse = await fetch(`https://api.mercadolibre.com/items/${resolvedItemId}`, { headers: appApiHeaders });
        }
      } else {
          console.log('/products numérico retornou', altProdResp.status);
        }

        // Fallback: /catalog_products numeric
        if (!resolvedFromCatalog) {
          console.log('Tentando /catalog_products com ID numérico');
          const numericCatalogResp = await fetch(
            `https://api.mercadolibre.com/catalog_products/${numericId}`,
            { headers: appApiHeaders }
          );
          if (numericCatalogResp.ok) {
            catalogData = await numericCatalogResp.json();
            const buyBoxItemId2 = catalogData?.buy_box_winner?.item_id || catalogData?.items?.[0]?.id;
            if (buyBoxItemId2) {
              resolvedItemId = buyBoxItemId2;
              source = 'catalog';
              resolvedFromCatalog = true;
              console.log(`Item ${resolvedItemId} resolvido via /catalog_products numérico`);
              productResponse = await fetch(`https://api.mercadolibre.com/items/${resolvedItemId}`, { headers: appApiHeaders });
            }
          } else {
            console.log('/catalog_products numérico retornou', numericCatalogResp.status);
          }
        }

        // Fallback UNIVERSAL: /products/search?status=active
        if (!resolvedFromCatalog) {
          console.log(`Tentando busca universal: /products/search?status=active&site_id=MLB&q=${numericId}`);
          const searchCatalog = await fetch(
            `https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=${numericId}`,
            { headers: appApiHeaders }
          );
          if (searchCatalog.ok) {
            const searchJson = await searchCatalog.json();
            console.log(`Busca universal retornou ${searchJson.paging?.total || 0} resultados`);
            
            if (searchJson.paging?.total > 0 && searchJson.results?.[0]?.id) {
              const catId = searchJson.results[0].id;
              console.log('Catálogo encontrado via search universal:', catId);
              
              // Buscar o catálogo completo
              const catalogFullResp = await fetch(
                `https://api.mercadolibre.com/products/${catId}`,
                { headers: appApiHeaders }
              );
              
              if (catalogFullResp.ok) {
                catalogData = await catalogFullResp.json();
                const buyBoxItemId3 = catalogData?.buy_box_winner?.item_id || catalogData?.items?.[0]?.id;
                if (buyBoxItemId3) {
                  resolvedItemId = buyBoxItemId3;
                  source = 'catalog';
                  resolvedFromCatalog = true;
                  console.log(`Item ${resolvedItemId} resolvido via search universal`);
                  productResponse = await fetch(`https://api.mercadolibre.com/items/${resolvedItemId}`, { headers: appApiHeaders });
                }
              }
            }
          } else {
            console.log('Busca universal retornou', searchCatalog.status);
          }
        }
      }

      // 2) Tentativa via /catalog_products
      if (!resolvedFromCatalog) {
        const catalogResponse = await fetch(
          `https://api.mercadolibre.com/catalog_products/${originalProductId}`,
          { headers: appApiHeaders }
        );

        if (catalogResponse.ok) {
          catalogData = await catalogResponse.json();

          const catalogItemsResponse = await fetch(
            `https://api.mercadolibre.com/catalog_products/${originalProductId}/items`,
            { headers: appApiHeaders }
          );

          if (catalogItemsResponse.ok) {
            const catalogItemsJson = await catalogItemsResponse.json();
            const candidateItemId = Array.isArray(catalogItemsJson)
              ? catalogItemsJson[0]
              : catalogItemsJson?.results?.[0]?.id || catalogItemsJson?.items?.[0]?.id;

            if (candidateItemId) {
              resolvedItemId = candidateItemId;
              source = 'catalog';
              resolvedFromCatalog = true;
              console.log(`Usando item ${resolvedItemId} obtido via /catalog_products items.`);
            }
          }
        } else {
          console.log(`Endpoint /catalog_products retornou ${catalogResponse.status}.`);
        }
      }

      if (resolvedFromCatalog) {
        productResponse = await fetch(
          `https://api.mercadolivre.com/items/${resolvedItemId}`,
          { headers: appApiHeaders }
        );
      }

      // 3) Fallback final: search por product_id
      if (!productResponse.ok) {
        console.log('Tentativas via catálogo falharam. Buscando anúncios com search?product_id...');

        const searchResponse = await fetch(
          `https://api.mercadolibre.com/sites/MLB/search?product_id=${originalProductId}&limit=10`,
          { headers: appApiHeaders }
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const firstResult = searchData.results?.find((item: any) => item?.id);

          if (firstResult?.id) {
            resolvedItemId = firstResult.id;
            source = 'search';
            console.log(`Anúncio encontrado via search: ${resolvedItemId}`);

            productResponse = await fetch(
              `https://api.mercadolivre.com/items/${resolvedItemId}`,
              { headers: appApiHeaders }
            );
          } else {
            throw new Error(`Produto ${originalProductId} não encontrado ou sem anúncios ativos.`);
          }
        }
      }

      if (!productResponse.ok) {
        const finalStatus = productResponse.status;
        const finalBody = await productResponse.text();
        
        // Log estruturado completo para depuração
        console.error('Falha final ao buscar produto', {
          status: finalStatus,
          body: finalBody,
          triedItem: resolvedItemId,
          original: originalProductId,
          sourcePath: source,
          hadCatalogData: !!catalogData
        });
        
        if (finalStatus === 404) {
          throw new Error(`Catálogo ou anúncio não encontrado (ID ${originalProductId}). Verifique se o produto é de catálogo ativo.`);
        }
        
        throw new Error(`Erro ao buscar produto no Mercado Livre (Status ${finalStatus})`);
      }
    }

    const product = await productResponse.json();
    
    console.log('📦 Dados brutos do produto recebido da API:');
    console.log({
      id: product.id,
      title: product.title?.substring(0, 50),
      price: product.price,
      sold_quantity: product.sold_quantity,
      available_quantity: product.available_quantity,
      seller_id: product.seller_id,
      catalog_product_id: product.catalog_product_id,
      category_id: product.category_id,
      condition: product.condition,
      permalink: product.permalink?.substring(0, 60)
    });
    
    // VERIFICAÇÃO CRÍTICA: Se price está undefined/null, algo está muito errado
    if (!product.price && product.price !== 0) {
      console.error('❌ CRÍTICO: Produto não tem preço! Resposta pode estar incompleta');
      console.log('Produto completo:', JSON.stringify(product).substring(0, 500));
    }

    // Buscar descrição completa
    let description = '';
    try {
      const descResponse = await fetch(
        `https://api.mercadolibre.com/items/${resolvedItemId}/description`,
        { headers: appApiHeaders }
      );
      if (descResponse.ok) {
        const descData = await descResponse.json();
        description = descData.plain_text || '';
      }
    } catch (error) {
      console.log('Erro ao buscar descrição:', error);
    }

    // Extrair marca
    const brand = product.attributes?.find((a: any) => a.id === 'BRAND')?.value_name;

    // Buscar informações do vendedor do item selecionado
    const sellerResponse = await fetch(
      `https://api.mercadolibre.com/users/${product.seller_id}`,
      { headers: appApiHeaders }
    );
    const sellerData = sellerResponse.ok ? await sellerResponse.json() : null;

    // Garantir dados do produto de catálogo para enriquecer resposta
    const catalogProductId = catalogData?.id || catalogData?.product_id || product.catalog_product_id || originalProductId;
    if (!catalogData && product.catalog_product_id) {
      const catalogProductInfo = await fetch(
        `https://api.mercadolibre.com/products/${product.catalog_product_id}`,
        { headers: appApiHeaders }
      );
      if (catalogProductInfo.ok) {
        catalogData = await catalogProductInfo.json();
      }
    }

    let competitors: CompetitorInfo[] = [];
    
    // CRÍTICO: Usar token de usuário para buscar competidores (search requer autenticação)
    const searchHeaders = userApiHeaders || appApiHeaders;
    console.log(`🔑 Usando headers para busca de competidores:`, { 
      isUserToken: !!userApiHeaders,
      hasAuth: !!searchHeaders?.['Authorization']
    });
    
    if (catalogProductId) {
      // Se tem catalog_product_id, buscar competidores do catálogo
      console.log(`📊 Buscando competidores do catálogo: ${catalogProductId}`);
      competitors = await fetchCatalogCompetitors(catalogProductId, resolvedItemId, searchHeaders);
      console.log(`✅ Competidores do catálogo encontrados: ${competitors.length}`);
    } else {
      // Se NÃO tem catalog_product_id, buscar competidores similares por título/categoria
      console.log('⚠️ Item sem catalog_product_id. Buscando competidores por título...');
      competitors = await fetchSimilarItems(product.title, product.category_id, resolvedItemId, searchHeaders);
      console.log(`✅ Competidores similares encontrados: ${competitors.length}`);
    }

    const winningOffer = competitors.find((comp) => comp.item_id === resolvedItemId);
    console.log('🏆 Winning offer:', winningOffer ? `ID ${winningOffer.item_id}, Preço ${winningOffer.price}` : 'Não encontrado');

    // Visitas reais (quando possível) ou estimativa baseada em vendas
    let dailyVisits = 0;
    let monthlyVisits = 0;
    let visitsSource = 'estimated';

    // 1. Tentar buscar visitas totais dos últimos 2 anos (endpoint público que funciona com app token)
    try {
      const totalVisitsResponse = await fetch(
        `https://api.mercadolibre.com/visits/items?ids=${resolvedItemId}`,
        { headers: appApiHeaders }
      );
      
      if (totalVisitsResponse.ok) {
        const totalVisitsData = await totalVisitsResponse.json();
        const totalVisits = totalVisitsData[resolvedItemId];
        
        if (typeof totalVisits === 'number' && totalVisits > 0) {
          // Visitas dos últimos 2 anos - calcular média mensal e diária
          monthlyVisits = Math.round(totalVisits / 24); // Dividir por 24 meses
          dailyVisits = Math.round(monthlyVisits / 30);
          visitsSource = 'total_2years';
          console.log(`✅ Visitas obtidas via /visits/items: ${totalVisits} (últimos 2 anos)`);
        }
      }
    } catch (error) {
      console.log('⚠️ Erro ao buscar visitas totais:', error);
    }

    // 2. Se temos token de usuário, tentar buscar visitas detalhadas dos últimos 30 dias
    if (userApiHeaders && visitsSource === 'estimated') {
      const visitsOverview = await fetchItemVisitsOverview(resolvedItemId, userApiHeaders);
    if (visitsOverview) {
      dailyVisits = visitsOverview.dailyAverage;
      monthlyVisits = visitsOverview.last30;
        visitsSource = 'time_window';
        console.log(`✅ Visitas obtidas via /visits/time_window: ${monthlyVisits} (últimos 30 dias)`);
      }
    }

    // 3. Fallback: usar visitas dos concorrentes se disponível
    if (visitsSource === 'estimated' && winningOffer?.visits_total) {
      monthlyVisits = Math.round(winningOffer.visits_total / 24); // Dividir por 24 meses
      dailyVisits = Math.round(monthlyVisits / 30);
      visitsSource = 'competitor';
      console.log(`✅ Visitas obtidas via concorrente: ${winningOffer.visits_total} (últimos 2 anos)`);
    }

    // 4. Último fallback: estimativa baseada em vendas
    if (visitsSource === 'estimated') {
      dailyVisits = estimateVisits(product.sold_quantity, product.category_id);
      monthlyVisits = dailyVisits * 30;
      console.log(`⚠️ Usando estimativa de visitas baseada em vendas: ${monthlyVisits}/mês`);
    }

    const conversionRate = product.sold_quantity > 0 && monthlyVisits > 0
      ? (product.sold_quantity / monthlyVisits) * 100
      : 0;

    // Montar resposta
    const productDetails: ProductDetails = {
      id: product.id,
      resolved_item_id: resolvedItemId,
      original_product_id: originalProductId,
      catalog_product_id: catalogData?.id || catalogData?.product_id,
      title: product.title,
      price: winningOffer?.price ?? product.price,
      description: description || 'Sem descrição disponível',
      brand: brand,
      category_id: product.category_id,
      sold_quantity: product.sold_quantity || 0,
      available_quantity: product.available_quantity || 0,
      condition: product.condition,
      permalink: product.permalink,
      thumbnail: product.thumbnail,
      pictures: (product.pictures && product.pictures.length > 0 ? product.pictures : catalogData?.pictures) || [],
      
      // Métricas estimadas
      daily_visits: Math.round(dailyVisits),
      monthly_visits: Math.round(monthlyVisits),
      conversion_rate: parseFloat(conversionRate.toFixed(2)),
      
      // Dados do vendedor
      seller: {
        id: product.seller_id,
        reputation: sellerData?.seller_reputation?.level_id || 'unknown',
        sales: sellerData?.seller_reputation?.transactions?.completed || 0
      },
      
      // Concorrentes
      competitors: competitors,
      catalog_data: catalogData,
      source
    };

    console.log('Produto encontrado:', productDetails.title);
    console.log('📊 Resumo dos dados finais:', {
      price: productDetails.price,
      sold_quantity: productDetails.sold_quantity,
      daily_visits: productDetails.daily_visits,
      monthly_visits: productDetails.monthly_visits,
      competitors_count: productDetails.competitors?.length || 0,
      visits_source: visitsSource
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: productDetails
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});

// Função auxiliar para extrair ID do produto do link
function normalizeProductId(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  // Handle full URLs first
  if (trimmed.toLowerCase().startsWith('http')) {
    const match = trimmed.match(/(ML[ABM]-?\d+)/i);
    if (match && match[1]) {
      return match[1].toUpperCase().replace('-', '');
    }
    // If no ID found in URL, it's not a format we can handle automatically.
    return null;
  }

  // Handle IDs with hyphens, e.g., MLB-12345678
  const hyphenMatch = trimmed.match(/^(ML[ABM])-(\d+)$/i);
  if (hyphenMatch && hyphenMatch[1] && hyphenMatch[2]) {
    return `${hyphenMatch[1].toUpperCase()}${hyphenMatch[2]}`;
  }

  // Handle standard IDs, e.g., MLB12345678
  if (/^ML[ABM]\d+$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Handle numeric-only IDs, assuming 'MLB' prefix
  if (/^\d+$/.test(trimmed)) {
    return `MLB${trimmed}`;
  }

  // If it's none of the above, it's an invalid format
  return null;
}

async function fetchItemVisitsOverview(itemId: string, headers: HeadersInit): Promise<{ last30: number; dailyAverage: number } | null> {
  try {
    const visitsResponse = await fetch(
      `https://api.mercadolibre.com/items/${itemId}/visits/time_window?last=30&unit=day`,
      { headers }
    );

    if (!visitsResponse.ok) {
      return null;
    }

    const visitsJson = await visitsResponse.json();

    if (!Array.isArray(visitsJson?.results)) {
      return null;
    }

    const totalVisits = visitsJson.results.reduce((acc: number, entry: any) => {
      const value = typeof entry === 'number' ? entry : entry?.visits ?? entry?.value ?? 0;
      return acc + (typeof value === 'number' ? value : 0);
    }, 0);

    const daysCount = visitsJson.results.length || 1;

    return {
      last30: totalVisits,
      dailyAverage: totalVisits / daysCount,
    };
  } catch (error) {
    console.log('Erro ao buscar visitas detalhadas:', error);
    return null;
  }
}

async function fetchCatalogCompetitors(
  catalogProductId: string,
  winningItemId: string,
  headers: HeadersInit
): Promise<CompetitorInfo[]> {
  try {
    console.log(`🔍 Buscando competidores para catalog_product_id: ${catalogProductId}`);
    
    let itemIds: string[] = [];
    let catalogInfo: any = null;
    
    // SEMPRE buscar info do catálogo primeiro (precisamos do nome para buscar)
    const catalogInfoResponse = await fetch(
      `https://api.mercadolibre.com/products/${catalogProductId}`,
      { headers }
    );

    if (catalogInfoResponse.ok) {
      catalogInfo = await catalogInfoResponse.json();
      console.log(`📦 Catálogo encontrado: ${catalogInfo.name}`);
    } else {
      console.log(`❌ Não foi possível buscar info do catálogo: ${catalogInfoResponse.status}`);
      return [];
    }

    // ESTRATÉGIA ALTERNATIVA: Como /search retorna 403, vamos usar outros endpoints públicos
    console.log('🔍 Usando estratégia alternativa para buscar itens do catálogo...');
    
    // Método 1: Tentar buscar via /catalog_listing (endpoint de listagem de catálogo)
    if (itemIds.length === 0 && catalogInfo) {
      console.log(`🔄 Tentando /catalog_listing para ${catalogProductId}...`);
      
      try {
        const catalogListingResponse = await fetch(
          `https://api.mercadolibre.com/products/${catalogProductId}/catalog_listing`,
          { headers }
        );
        
        if (catalogListingResponse.ok) {
          const listingData = await catalogListingResponse.json();
          console.log(`✅ catalog_listing retornou:`, listingData);
          
          if (listingData.items && Array.isArray(listingData.items)) {
            itemIds = listingData.items
              .map((item: any) => typeof item === 'string' ? item : item?.id)
              .filter((id: any): id is string => typeof id === 'string');
            console.log(`✅ Encontrados ${itemIds.length} via catalog_listing`);
          }
        } else {
          console.log(`⚠️ catalog_listing retornou ${catalogListingResponse.status}`);
        }
      } catch (e) {
        console.log('⚠️ Erro ao tentar catalog_listing:', e.message);
      }
    }
    
    // Método 2: Buscar itens fazendo multiget dos reviews/opiniões do produto
    // (Workaround criativo: reviews de produtos geralmente listam item_ids)
    if (itemIds.length === 0 && catalogInfo) {
      console.log(`🔄 Tentando buscar via reviews/product_reviews...`);
      
      try {
        const reviewsResponse = await fetch(
          `https://api.mercadolibre.com/reviews/product/${catalogProductId}?limit=10`,
          { headers }
        );
        
        if (reviewsResponse.ok) {
          const reviewsData = await reviewsResponse.json();
          console.log(`✅ Reviews retornou ${reviewsData.reviews?.length || 0} avaliações`);
          
          if (reviewsData.reviews && Array.isArray(reviewsData.reviews)) {
            const itemIdsFromReviews = reviewsData.reviews
              .map((review: any) => review?.item_id)
              .filter((id: any): id is string => typeof id === 'string');
            
            if (itemIdsFromReviews.length > 0) {
              itemIds = Array.from(new Set(itemIdsFromReviews));
              console.log(`✅ Encontrados ${itemIds.length} item_ids via reviews`);
            }
          }
        } else {
          console.log(`⚠️ Reviews retornou ${reviewsResponse.status}`);
        }
      } catch (e) {
        console.log('⚠️ Erro ao buscar reviews:', e.message);
      }
    }
    
    // Método 3: ÚLTIMO RECURSO - Buscar título SEM filtros e aceitar os primeiros resultados
    if (itemIds.length === 0 && catalogInfo && catalogInfo.name) {
      console.log('🔄 ÚLTIMO RECURSO: Busca ampla por título...');
      
      // Pegar apenas palavras-chave principais (marca + primeiras palavras)
      const keywords = catalogInfo.name
        .split(' ')
        .slice(0, 4) // Apenas primeiras 4 palavras
        .join(' ');
      
      const searchQuery = encodeURIComponent(keywords);
      console.log(`🔍 Palavras-chave: ${keywords}`);
      
      try {
        // Tentar busca SEM token (totalmente pública)
        const publicSearchResponse = await fetch(
          `https://api.mercadolibre.com/sites/MLB/search?q=${searchQuery}&limit=20`
        );
        
        console.log(`📊 Busca pública retornou: ${publicSearchResponse.status}`);
        
        if (publicSearchResponse.ok) {
          const searchJson = await publicSearchResponse.json();
          console.log(`✅ Resultados públicos: ${searchJson.results?.length || 0}`);
          
          // Pegar apenas os primeiros 10 mais relevantes
          itemIds = (searchJson.results || [])
            .slice(0, 10)
            .map((item: any) => item?.id)
            .filter((id: any): id is string => typeof id === 'string');
          
          console.log(`✅ Usando ${itemIds.length} itens da busca pública`);
        }
      } catch (e) {
        console.log('❌ Erro na busca pública:', e.message);
      }
    }

    if (itemIds.length === 0) {
      console.log('❌ Nenhum item encontrado após todas as tentativas');
      return [];
    }

    console.log(`📦 Total de ${itemIds.length} itens para processar`);

    const uniqueIds = Array.from(new Set(itemIds)).slice(0, 40);

    // Buscar detalhes dos itens (multi-get)
    let itemsDetail: any[] = [];
    try {
      const detailsResponse = await fetch(
        `https://api.mercadolibre.com/items?ids=${uniqueIds.join(',')}`,
        { headers }
      );
      if (detailsResponse.ok) {
        itemsDetail = await detailsResponse.json();
      } else {
        console.log('Erro ao buscar detalhes dos itens:', detailsResponse.status);
      }
    } catch (error) {
      console.log('Erro ao buscar detalhes dos itens:', error);
    }

    // Buscar visitas totais
    const visitsMap = new Map<string, number>();
    try {
      const visitsResponse = await fetch(
        `https://api.mercadolibre.com/visits/items?ids=${uniqueIds.join(',')}`,
        { headers }
      );
      if (visitsResponse.ok) {
        const visitsJson = await visitsResponse.json();
        if (visitsJson && typeof visitsJson === 'object') {
          for (const key of Object.keys(visitsJson)) {
            const value = visitsJson[key];
            if (typeof value === 'number') {
              visitsMap.set(key, value);
            } else if (value && typeof value === 'object') {
              const total = value.total ?? value.visits ?? 0;
              visitsMap.set(key, typeof total === 'number' ? total : 0);
            }
          }
        }
      }
    } catch (error) {
      console.log('Erro ao buscar visitas dos itens:', error);
    }

    // Buscar reputação dos vendedores (limitado para evitar excesso de chamadas)
    const sellerIds = Array.from(new Set(
      itemsDetail
        .map((entry: any) => entry?.body?.seller_id)
        .filter((id: any): id is number => typeof id === 'number')
    )).slice(0, 15);

    const sellerReputationMap = new Map<number, string>();
    await Promise.all(
      sellerIds.map(async (sellerId) => {
        try {
          const sellerResp = await fetch(
            `https://api.mercadolibre.com/users/${sellerId}`,
            { headers }
          );
          if (sellerResp.ok) {
            const sellerJson = await sellerResp.json();
            sellerReputationMap.set(sellerId, sellerJson?.seller_reputation?.level_id || 'unknown');
          }
        } catch (error) {
          console.log('Erro ao buscar reputação do vendedor', sellerId, error);
        }
      })
    );

    return itemsDetail
      .map((entry: any) => entry?.body)
      .filter(Boolean)
      .map((body: any) => {
        const competitor: CompetitorInfo = {
          item_id: body.id,
          seller_id: body.seller_id,
          price: body.price,
          available_quantity: body.available_quantity,
          sold_quantity: body.sold_quantity,
          listing_type: body.listing_type_id,
          shipping: body.shipping ? {
            logistic_type: body.shipping.logistic_type,
            mode: body.shipping.mode,
            free_shipping: body.shipping.free_shipping,
          } : undefined,
          visits_total: visitsMap.get(body.id),
          reputation: sellerReputationMap.get(body.seller_id) || 'unknown',
          is_buy_box_winner: body.id === winningItemId,
        };

        return competitor;
      });
  } catch (error) {
    console.log('Erro ao buscar competidores do catálogo:', error);
    return [];
  }
}

// Função para buscar itens similares (quando não há catalog_product_id)
async function fetchSimilarItems(
  title: string,
  categoryId: string,
  currentItemId: string,
  headers: HeadersInit
): Promise<CompetitorInfo[]> {
  try {
    console.log(`🔍 Buscando itens similares para: ${title.substring(0, 50)}`);
    
    // Buscar por título na mesma categoria
    const searchQuery = encodeURIComponent(title.substring(0, 60));
    const searchResponse = await fetch(
      `https://api.mercadolibre.com/sites/MLB/search?q=${searchQuery}&category=${categoryId}&limit=20`,
      { headers }
    );

    if (!searchResponse.ok) {
      console.log('Erro ao buscar itens similares:', searchResponse.status);
      return [];
    }

    const searchJson = await searchResponse.json();
    const itemIds = searchJson.results
      ?.map((item: any) => item?.id)
      .filter((id: any): id is string => typeof id === 'string' && id !== currentItemId) || [];

    if (itemIds.length === 0) {
      console.log('Nenhum item similar encontrado');
      return [];
    }

    console.log(`✅ Encontrados ${itemIds.length} itens similares`);

    const uniqueIds = Array.from(new Set(itemIds)).slice(0, 20);

    // Buscar detalhes dos itens (multi-get)
    let itemsDetail: any[] = [];
    try {
      const detailsResponse = await fetch(
        `https://api.mercadolibre.com/items?ids=${uniqueIds.join(',')}`,
        { headers }
      );
      if (detailsResponse.ok) {
        itemsDetail = await detailsResponse.json();
      }
    } catch (error) {
      console.log('Erro ao buscar detalhes dos itens similares:', error);
    }

    // Buscar visitas totais
    const visitsMap = new Map<string, number>();
    try {
      const visitsResponse = await fetch(
        `https://api.mercadolibre.com/visits/items?ids=${uniqueIds.join(',')}`,
        { headers }
      );
      if (visitsResponse.ok) {
        const visitsJson = await visitsResponse.json();
        if (visitsJson && typeof visitsJson === 'object') {
          for (const key of Object.keys(visitsJson)) {
            const value = visitsJson[key];
            if (typeof value === 'number') {
              visitsMap.set(key, value);
            }
          }
        }
      }
    } catch (error) {
      console.log('Erro ao buscar visitas dos itens similares:', error);
    }

    return itemsDetail
      .map((entry: any) => entry?.body)
      .filter(Boolean)
      .map((body: any) => {
        const competitor: CompetitorInfo = {
          item_id: body.id,
          seller_id: body.seller_id,
          price: body.price,
          available_quantity: body.available_quantity,
          sold_quantity: body.sold_quantity,
          listing_type: body.listing_type_id,
          shipping: body.shipping ? {
            logistic_type: body.shipping.logistic_type,
            mode: body.shipping.mode,
            free_shipping: body.shipping.free_shipping,
          } : undefined,
          visits_total: visitsMap.get(body.id),
          reputation: 'unknown',
          is_buy_box_winner: body.id === currentItemId,
        };

        return competitor;
      });
  } catch (error) {
    console.log('Erro ao buscar itens similares:', error);
    return [];
  }
}

// Função para estimar visitas baseado em vendas e categoria
function estimateVisits(soldQuantity: number, categoryId: string): number {
  // Taxa de conversão média por categoria (estimativa)
  const conversionRates: Record<string, number> = {
    'MLB1051': 0.03,  // Celulares (alta conversão)
    'MLB1648': 0.025, // Informática
    'MLB1276': 0.02,  // Esportes
    'MLB1367': 0.015, // Casa e Decoração
    'default': 0.02   // Média geral
  };

  const rate = conversionRates[categoryId] || conversionRates['default'];
  
  // Estimar visitas necessárias para as vendas atuais
  // Assumindo vendas nos últimos 30 dias
  const monthlyVisits = soldQuantity > 0 ? soldQuantity / rate : 100;
  
  return monthlyVisits / 30; // Visitas diárias
}

