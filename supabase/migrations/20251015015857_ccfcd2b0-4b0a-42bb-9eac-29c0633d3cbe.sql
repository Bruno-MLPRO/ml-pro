-- Normalizar estrutura de goals existentes no banco
-- Atualiza todos os registros de health com data_source='estimated' para a nova estrutura

UPDATE mercado_livre_item_health
SET goals = (
  SELECT jsonb_agg(
    CASE 
      -- Objetivo de Fotos
      WHEN goal->>'id' IN ('improve_photos', 'photos_ok') THEN
        jsonb_build_object(
          'id', goal->>'id',
          'name', goal->>'name',
          'description', goal->>'description',
          'progress', COALESCE((goal->>'progress')::numeric, 0),
          'progress_max', 5,
          'apply', true,
          'status', goal->>'status',
          'type', COALESCE(goal->>'type', 'photos'),
          'completed', goal->>'completed'
        )
      -- Outros objetivos (binários: 0/1)
      ELSE
        jsonb_build_object(
          'id', goal->>'id',
          'name', goal->>'name',
          'description', goal->>'description',
          'progress', CASE 
            WHEN goal->>'status' = 'completed' THEN 1 
            ELSE COALESCE((goal->>'progress')::numeric, 0)
          END,
          'progress_max', 1,
          'apply', true,
          'status', goal->>'status',
          'type', COALESCE(goal->>'type', 'other'),
          'completed', goal->>'completed'
        )
    END
  )
  FROM jsonb_array_elements(goals) AS goal
)
WHERE data_source IN ('estimated', 'api_estimated')
  AND jsonb_typeof(goals) = 'array'
  AND jsonb_array_length(goals) > 0
  -- Apenas atualizar se ainda não tem a estrutura correta
  AND NOT EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(goals) AS g 
    WHERE g ? 'progress' AND g ? 'progress_max' AND g ? 'apply'
  );

-- Log de quantos registros foram atualizados
DO $$
DECLARE
  updated_count integer;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Estrutura de goals normalizada em % registros', updated_count;
END $$;