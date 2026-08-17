DELETE FROM public.user_roles WHERE user_id IN (
  SELECT id FROM public.profiles WHERE nome IN ('Aluno Teste RA', 'Coordenacao Teste')
);
DELETE FROM public.coletas WHERE user_id IN (
  SELECT id FROM public.profiles WHERE nome IN ('Aluno Teste RA', 'Coordenacao Teste')
);
DELETE FROM public.profiles WHERE nome IN ('Aluno Teste RA', 'Coordenacao Teste');