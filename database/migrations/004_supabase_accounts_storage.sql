-- Supabase only. The server remains the sole writer of profiles/business ownership.
CREATE OR REPLACE FUNCTION public.bizflow_email_verified()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid()
      AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL
      AND (banned_until IS NULL OR banned_until <= now())) $$;
REVOKE ALL ON FUNCTION public.bizflow_email_verified() FROM public;
GRANT EXECUTE ON FUNCTION public.bizflow_email_verified() TO authenticated;

CREATE OR REPLACE FUNCTION public.bizflow_is_member(target_business text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT public.bizflow_email_verified() AND EXISTS (
  SELECT 1 FROM public.business_memberships m
  JOIN public.users u ON u.id = m.user_id
  JOIN public.businesses b ON b.id = m.business_id
  WHERE m.business_id = target_business AND m.user_id = auth.uid()::text
    AND NULLIF(u.full_name, '') IS NOT NULL
    AND NULLIF(b.industry, '') IS NOT NULL AND NULLIF(b.city, '') IS NOT NULL) $$;
REVOKE ALL ON FUNCTION public.bizflow_is_member(text) FROM public;
GRANT EXECUTE ON FUNCTION public.bizflow_is_member(text) TO authenticated;

DROP POLICY IF EXISTS user_self_read ON public.users;
CREATE POLICY user_self_read ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid()::text AND public.bizflow_email_verified());
DROP POLICY IF EXISTS membership_self_read ON public.business_memberships;
CREATE POLICY membership_self_read ON public.business_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text AND public.bizflow_email_verified());
ALTER TABLE public.auth_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_request_limits FROM anon, authenticated;

-- Imports are processed transiently, not stored. This private bucket is for future owned uploads.
INSERT INTO storage.buckets(id, name, public) VALUES ('bizflow-uploads', 'bizflow-uploads', false)
ON CONFLICT(id) DO UPDATE SET public = false;
CREATE POLICY bizflow_files_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bizflow-uploads' AND public.bizflow_is_member((storage.foldername(name))[1]));
CREATE POLICY bizflow_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bizflow-uploads' AND public.bizflow_is_member((storage.foldername(name))[1]));
CREATE POLICY bizflow_files_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bizflow-uploads' AND public.bizflow_is_member((storage.foldername(name))[1]))
  WITH CHECK (bucket_id = 'bizflow-uploads' AND public.bizflow_is_member((storage.foldername(name))[1]));
CREATE POLICY bizflow_files_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bizflow-uploads' AND public.bizflow_is_member((storage.foldername(name))[1]));
