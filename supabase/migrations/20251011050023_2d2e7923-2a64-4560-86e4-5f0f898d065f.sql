-- Add is_important column to notices table
ALTER TABLE public.notices
ADD COLUMN is_important boolean DEFAULT false;

-- Update existing notices: set is_important=true for high priority notices
UPDATE public.notices
SET is_important = (priority = 'high');