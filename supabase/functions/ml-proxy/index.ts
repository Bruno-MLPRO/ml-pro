// Edge Function: ml-proxy
// Proxy simples para contornar CORS do Mercado Livre

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ml-authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, authorization } = await req.json();

    if (!url) {
      throw new Error('URL é obrigatória');
    }

    console.log(`📡 Proxy request para: ${url}`);

    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    };

    if (authorization) {
      headers['Authorization'] = authorization;
      console.log('✅ Usando autorização fornecida');
    }

    const response = await fetch(url, { headers });
    
    console.log(`📊 Status: ${response.status}`);

    const data = await response.json();

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        data: data
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Erro no proxy:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

