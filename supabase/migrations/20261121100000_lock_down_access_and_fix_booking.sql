-- Fixes BUGS.md B02, B03, B05, B06, B08, B13, B14, B18.
--
-- 1. Remove the "(dev)" policies that let anyone read, change and delete
--    patient financial records, treatment plans, patients and appointments.
-- 2. Link patients to Supabase Auth users, so a signed-in patient can read
--    only their own record and appointments.
-- 3. Public booking goes through book_appointment(), which saves the patient
--    and appointment without giving visitors read access to either table.
--    A unique index stops two bookings for the same doctor and time.
-- 4. Visitors see taken slots through get_booked_slots(), which returns
--    times only.
-- 5. Contact messages no longer carry a rating.

-- ---------------------------------------------------------------------------
-- 1. Drop the permissive "dev" policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can update feedback (dev)" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can insert patients (dev)" ON public.patients;
DROP POLICY IF EXISTS "Anyone can update patients (dev)" ON public.patients;
DROP POLICY IF EXISTS "Anyone can insert appointments (dev)" ON public.appointments;
DROP POLICY IF EXISTS "Anyone can update appointments (dev)" ON public.appointments;
DROP POLICY IF EXISTS "Anyone can manage patient services (dev)" ON public.patient_services;
DROP POLICY IF EXISTS "Anyone can manage patient financials (dev)" ON public.patient_financials;

-- Staff-only policies on these two tables were created FOR ALL without a
-- WITH CHECK; restate them so inserts are checked too.
DROP POLICY IF EXISTS "Healthcare providers can manage patient services" ON public.patient_services;
CREATE POLICY "Healthcare providers can manage patient services" ON public.patient_services
  FOR ALL TO authenticated
  USING (public.is_healthcare_provider(auth.uid()))
  WITH CHECK (public.is_healthcare_provider(auth.uid()));

DROP POLICY IF EXISTS "Admin and staff can manage patient financials" ON public.patient_financials;
CREATE POLICY "Admin and staff can manage patient financials" ON public.patient_financials
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Role helpers are for policies; visitors don't need to call them.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_healthcare_provider(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_healthcare_provider(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Patients belong to auth users
-- ---------------------------------------------------------------------------
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
-- Booking used to write a made-up 1990-01-01 here.
ALTER TABLE public.patients ALTER COLUMN date_of_birth DROP NOT NULL;
CREATE INDEX IF NOT EXISTS patients_email_lower_idx ON public.patients (lower(email));

CREATE POLICY "Patients can view their own record" ON public.patients
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Patients can view their own appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

-- Link a confirmed auth user to the patient record with the same email.
-- Only confirmed emails are linked, so nobody can claim someone else's
-- records by signing up with their address.
CREATE OR REPLACE FUNCTION public.link_patient_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.patients
       SET user_id = NEW.id
     WHERE user_id IS NULL
       AND lower(email) = lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed_link_patient ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_link_patient
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_patient_to_user();

-- Link users that already exist.
UPDATE public.patients p
   SET user_id = u.id
  FROM auth.users u
 WHERE p.user_id IS NULL
   AND u.email_confirmed_at IS NOT NULL
   AND lower(p.email) = lower(u.email);

-- ---------------------------------------------------------------------------
-- 3. Booking
-- ---------------------------------------------------------------------------
-- One booking per doctor, date and time (cancelled ones don't count).
CREATE UNIQUE INDEX IF NOT EXISTS appointments_doctor_slot_unique
  ON public.appointments (doctor, appointment_date, appointment_time)
  WHERE status IS DISTINCT FROM 'cancelled';

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_date DATE,
  p_time TIME,
  p_service TEXT,
  p_doctor TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
  v_patient_id UUID;
  v_appointment_id UUID;
BEGIN
  IF coalesce(trim(p_first_name), '') = '' OR coalesce(trim(p_last_name), '') = '' THEN
    RAISE EXCEPTION 'Please enter your first and last name.' USING ERRCODE = '22023';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Please enter a valid email address.' USING ERRCODE = '22023';
  END IF;
  IF p_date < CURRENT_DATE OR p_date > CURRENT_DATE + 180 THEN
    RAISE EXCEPTION 'Please choose a date between today and six months from now.' USING ERRCODE = '22023';
  END IF;
  IF extract(dow FROM p_date) = 0 THEN
    RAISE EXCEPTION 'The clinic is closed on Sundays.' USING ERRCODE = '22023';
  END IF;
  IF p_time < TIME '09:00' OR p_time > TIME '17:00' OR extract(minute FROM p_time) NOT IN (0, 30)
     OR extract(second FROM p_time) <> 0 THEN
    RAISE EXCEPTION 'Please choose one of the listed times.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.doctors WHERE name = p_doctor AND coalesce(is_active, true)) THEN
    RAISE EXCEPTION 'Please choose one of the listed doctors.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = p_service) THEN
    RAISE EXCEPTION 'Please choose one of the listed services.' USING ERRCODE = '22023';
  END IF;

  -- Reuse the patient record for this email, or create one. Existing
  -- details are never overwritten by an anonymous booking.
  SELECT id INTO v_patient_id
    FROM public.patients
   WHERE lower(email) = v_email
   ORDER BY created_at
   LIMIT 1;

  IF v_patient_id IS NULL THEN
    INSERT INTO public.patients (name, email, phone, status, user_id)
    VALUES (
      trim(p_first_name) || ' ' || trim(p_last_name),
      v_email,
      coalesce(trim(p_phone), ''),
      'active',
      -- A signed-in patient booking with their own confirmed email.
      CASE WHEN auth.uid() IS NOT NULL
                AND lower(coalesce(auth.jwt() ->> 'email', '')) = v_email
           THEN auth.uid() END
    )
    RETURNING id INTO v_patient_id;
  END IF;

  BEGIN
    INSERT INTO public.appointments (patient_id, appointment_date, appointment_time, service_type, doctor, status, notes)
    VALUES (v_patient_id, p_date, p_time, p_service, p_doctor, 'scheduled', nullif(trim(coalesce(p_notes, '')), ''))
    RETURNING id INTO v_appointment_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Sorry, that time was just booked. Please choose another time.' USING ERRCODE = 'P0001', HINT = 'slot_taken';
  END;

  RETURN v_appointment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.book_appointment(TEXT, TEXT, TEXT, TEXT, DATE, TIME, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment(TEXT, TEXT, TEXT, TEXT, DATE, TIME, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Taken slots, without patient details
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_booked_slots(p_date DATE, p_doctor TEXT)
RETURNS SETOF TIME
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT appointment_time
    FROM public.appointments
   WHERE appointment_date = p_date
     AND doctor = p_doctor
     AND status IS DISTINCT FROM 'cancelled'
$$;

REVOKE EXECUTE ON FUNCTION public.get_booked_slots(DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(DATE, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Feedback and contact messages
-- ---------------------------------------------------------------------------
ALTER TABLE public.feedback ALTER COLUMN rating DROP NOT NULL;
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_rating_check;
UPDATE public.feedback SET rating = NULL WHERE category = 'contact';
ALTER TABLE public.feedback ADD CONSTRAINT feedback_rating_check CHECK (
  (category = 'contact' AND rating IS NULL)
  OR (category <> 'contact' AND rating BETWEEN 1 AND 5)
);

-- Visitors may only submit new items; they can't pre-mark them reviewed.
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback" ON public.feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new');
