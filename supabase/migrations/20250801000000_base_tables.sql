-- Base tables that the later migrations depend on but no migration creates.
-- The upstream repo's migrations start by altering public.patients and
-- public.appointments, so a fresh database could not be built from them.
-- Columns are taken from src/integrations/supabase/types.ts (generated from the
-- original database). The "Allow admin access to ..." policies are the ones that
-- 20250928084521 drops, recreated here so that migration runs as written.

CREATE TABLE IF NOT EXISTS public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  address TEXT,
  medical_history TEXT,
  insurance_info TEXT,
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  service_type TEXT NOT NULL,
  doctor TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.treatments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  treatment_type TEXT NOT NULL,
  description TEXT,
  cost NUMERIC,
  status TEXT
);

CREATE TABLE IF NOT EXISTS public.practice_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin access to patients" ON public.patients FOR ALL USING (true);
CREATE POLICY "Allow admin access to appointments" ON public.appointments FOR ALL USING (true);
