-- Migrate existing milestones to milestone_templates for Principal journey
DO $$
DECLARE
  principal_journey_id UUID;
  sample_journey_id UUID;
BEGIN
  -- Get the Principal journey template ID
  SELECT id INTO principal_journey_id FROM public.journey_templates WHERE name = 'Principal';
  
  -- Get a sample student journey to copy milestones from
  SELECT id INTO sample_journey_id FROM public.student_journeys LIMIT 1;
  
  -- Insert milestone templates from existing milestones
  IF sample_journey_id IS NOT NULL THEN
    INSERT INTO public.milestone_templates (journey_template_id, title, description, phase, order_index)
    SELECT 
      principal_journey_id,
      title,
      description,
      phase,
      order_index
    FROM public.milestones
    WHERE journey_id = sample_journey_id
    ORDER BY order_index
    ON CONFLICT DO NOTHING;
  END IF;
END $$;