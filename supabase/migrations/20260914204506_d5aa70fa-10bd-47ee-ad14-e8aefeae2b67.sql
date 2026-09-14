ALTER TABLE public.coletas
  ADD COLUMN IF NOT EXISTS foto_path text,
  ADD COLUMN IF NOT EXISTS foto_verificada boolean NOT NULL DEFAULT false;