-- Update function with proper search_path
CREATE OR REPLACE FUNCTION sync_milestone_template_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert new milestones for all students using this journey template
  INSERT INTO public.milestones (
    journey_id,
    template_id,
    title,
    description,
    phase,
    order_index,
    status
  )
  SELECT 
    sj.id,
    NEW.id,
    NEW.title,
    NEW.description,
    NEW.phase,
    NEW.order_index,
    'not_started'
  FROM public.student_journeys sj
  WHERE sj.id IN (
    SELECT sj2.id
    FROM public.student_journeys sj2
    WHERE NOT EXISTS (
      SELECT 1 FROM public.milestones m 
      WHERE m.journey_id = sj2.id
    )
    OR sj2.id IN (
      SELECT DISTINCT m2.journey_id
      FROM public.milestones m2
      JOIN public.milestone_templates mt ON m2.template_id = mt.id
      WHERE mt.journey_template_id = NEW.journey_template_id
    )
  );
  
  RETURN NEW;
END;
$$;

-- Update function with proper search_path
CREATE OR REPLACE FUNCTION sync_milestone_template_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.milestones
  SET 
    title = NEW.title,
    description = NEW.description,
    phase = NEW.phase,
    order_index = NEW.order_index,
    updated_at = now()
  WHERE template_id = NEW.id
    AND status = 'not_started';
  
  RETURN NEW;
END;
$$;

-- Update function with proper search_path
CREATE OR REPLACE FUNCTION sync_milestone_template_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.milestones
  WHERE template_id = OLD.id
    AND status IN ('not_started', 'in_progress');
  
  RETURN OLD;
END;
$$;

-- Update function with proper search_path
CREATE OR REPLACE FUNCTION initialize_student_milestones_from_templates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.milestones
  SET template_id = subquery.mt_id
  FROM (
    SELECT m.id as milestone_id, mt.id as mt_id
    FROM public.milestones m
    JOIN public.milestone_templates mt ON (
      m.title = mt.title
      AND m.phase = mt.phase
      AND m.order_index = mt.order_index
    )
    WHERE m.template_id IS NULL
  ) AS subquery
  WHERE milestones.id = subquery.milestone_id;
END;
$$;