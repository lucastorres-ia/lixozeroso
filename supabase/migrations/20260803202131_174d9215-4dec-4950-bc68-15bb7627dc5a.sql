-- roles
CREATE TYPE public.app_role AS ENUM ('admin', 'aluno');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Usuarios veem seus papeis" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins gerenciam papeis" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- salas
CREATE TABLE public.salas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  turno text NOT NULL DEFAULT 'Manhã',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.salas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salas TO authenticated;
GRANT ALL ON public.salas TO service_role;
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Salas visiveis a todos" ON public.salas FOR SELECT USING (true);
CREATE POLICY "Admins gerenciam salas" ON public.salas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- materiais
CREATE TABLE public.materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  unidade text NOT NULL DEFAULT 'kg',
  pontos_por_unidade numeric NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.materiais TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais TO authenticated;
GRANT ALL ON public.materiais TO service_role;
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Materiais visiveis a todos" ON public.materiais FOR SELECT USING (true);
CREATE POLICY "Admins gerenciam materiais" ON public.materiais
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  nome text NOT NULL DEFAULT '',
  sala_id uuid REFERENCES public.salas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver proprio perfil" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Criar proprio perfil" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Atualizar proprio perfil" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins removem perfis" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, sala_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'sala_id', '')::uuid
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'aluno')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- coletas
CREATE TYPE public.coleta_status AS ENUM ('pendente', 'aprovada', 'rejeitada');

CREATE TABLE public.coletas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sala_id uuid NOT NULL REFERENCES public.salas(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materiais(id) ON DELETE RESTRICT,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  pontos numeric NOT NULL DEFAULT 0,
  status public.coleta_status NOT NULL DEFAULT 'pendente',
  observacao text,
  avaliado_por uuid,
  avaliado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coletas TO authenticated;
GRANT ALL ON public.coletas TO service_role;
ALTER TABLE public.coletas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver proprias coletas" ON public.coletas
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Registrar coleta propria" ON public.coletas
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins atualizam coletas" ON public.coletas
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins excluem coletas" ON public.coletas
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.coletas_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fator numeric;
BEGIN
  SELECT pontos_por_unidade INTO fator FROM public.materiais WHERE id = NEW.material_id;
  NEW.pontos := ROUND(COALESCE(fator, 0) * NEW.quantidade, 2);
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pendente';
    NEW.avaliado_por := NULL;
    NEW.avaliado_em := NULL;
  ELSIF NEW.status <> OLD.status THEN
    NEW.avaliado_por := auth.uid();
    NEW.avaliado_em := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER coletas_write BEFORE INSERT OR UPDATE ON public.coletas
FOR EACH ROW EXECUTE FUNCTION public.coletas_before_write();

-- ranking publico
CREATE OR REPLACE FUNCTION public.ranking_salas()
RETURNS TABLE (sala_id uuid, sala_nome text, turno text, pontos numeric, total_coletas bigint, quantidade_total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.nome, s.turno,
         COALESCE(SUM(c.pontos), 0)::numeric,
         COUNT(c.id),
         COALESCE(SUM(c.quantidade), 0)::numeric
  FROM public.salas s
  LEFT JOIN public.coletas c ON c.sala_id = s.id AND c.status = 'aprovada'
  GROUP BY s.id, s.nome, s.turno
  ORDER BY 4 DESC, s.nome ASC;
$$;
GRANT EXECUTE ON FUNCTION public.ranking_salas() TO anon, authenticated;

-- primeiro admin
CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin')
  ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_admin() TO authenticated;

INSERT INTO public.materiais (nome, unidade, pontos_por_unidade) VALUES
  ('Tampinhas plásticas', 'kg', 10),
  ('Óleo usado', 'L', 8),
  ('Papel', 'kg', 2),
  ('Plástico', 'kg', 3),
  ('Metal', 'kg', 5),
  ('Vidro', 'kg', 2),
  ('Coleta geral', 'kg', 1);

INSERT INTO public.salas (nome, turno) VALUES
  ('6º A', 'Manhã'), ('6º B', 'Manhã'), ('7º A', 'Manhã'),
  ('8º A', 'Tarde'), ('9º A', 'Tarde');