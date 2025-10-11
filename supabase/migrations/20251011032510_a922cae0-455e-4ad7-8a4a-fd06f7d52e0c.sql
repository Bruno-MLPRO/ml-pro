-- Add template_id column to milestones to track which template it came from
ALTER TABLE public.milestones 
ADD COLUMN template_id uuid REFERENCES public.milestone_templates(id) ON DELETE CASCADE;

-- Create function to sync milestone creation
CREATE OR REPLACE FUNCTION sync_milestone_template_insert()
RETURNS TRIGGER AS $$
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
    -- Find all student journeys that should have this template
    SELECT sj2.id
    FROM public.student_journeys sj2
    WHERE NOT EXISTS (
      -- Only insert if the journey doesn't already have milestones (initial setup)
      SELECT 1 FROM public.milestones m 
      WHERE m.journey_id = sj2.id
    )
    OR sj2.id IN (
      -- For existing journeys, check if they have milestones from the same journey template
      SELECT DISTINCT m2.journey_id
      FROM public.milestones m2
      JOIN public.milestone_templates mt ON m2.template_id = mt.id
      WHERE mt.journey_template_id = NEW.journey_template_id
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to sync milestone updates
CREATE OR REPLACE FUNCTION sync_milestone_template_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all student milestones that came from this template
  UPDATE public.milestones
  SET 
    title = NEW.title,
    description = NEW.description,
    phase = NEW.phase,
    order_index = NEW.order_index,
    updated_at = now()
  WHERE template_id = NEW.id
    AND status = 'not_started'; -- Only update milestones that haven't been started
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to sync milestone deletion
CREATE OR REPLACE FUNCTION sync_milestone_template_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all student milestones that came from this template
  -- Only delete if not started or in progress (keep completed ones for history)
  DELETE FROM public.milestones
  WHERE template_id = OLD.id
    AND status IN ('not_started', 'in_progress');
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER on_milestone_template_insert
  AFTER INSERT ON public.milestone_templates
  FOR EACH ROW
  EXECUTE FUNCTION sync_milestone_template_insert();

CREATE TRIGGER on_milestone_template_update
  AFTER UPDATE ON public.milestone_templates
  FOR EACH ROW
  EXECUTE FUNCTION sync_milestone_template_update();

CREATE TRIGGER on_milestone_template_delete
  BEFORE DELETE ON public.milestone_templates
  FOR EACH ROW
  EXECUTE FUNCTION sync_milestone_template_delete();

-- Create function to initialize existing student journeys with templates
CREATE OR REPLACE FUNCTION initialize_student_milestones_from_templates()
RETURNS void AS $$
BEGIN
  -- For each student journey that has milestones, link them to templates
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run initialization for existing data
SELECT initialize_student_milestones_from_templates();