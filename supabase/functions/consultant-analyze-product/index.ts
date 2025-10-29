// Edge Function: consultant-analyze-product
// Analisa produto usando OpenAI com base na persona escolhida

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      personaSlug, 
      productData, 
      productCost,
      studentId 
    } = await req.json();

    console.log('Iniciando análise:', { personaSlug, studentId });

    // Validações
    if (!personaSlug || !productData || !productCost || !studentId) {
      throw new Error('Dados incompletos');
    }

    // Criar cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar persona
    const { data: persona, error: personaError } = await supabaseClient
      .from('consultant_personas')
      .select('*')
      .eq('slug', personaSlug)
      .eq('is_active', true)
      .single();

    if (personaError || !persona) {
      throw new Error('Persona não encontrada');
    }

    console.log('Persona encontrada:', persona.name);

    // ===== CÁLCULOS FINANCEIROS =====
    const sellingPrice = productData.price;
    const mlFee = sellingPrice * 0.16; // Taxa ML ~16%
    const shippingCost = estimateShipping(sellingPrice);
    const packagingCost = 2.50; // Custo médio de embalagem
    const totalCost = productCost + mlFee + shippingCost + packagingCost;
    const netProfit = sellingPrice - totalCost;
    const profitMargin = (netProfit / sellingPrice) * 100;
    const roi = (netProfit / productCost) * 100;

    // ===== ANÁLISE DE CONCORRÊNCIA =====
    const competitorsCount = productData.competitors?.length || 0;
    const avgCompetitorPrice = productData.competitors?.length > 0
      ? productData.competitors.reduce((sum: number, c: any) => sum + c.price, 0) / productData.competitors.length
      : sellingPrice;
    
    const pricePositioning = sellingPrice <= avgCompetitorPrice * 0.9 ? 'Competitivo' :
                            sellingPrice <= avgCompetitorPrice * 1.1 ? 'Médio' : 'Alto';

    // ===== ANÁLISE DE DEMANDA =====
    const demandLevel = productData.sold_quantity > 100 ? 'Alta' :
                       productData.sold_quantity > 30 ? 'Média' : 'Baixa';

    // ===== CONTEXTO PARA A IA =====
    const analysisContext = {
      produto: {
        nome: productData.title,
        marca: productData.brand || 'Sem marca identificada',
        categoria: productData.category_id,
        condicao: productData.condition === 'new' ? 'Novo' : 'Usado',
        preco_venda: `R$ ${sellingPrice.toFixed(2)}`,
        vendas_totais: productData.sold_quantity,
        estoque_disponivel: productData.available_quantity,
        visitas_diarias: productData.daily_visits,
        visitas_mensais: productData.monthly_visits,
        taxa_conversao: `${productData.conversion_rate}%`
      },
      custos: {
        custo_produto: `R$ ${productCost.toFixed(2)}`,
        taxa_mercado_livre: `R$ ${mlFee.toFixed(2)} (16%)`,
        frete_estimado: `R$ ${shippingCost.toFixed(2)}`,
        embalagem: `R$ ${packagingCost.toFixed(2)}`,
        custo_total: `R$ ${totalCost.toFixed(2)}`
      },
      metricas_financeiras: {
        lucro_liquido: `R$ ${netProfit.toFixed(2)}`,
        margem_lucro: `${profitMargin.toFixed(2)}%`,
        roi: `${roi.toFixed(2)}%`,
        ponto_equilibrio: netProfit > 0 ? Math.ceil(totalCost / netProfit) : 'N/A'
      },
      analise_mercado: {
        nivel_demanda: demandLevel,
        numero_concorrentes: competitorsCount,
        preco_medio_concorrentes: `R$ ${avgCompetitorPrice.toFixed(2)}`,
        posicionamento_preco: pricePositioning,
        reputacao_vendedor: productData.seller?.reputation || 'Desconhecida'
      }
    };

    console.log('Contexto preparado, chamando OpenAI...');

    // ===== CHAMAR OPENAI =====
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: persona.system_prompt
          },
          {
            role: 'user',
            content: `Analise este produto para revenda no Mercado Livre:\n\n${JSON.stringify(analysisContext, null, 2)}\n\nForneça uma análise detalhada seguindo seu perfil ${persona.name}.`
          }
        ],
        temperature: personaSlug === 'conservative' ? 0.3 : 
                     personaSlug === 'balanced' ? 0.5 : 0.7,
        max_tokens: 2000
      })
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('Erro OpenAI:', error);
      throw new Error('Erro ao gerar análise com IA');
    }

    const aiResult = await openaiResponse.json();
    const analysis = aiResult.choices[0].message.content;

    console.log('Análise gerada com sucesso');

    // ===== EXTRAIR RECOMENDAÇÃO =====
    const recommendation = extractRecommendation(analysis, profitMargin, roi, persona.risk_profile);
    const confidenceScore = calculateConfidence(profitMargin, roi, demandLevel, persona.risk_profile);
    const riskScore = calculateRiskScore(profitMargin, demandLevel, competitorsCount);

    // ===== SALVAR NO BANCO =====
    const { data: savedAnalysis, error: saveError } = await supabaseClient
      .from('product_analyses')
      .insert({
        student_id: studentId,
        persona_id: persona.id,
        ml_product_link: productData.permalink,
        ml_product_id: productData.id,
        product_cost: productCost,
        product_data: productData,
        ai_analysis: {
          full_text: analysis,
          context: analysisContext,
          generated_at: new Date().toISOString()
        },
        recommendation: recommendation,
        confidence_score: confidenceScore,
        profit_margin: profitMargin,
        roi_estimation: roi,
        risk_score: riskScore
      })
      .select()
      .single();

    if (saveError) {
      console.error('Erro ao salvar:', saveError);
      throw new Error('Erro ao salvar análise');
    }

    console.log('Análise salva com sucesso:', savedAnalysis.id);

    // ===== RETORNAR RESULTADO =====
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          analysis_id: savedAnalysis.id,
          persona: persona.name,
          recommendation: recommendation,
          confidence_score: confidenceScore,
          analysis_text: analysis,
          key_metrics: {
            profit_margin: profitMargin.toFixed(2),
            roi: roi.toFixed(2),
            net_profit: netProfit.toFixed(2),
            risk_score: riskScore.toFixed(2)
          },
          created_at: savedAnalysis.created_at
        }
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Erro na análise:', error);
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

