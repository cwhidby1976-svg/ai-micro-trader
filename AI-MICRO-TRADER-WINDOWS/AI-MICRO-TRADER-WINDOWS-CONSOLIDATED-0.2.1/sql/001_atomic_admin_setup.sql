-- Run in Supabase SQL Editor only after reviewing. This is additive and does not import old accounts.
-- A singleton guard prevents concurrent creation of multiple initial administrators.
CREATE TABLE IF NOT EXISTS public.amt_admin_provision_guard (
  singleton_id integer PRIMARY KEY CHECK (singleton_id = 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.amt_admin_provision_guard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.amt_admin_provision_guard FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.amt_create_first_admin(
  p_id text, p_username text, p_data jsonb, p_created_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_id IS NULL OR length(p_id) < 8 OR p_username IS NULL OR length(trim(p_username)) < 3
     OR p_data IS NULL OR p_data->>'id' IS DISTINCT FROM p_id
     OR p_data->>'username' IS DISTINCT FROM p_username THEN
    RAISE EXCEPTION 'Invalid administrator input';
  END IF;
  -- Guard insert is protected by the unique primary key even across concurrent transactions.
  INSERT INTO public.amt_admin_provision_guard(singleton_id) VALUES (1) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM public.amt_admin_provision_guard WHERE singleton_id = 1 FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.amt_admin_users LIMIT 1) THEN
    RETURN false;
  END IF;
  INSERT INTO public.amt_admin_users(id, username, data, created_at)
  VALUES (p_id, p_username, p_data, p_created_at);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.amt_create_first_admin(text,text,jsonb,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.amt_create_first_admin(text,text,jsonb,timestamptz) TO service_role;
