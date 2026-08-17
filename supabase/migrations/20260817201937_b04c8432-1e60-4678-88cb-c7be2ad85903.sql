ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ra text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_ra_unique ON public.profiles (lower(ra)) WHERE ra IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.config_admin (
  id boolean PRIMARY KEY DEFAULT true,
  codigo text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT config_admin_singleton CHECK (id)
);
GRANT ALL ON public.config_admin TO service_role;
ALTER TABLE public.config_admin ENABLE ROW LEVEL SECURITY;
INSERT INTO public.config_admin (id, codigo) VALUES (true, 'LIXOZERO2026') ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.minha_sala()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sala_id FROM public.profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "Ver coletas da minha sala" ON public.coletas;
CREATE POLICY "Ver coletas da minha sala" ON public.coletas FOR SELECT TO authenticated
USING (sala_id IS NOT NULL AND sala_id = public.minha_sala());

DROP POLICY IF EXISTS "Ver colegas da minha sala" ON public.profiles;
CREATE POLICY "Ver colegas da minha sala" ON public.profiles FOR SELECT TO authenticated
USING (sala_id IS NOT NULL AND sala_id = public.minha_sala());

CREATE OR REPLACE FUNCTION public.claim_admin_com_codigo(_codigo text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT EXISTS (SELECT 1 FROM public.config_admin WHERE id AND codigo = _codigo) INTO ok;
  IF NOT ok THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_codigo()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN NULL; END IF;
  SELECT codigo INTO c FROM public.config_admin WHERE id;
  RETURN c;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_admin_codigo(_codigo text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN false; END IF;
  IF length(coalesce(_codigo, '')) < 6 THEN RETURN false; END IF;
  UPDATE public.config_admin SET codigo = _codigo, updated_at = now() WHERE id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, sala_id, ra)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'sala_id', '')::uuid,
    NULLIF(NEW.raw_user_meta_data->>'ra', '')
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'aluno')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;