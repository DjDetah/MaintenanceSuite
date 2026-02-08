-- Add visible column
ALTER TABLE public.regions ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT true;

-- Insert 'Non di Competenza' as hidden region
INSERT INTO public.regions (name, visible)
VALUES ('Non di Competenza', false)
ON CONFLICT (name) DO UPDATE SET visible = false;

-- Ensure all standard regions are visible (optional, as default is true, but good for safety)
UPDATE public.regions SET visible = true WHERE name != 'Non di Competenza';
