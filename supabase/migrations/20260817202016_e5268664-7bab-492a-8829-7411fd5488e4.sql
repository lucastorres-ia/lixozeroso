REVOKE EXECUTE ON FUNCTION public.claim_admin_com_codigo(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_codigo() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_admin_codigo(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.minha_sala() FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;