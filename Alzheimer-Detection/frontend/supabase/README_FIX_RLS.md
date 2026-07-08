# Fix RLS Infinite Recursion Error

## Problem
You're encountering an infinite recursion error in the `user_profiles` table RLS policies. This happens when policies reference the same table they're protecting.

## Solution

### Step 1: Apply SQL Migration
1. Go to your Supabase Dashboard: https://nzjwcykqsmxrcqoccufe.supabase.co
2. Navigate to **SQL Editor** (in the left sidebar)
3. Click **New Query**
4. Copy the entire contents of `fix_rls_policies.sql`
5. Paste it into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)

### Step 2: Verify the Fix
After running the SQL, verify that:
- The policies have been recreated without recursion
- You can query `user_profiles` without errors

### Step 3: Restart Development Server
```bash
cd frontend
npm run dev
```

## What Changed

### Code Changes:
1. **`pages/api/admin/users-simple.js`**: Added doctor_profiles join to fetch doctor details
2. **`pages/api/radiologist/get-doctors.js`**: Changed to use service role key (supabaseAdmin) to bypass RLS

### Database Changes (in fix_rls_policies.sql):
1. Removed recursive policies on `user_profiles`
2. Created non-recursive policies that check roles directly
3. Fixed policies on `doctor_profiles`, `patient_profiles`, and `radiologist_profiles`
4. Added service role bypass for admin operations

## Testing
After applying these changes:

1. **Admin Dashboard**: Should show patients and doctors with their profile information
2. **Radiologist Dashboard**: Should load doctors without infinite recursion error
3. **Doctor Assignments**: Should be visible in the patients section

## If Issues Persist
If you still see errors:
1. Check browser console for specific error messages
2. Check Supabase logs in Dashboard > Logs
3. Verify environment variables in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
