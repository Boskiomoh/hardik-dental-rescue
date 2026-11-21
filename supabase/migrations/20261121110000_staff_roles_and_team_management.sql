-- Feature: role-based access for clinic staff.
--
-- Roles (app_role, from 20250928084521): admin, staff, doctor.
--   admin  - everything, including team management, feedback and deletes
--   staff  - patients, appointments, billing, contact messages
--   doctor - patients and appointments (no billing, no deletes)
-- Patient/appointment/billing policies already follow these rules; this adds
-- contact messages for staff and admin-only team management functions.

-- Staff answer contact messages; reviews stay admin-only.
CREATE POLICY "Staff can view contact messages" ON public.feedback
  FOR SELECT TO authenticated
  USING (category = 'contact' AND public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff can update contact messages" ON public.feedback
  FOR UPDATE TO authenticated
  USING (category = 'contact' AND public.has_role(auth.uid(), 'staff'))
  WITH CHECK (category = 'contact' AND public.has_role(auth.uid(), 'staff'));

-- ---------------------------------------------------------------------------
-- Team management (admin only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_team()
RETURNS TABLE (user_id UUID, email TEXT, roles public.app_role[], last_sign_in_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can view the team.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT u.id, u.email::TEXT, array_agg(r.role ORDER BY r.role), u.last_sign_in_at
      FROM public.user_roles r
      JOIN auth.users u ON u.id = r.user_id
     WHERE r.role IN ('admin', 'staff', 'doctor')
     GROUP BY u.id, u.email, u.last_sign_in_at
     ORDER BY u.email;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_role(p_email TEXT, p_role public.app_role, p_grant BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change roles.' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('admin', 'staff', 'doctor') THEN
    RAISE EXCEPTION 'Choose admin, staff or doctor.' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No account uses that email yet. Ask them to sign up at /signup first.' USING ERRCODE = '22023';
  END IF;

  IF p_grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, p_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- Don't let an admin lock everyone (including themselves) out.
    IF p_role = 'admin' AND v_user_id = auth.uid() THEN
      RAISE EXCEPTION 'You can''t remove your own admin role.' USING ERRCODE = '22023';
    END IF;
    DELETE FROM public.user_roles WHERE user_id = v_user_id AND role = p_role;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_team() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_role(TEXT, public.app_role, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_team() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(TEXT, public.app_role, BOOLEAN) TO authenticated;