// ===== FUNÇÕES AUXILIARES =====

function estimateShipping(price: number): number {
  // Estimativa baseada no valor do produto
  if (price < 50) return 15;
  if (price < 100) return 20;
  if (price < 200) return 25;
  if (price < 500) return 35;
  return 45;
}

function extractRecommendation(analysis: string, margin: number, roi: number, riskProfile: string): string {
  // Tentar extrair do texto da análise
  const analysisLower = analysis.toLowerCase();
  
  if (analysisLower.includes('recomendação: comprar') || analysisLower.includes('recomendação:** comprar')) {
    return 'buy';
  }
  if (analysisLower.includes('recomendação: evitar') || analysisLower.includes('recomendação:** evitar')) {
    return 'avoid';
  }
  if (analysisLower.includes('recomendação: considerar') || analysisLower.includes('recomendação:** considerar')) {
    return 'consider';
  }

  // Fallback: decidir baseado em métricas e perfil
  if (riskProfile === 'low') {
    if (margin > 30 && roi > 50) return 'buy';
    if (margin > 20 && roi > 30) return 'consider';
    return 'avoid';
  } else if (riskProfile === 'medium') {
    if (margin > 25 && roi > 40) return 'buy';
    if (margin > 15 && roi > 25) return 'consider';
    return 'avoid';
  } else { // high risk
    if (margin > 20 && roi > 30) return 'buy';
    if (margin > 15 && roi > 20) return 'consider';
    return 'avoid';
  }
}

function calculateConfidence(
  margin: number, 
  roi: number, 
  demand: string, 
  riskProfile: string
): number {
  let confidence = 50;

  // Margem de lucro
  if (margin > 40) confidence += 20;
  else if (margin > 30) confidence += 15;
  else if (margin > 20) confidence += 10;
  else if (margin > 10) confidence += 5;
  else confidence -= 10;

  // ROI
  if (roi > 80) confidence += 15;
  else if (roi > 50) confidence += 10;
  else if (roi > 30) confidence += 5;
  else confidence -= 5;

  // Demanda
  if (demand === 'Alta') confidence += 15;
  else if (demand === 'Média') confidence += 5;
  else confidence -= 10;

  // Ajuste por perfil de risco
  if (riskProfile === 'low') {
    confidence = confidence * 0.9; // Conservador é mais cauteloso
  } else if (riskProfile === 'high') {
    confidence = confidence * 1.1; // Arrojado é mais confiante
  }

  // Limitar entre 0 e 100
  return Math.max(0, Math.min(100, confidence));
}

function calculateRiskScore(margin: number, demand: string, competitors: number): number {
  let risk = 50;

  // Margem baixa = maior risco
  if (margin < 15) risk += 20;
  else if (margin < 25) risk += 10;
  else if (margin > 40) risk -= 15;

  // Demanda baixa = maior risco
  if (demand === 'Baixa') risk += 20;
  else if (demand === 'Alta') risk -= 15;

  // Muitos concorrentes = maior risco
  if (competitors > 10) risk += 15;
  else if (competitors < 3) risk -= 10;

  // Limitar entre 0 e 100
  return Math.max(0, Math.min(100, risk));
}

