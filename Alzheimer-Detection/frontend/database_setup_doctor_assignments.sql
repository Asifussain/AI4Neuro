-- ============================================================
-- SQL SETUP FOR DOCTOR-PATIENT ASSIGNMENTS
-- Run this in your Supabase SQL Editor to ensure everything works
-- ============================================================

-- 1. Ensure doctor_patient_relationships table exists with correct structure
CREATE TABLE IF NOT EXISTS public.doctor_patient_relationships (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  doctor_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  hospital_id uuid NOT NULL,
  relationship_status character varying DEFAULT 'active'::character varying,
  assigned_by uuid,
  assigned_at timestamp with time zone DEFAULT now(),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT doctor_patient_relationships_pkey PRIMARY KEY (id),
  CONSTRAINT doctor_patient_relationships_doctor_fkey FOREIGN KEY (doctor_id)
    REFERENCES public.doctor_profiles(user_id) ON DELETE CASCADE,
  CONSTRAINT doctor_patient_relationships_patient_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patient_profiles(user_id) ON DELETE CASCADE,
  CONSTRAINT doctor_patient_relationships_hospital_fkey FOREIGN KEY (hospital_id)
    REFERENCES public.hospitals(id) ON DELETE CASCADE,
  CONSTRAINT doctor_patient_relationships_assigned_by_fkey FOREIGN KEY (assigned_by)
    REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  CONSTRAINT doctor_patient_relationships_status_check
    CHECK (relationship_status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying, 'terminated'::character varying]::text[]))
);

-- 2. Add unique constraint to prevent duplicate doctor-patient assignments
-- This ensures we don't accidentally create the same relationship twice
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'doctor_patient_unique_active'
  ) THEN
    ALTER TABLE public.doctor_patient_relationships
    ADD CONSTRAINT doctor_patient_unique_active
    UNIQUE (doctor_id, patient_id, hospital_id, relationship_status);
  END IF;
END $$;

-- 3. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_doctor_patient_doctor_id
  ON public.doctor_patient_relationships(doctor_id);

CREATE INDEX IF NOT EXISTS idx_doctor_patient_patient_id
  ON public.doctor_patient_relationships(patient_id);

CREATE INDEX IF NOT EXISTS idx_doctor_patient_hospital_id
  ON public.doctor_patient_relationships(hospital_id);

CREATE INDEX IF NOT EXISTS idx_doctor_patient_status
  ON public.doctor_patient_relationships(relationship_status);

CREATE INDEX IF NOT EXISTS idx_doctor_patient_active
  ON public.doctor_patient_relationships(patient_id, relationship_status)
  WHERE relationship_status = 'active';

-- 4. Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Add trigger to auto-update updated_at timestamp
DROP TRIGGER IF EXISTS update_doctor_patient_relationships_updated_at
  ON public.doctor_patient_relationships;

CREATE TRIGGER update_doctor_patient_relationships_updated_at
  BEFORE UPDATE ON public.doctor_patient_relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.doctor_patient_relationships ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for doctor_patient_relationships

-- Policy: Admins can do everything
DROP POLICY IF EXISTS "Admins can manage all relationships"
  ON public.doctor_patient_relationships;

CREATE POLICY "Admins can manage all relationships"
  ON public.doctor_patient_relationships
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.account_status = 'active'
    )
  );

-- Policy: Doctors can view their own patient relationships
DROP POLICY IF EXISTS "Doctors can view their patients"
  ON public.doctor_patient_relationships;

CREATE POLICY "Doctors can view their patients"
  ON public.doctor_patient_relationships
  FOR SELECT
  USING (
    doctor_id = auth.uid()
    AND relationship_status = 'active'
  );

-- Policy: Patients can view their assigned doctors
DROP POLICY IF EXISTS "Patients can view their doctors"
  ON public.doctor_patient_relationships;

CREATE POLICY "Patients can view their doctors"
  ON public.doctor_patient_relationships
  FOR SELECT
  USING (
    patient_id = auth.uid()
    AND relationship_status = 'active'
  );

-- 8. Create a function to get active doctor count for a patient
CREATE OR REPLACE FUNCTION public.get_patient_doctor_count(patient_user_id uuid)
RETURNS integer AS $$
  SELECT COUNT(*)::integer
  FROM public.doctor_patient_relationships
  WHERE patient_id = patient_user_id
  AND relationship_status = 'active';
$$ LANGUAGE sql STABLE;

-- 9. Create a function to get active patient count for a doctor
CREATE OR REPLACE FUNCTION public.get_doctor_patient_count(doctor_user_id uuid)
RETURNS integer AS $$
  SELECT COUNT(*)::integer
  FROM public.doctor_patient_relationships
  WHERE doctor_id = doctor_user_id
  AND relationship_status = 'active';
$$ LANGUAGE sql STABLE;

-- 10. Create a view for easy querying of active relationships
CREATE OR REPLACE VIEW public.active_doctor_patient_assignments AS
SELECT
  dpr.id,
  dpr.doctor_id,
  dpr.patient_id,
  dpr.hospital_id,
  dpr.assigned_at,
  dpr.assigned_by,
  doctor_profile.full_name as doctor_name,
  doctor_profile.email as doctor_email,
  doctor_profile.phone as doctor_phone,
  patient_profile.full_name as patient_name,
  patient_profile.email as patient_email,
  patient_profile.phone as patient_phone,
  patient_profile.unique_identifier as patient_identifier
FROM public.doctor_patient_relationships dpr
LEFT JOIN public.user_profiles doctor_profile ON dpr.doctor_id = doctor_profile.id
LEFT JOIN public.user_profiles patient_profile ON dpr.patient_id = patient_profile.id
WHERE dpr.relationship_status = 'active';

-- 11. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_patient_relationships TO authenticated;
GRANT SELECT ON public.active_doctor_patient_assignments TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_doctor_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_doctor_patient_count TO authenticated;

-- ============================================================
-- VERIFICATION QUERIES - Run these to check everything works
-- ============================================================

-- Check if table exists and has data
SELECT
  'doctor_patient_relationships table exists' as status,
  COUNT(*) as total_relationships,
  COUNT(*) FILTER (WHERE relationship_status = 'active') as active_relationships,
  COUNT(*) FILTER (WHERE relationship_status = 'inactive') as inactive_relationships
FROM public.doctor_patient_relationships;

-- Check indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'doctor_patient_relationships'
ORDER BY indexname;

-- Check RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'doctor_patient_relationships';

-- Sample query: Get all active assignments for a hospital
-- Replace 'YOUR_HOSPITAL_ID' with actual hospital ID
-- SELECT * FROM public.active_doctor_patient_assignments
-- WHERE hospital_id = 'YOUR_HOSPITAL_ID'
-- ORDER BY assigned_at DESC;

-- ============================================================
-- DONE! Your database is now properly configured for
-- multiple doctor-patient assignments
-- ============================================================
