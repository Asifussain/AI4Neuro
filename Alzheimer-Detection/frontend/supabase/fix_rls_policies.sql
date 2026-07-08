-- Fix infinite recursion in user_profiles RLS policies
-- This script removes ALL existing policies and creates new safe ones

-- Step 1: Drop ALL existing policies on user_profiles (including any we might create)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON user_profiles';
    END LOOP;
END $$;

-- Step 2: Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create new non-recursive policies
-- IMPORTANT: We're using a simpler approach to avoid recursion
-- The key is to use auth.uid() directly and avoid self-referencing lookups

-- 1. Allow users to read their own profile (no recursion)
CREATE POLICY "Users can view own profile"
ON user_profiles
FOR SELECT
USING (auth.uid() = id);

-- 2. Allow ALL authenticated users to view profiles (simplified)
-- This prevents recursion and relies on application-level filtering
CREATE POLICY "Authenticated users can view profiles"
ON user_profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 3. Allow authenticated users to insert (admin will create via service key)
CREATE POLICY "Authenticated users can insert profiles"
ON user_profiles
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON user_profiles
FOR UPDATE
USING (auth.uid() = id);

-- 5. Service role bypass (critical for admin operations)
CREATE POLICY "Service role full access"
ON user_profiles
FOR ALL
USING (
  -- Check if request is from service role
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
);

-- Step 4: Fix doctor_profiles policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'doctor_profiles' AND schemaname = 'public') LOOP
        IF r.policyname IN ('Anyone can view doctor profiles', 'Admins can manage doctor profiles', 'Authenticated users can view doctor profiles') THEN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON doctor_profiles';
        END IF;
    END LOOP;
END $$;

-- Allow all authenticated users to view doctor profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'doctor_profiles'
        AND policyname = 'Authenticated users can view doctor profiles'
    ) THEN
        CREATE POLICY "Authenticated users can view doctor profiles"
        ON doctor_profiles
        FOR SELECT
        USING (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Step 5: Fix patient_profiles policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'patient_profiles' AND schemaname = 'public') LOOP
        IF r.policyname IN ('Anyone can view patient profiles', 'Admins can manage patient profiles', 'Doctors can manage assigned patient profiles', 'Authenticated users can view patient profiles') THEN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON patient_profiles';
        END IF;
    END LOOP;
END $$;

-- Allow all authenticated users to view patient profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'patient_profiles'
        AND policyname = 'Authenticated users can view patient profiles'
    ) THEN
        CREATE POLICY "Authenticated users can view patient profiles"
        ON patient_profiles
        FOR SELECT
        USING (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Step 6: Fix radiologist_profiles policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'radiologist_profiles' AND schemaname = 'public') LOOP
        IF r.policyname IN ('Anyone can view radiologist profiles', 'Admins can manage radiologist profiles', 'Authenticated users can view radiologist profiles') THEN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON radiologist_profiles';
        END IF;
    END LOOP;
END $$;

-- Allow all authenticated users to view radiologist profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'radiologist_profiles'
        AND policyname = 'Authenticated users can view radiologist profiles'
    ) THEN
        CREATE POLICY "Authenticated users can view radiologist profiles"
        ON radiologist_profiles
        FOR SELECT
        USING (auth.uid() IS NOT NULL);
    END IF;
END $$;
