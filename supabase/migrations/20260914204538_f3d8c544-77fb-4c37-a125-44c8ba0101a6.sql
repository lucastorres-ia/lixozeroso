CREATE POLICY "Enviar foto propria" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'coletas-fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Ver fotos das coletas" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'coletas-fotos');

CREATE POLICY "Remover foto propria ou admin" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'coletas-fotos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));