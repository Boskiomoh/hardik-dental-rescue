-- Feature: a refundable $25 deposit paid through Stripe Checkout to secure a
-- booking. The browser never marks anything as paid: the confirm-deposit and
-- stripe-webhook Edge Functions check with Stripe and update the row with the
-- service role.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS deposit_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (deposit_status IN ('not_required', 'pending', 'paid')),
  ADD COLUMN IF NOT EXISTS deposit_amount_cents INTEGER CHECK (deposit_amount_cents IS NULL OR deposit_amount_cents > 0),
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ;

-- Same as 20261121100000 apart from the deposit columns on new bookings.
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
      CASE WHEN auth.uid() IS NOT NULL
                AND lower(coalesce(auth.jwt() ->> 'email', '')) = v_email
           THEN auth.uid() END
    )
    RETURNING id INTO v_patient_id;
  END IF;

  BEGIN
    INSERT INTO public.appointments (
      patient_id, appointment_date, appointment_time, service_type, doctor, status, notes,
      deposit_status, deposit_amount_cents
    )
    VALUES (
      v_patient_id, p_date, p_time, p_service, p_doctor, 'scheduled', nullif(trim(coalesce(p_notes, '')), ''),
      'pending', 2500
    )
    RETURNING id INTO v_appointment_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Sorry, that time was just booked. Please choose another time.' USING ERRCODE = 'P0001', HINT = 'slot_taken';
  END;

  RETURN v_appointment_id;
END;
$$;
