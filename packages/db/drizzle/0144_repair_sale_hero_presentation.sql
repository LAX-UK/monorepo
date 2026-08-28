DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'sale_hero_presentation'
  ) THEN
    CREATE TYPE public.sale_hero_presentation AS ENUM ('cover', 'video');
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE public.sale
  ADD COLUMN IF NOT EXISTS hero_presentation public.sale_hero_presentation
  NOT NULL DEFAULT 'cover';
--> statement-breakpoint
ALTER TABLE public.sale
  ADD COLUMN IF NOT EXISTS hero_video_url text;
