-- Remove tag column and add color column to apps_extensions
ALTER TABLE public.apps_extensions DROP COLUMN IF EXISTS tag;
ALTER TABLE public.apps_extensions ADD COLUMN color TEXT DEFAULT '#3B82F6';