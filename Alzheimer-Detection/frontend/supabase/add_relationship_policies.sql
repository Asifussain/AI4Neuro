-- Add RLS policies for doctor_patient_relationships table

-- Enable RLS
ALTER TABLE doctor_patient_relationships ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage relationships" ON doctor_patient_relationships;
DROP POLICY IF EXISTS "Users can view their relationships" ON doctor_patient_relationships;
DROP POLICY IF EXISTS "Authenticated users can view relationships" ON doctor_patient_relationships;
DROP POLICY IF EXISTS "Service role full access" ON doctor_patient_relationships;

-- Allow all authenticated users to view relationships (app-level filtering)
CREATE POLICY "Authenticated users can view relationships"
ON doctor_patient_relationships
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert (admins will use service key)
CREATE POLICY "Authenticated users can insert relationships"
ON doctor_patient_relationships
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Service role bypass for admin operations
CREATE POLICY "Service role full access on relationships"
ON doctor_patient_relationships
FOR ALL
USING (
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
);
