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
    const { ml_account_id, ml_item_id } = await req.json()

    if (!ml_account_id || !ml_item_id) {
      return new Response(
        JSON.stringify({ error: 'ml_account_id e ml_item_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Buscar a conta ML
    const { data: account, error: accountError } = await supabase
      .from('mercado_livre_accounts')
      .select('*')
      .eq('id', ml_account_id)
      .single()

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: 'Conta ML não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const accessToken = account.access_token

    // Buscar detalhes do produto
    const itemResponse = await fetch(
      `https://api.mercadolibre.com/items/${ml_item_id}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )

    if (!itemResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Produto não encontrado no Mercado Livre' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const item = await itemResponse.json()
    const pictures = item.pictures || []
    
    console.log(`Processing ${pictures.length} photos for item ${ml_item_id}`)

    const fixedPhotos: Array<{
      old_id: string;
      new_id: string;
      old_size: string;
      new_size: string;
    }> = []
    const errors: Array<{
      photo_id: string;
      error: string;
    }> = []

    for (const picture of pictures) {
      try {
        // Verificar dimensões
        const width = picture.max_size?.split('x')[0] ? parseInt(picture.max_size.split('x')[0]) : 0
        const height = picture.max_size?.split('x')[1] ? parseInt(picture.max_size.split('x')[1]) : 0
        const smallestDimension = Math.min(width, height)

        if (smallestDimension < 1200) {
          console.log(`Photo ${picture.id} needs fixing: ${width}x${height}`)

          // Baixar imagem e processar no servidor usando API de conversão
          // Como Deno não tem canvas nativo, usar uma abordagem mais simples
          
          // Por enquanto, retornar erro informando que precisa ser processado manualmente
          errors.push({
            photo_id: picture.id,
            error: `Foto precisa ser redimensionada: ${width}x${height} → 1200x1200. Use um editor de imagens.`
          })
          
          console.log(`Photo ${picture.id} marked for manual fixing`)
        }
      } catch (error: unknown) {
        console.error(`Error processing photo ${picture.id}:`, error)
        errors.push({
          photo_id: picture.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Atualizar produto se houver fotos corrigidas
    if (fixedPhotos.length > 0) {
      // Substituir fotos antigas pelas novas
      const newPictures = pictures.map((pic: any) => {
        const fixed = fixedPhotos.find((f: any) => f.old_id === pic.id)
        return fixed ? { id: fixed.new_id } : { id: pic.id }
      })

      const updateResponse = await fetch(
        `https://api.mercadolibre.com/items/${ml_item_id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ pictures: newPictures })
        }
      )

      if (!updateResponse.ok) {
        return new Response(
          JSON.stringify({ 
            error: 'Fotos corrigidas mas falha ao atualizar anúncio',
            fixed_photos: fixedPhotos,
            errors 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        fixed_photos: fixedPhotos.length,
        details: fixedPhotos,
        errors: errors.length > 0 ? errors : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error in ml-fix-product-photos:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})