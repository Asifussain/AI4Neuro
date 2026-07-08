# Supabase Row Level Security (RLS) Policies

## Table of Contents
- [Admin Profiles](#admin-profiles)
- [Blood Groups](#blood-groups)
- [Custom Auth Audit Log](#custom-auth-audit-log)
- [Custom Auth Credentials](#custom-auth-credentials)
- [Doctor Patient Relationships](#doctor-patient-relationships)
- [Doctor Profiles](#doctor-profiles)
- [EEG Analysis Results](#eeg-analysis-results)
- [EEG Sessions](#eeg-sessions)
- [Hospital ID Sequences](#hospital-id-sequences)
- [Hospitals](#hospitals)
- [Notifications](#notifications)
- [Password Reset Tokens](#password-reset-tokens)
- [Patient Profiles](#patient-profiles)
- [Predictions](#predictions)
- [Profile Details](#profile-details)
- [Profiles](#profiles)
- [Qualifications](#qualifications)
- [Radiologist Profiles](#radiologist-profiles)
- [Reports](#reports)
- [User Access Logs](#user-access-logs)
- [User Profiles](#user-profiles)

---

## Admin Profiles

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Users can insert own admin profile | INSERT | public | Allows users to create their own admin profile |
| Users can update own admin profile | UPDATE | public | Allows users to update their own admin profile |
| Users can view own admin profile | SELECT | public | Allows users to view their own admin profile |

---

## Blood Groups

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Authenticated users can view blood groups | SELECT | authenticated | Allows authenticated users to view blood group data |

---

## Custom Auth Audit Log

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Users can view own audit log | SELECT | public | Allows users to view their own authentication audit logs |

---

## Custom Auth Credentials

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Users can view own credentials | SELECT | public | Allows users to view their own authentication credentials |

---

## Doctor Patient Relationships

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Authenticated users can insert relationships | INSERT | public | Allows authenticated users to create doctor-patient relationships |
| Authenticated users can view relationships | SELECT | public | Allows authenticated users to view doctor-patient relationships |
| Service role full access on relationships | ALL | public | Grants service role complete access to manage relationships |

---

## Doctor Profiles

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Authenticated users can view doctor profiles | SELECT | public | Allows authenticated users to view all doctor profiles |
| Users can insert own doctor profile | INSERT | public | Allows users to create their own doctor profile |
| Users can update own doctor profile | UPDATE | public | Allows users to update their own doctor profile |
| Users can view own doctor profile | SELECT | public | Allows users to view their own doctor profile |

---

## EEG Analysis Results

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Users can view analysis for their sessions | SELECT | public | Allows users to view EEG analysis results for their own sessions |

---

## EEG Sessions

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Doctors can create sessions | INSERT | public | Allows doctors to create new EEG sessions |
| Doctors can view sessions for their patients | SELECT | public | Allows doctors to view EEG sessions for their assigned patients |
| Patients can view own sessions | SELECT | public | Allows patients to view their own EEG sessions |

---

## Hospital ID Sequences

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Admins can manage sequences | ALL | public | Allows admins to perform all operations on hospital ID sequences |

---

## Hospitals

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Authenticated users can view hospitals | SELECT | authenticated | Allows authenticated users to view hospital data |

---

## Notifications

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| System can insert notifications | INSERT | public | Allows the system to create notifications |
| Users can view own notifications | SELECT | public | Allows users to view their own notifications |

---

## Password Reset Tokens

**RLS Status:** Enabled

**⚠️ Warning:** No policies have been created yet. No data will be selectable via Supabase APIs.

---

## Patient Profiles

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Authenticated users can view patient profiles | SELECT | public | Allows authenticated users to view all patient profiles |
| Doctors can view assigned patients | SELECT | public | Allows doctors to view profiles of their assigned patients |
| Users can insert own patient profile | INSERT | public | Allows users to create their own patient profile |
| Users can update own patient profile | UPDATE | public | Allows users to update their own patient profile |
| Users can view own patient profile | SELECT | public | Allows users to view their own patient profile |

---

## Predictions

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Admins can view hospital reports | SELECT | authenticated | Allows admins to view prediction reports for their hospital |
| Authenticated users can create predictions | INSERT | authenticated | Allows authenticated users to create predictions |
| Doctors can view patient reports | SELECT | authenticated | Allows doctors to view prediction reports for their patients |
| Patients can view own reports | SELECT | authenticated | Allows patients to view their own prediction reports |
| Radiologists can view hospital reports | SELECT | authenticated | Allows radiologists to view prediction reports for their hospital |
| Users can access their own predictions | ALL | public | Allows users to perform all operations on their own predictions |
| Users can update own predictions | UPDATE | authenticated | Allows users to update their own predictions |

---

## Profile Details

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Allow individual update access | UPDATE | public | Allows users to update profile details |
| Enable read access for all users | SELECT | public | Allows all users to read profile details |
| Users can insert their own profile details | INSERT | public | Allows users to insert their own profile details |

---

## Profiles

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Enable delete for own user | DELETE | authenticated | Allows authenticated users to delete their own profile |
| Enable insert for own profile | INSERT | authenticated | Allows authenticated users to create their own profile |
| Enable read access for own user | SELECT | authenticated | Allows authenticated users to read their own profile |
| Enable update for own user | UPDATE | authenticated | Allows authenticated users to update their own profile |

---

## Qualifications

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Authenticated users can view qualifications | SELECT | authenticated | Allows authenticated users to view qualification data |

---

## Radiologist Profiles

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Admins can create radiologist profiles | INSERT | public | Allows admins to create radiologist profiles |
| Admins can read all radiologist profiles | SELECT | public | Allows admins to view all radiologist profiles |
| Admins can update radiologist profiles | UPDATE | public | Allows admins to update radiologist profiles |
| Authenticated users can view radiologist profiles | SELECT | public | Allows authenticated users to view radiologist profiles |
| Radiologists can read own profile | SELECT | public | Allows radiologists to view their own profile |
| Radiologists can update own profile | UPDATE | public | Allows radiologists to update their own profile |

---

## Reports

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Users can view reports generated for them | SELECT | public | Allows users to view reports that were generated for them |

---

## User Access Logs

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| System can insert access logs | INSERT | public | Allows the system to create access log entries |
| Users can view own access logs | SELECT | public | Allows users to view their own access logs |

---

## User Profiles

**RLS Status:** Enabled

| Policy Name | Command | Applied To | Description |
|------------|---------|------------|-------------|
| Authenticated users can insert profiles | INSERT | public | Allows authenticated users to insert user profiles |
| Authenticated users can view profiles | SELECT | public | Allows authenticated users to view user profiles |
| Service role full access | ALL | public | Grants service role complete access to user profiles |
| Users can update own profile | UPDATE | public | Allows users to update their own profile |
| Users can view own profile | SELECT | public | Allows users to view their own profile |

---

## Summary

- **Total Tables:** 21
- **Tables with RLS Enabled:** 21
- **Tables without Policies:** 1 (password_reset_tokens)
- **Total Policies:** 72

### Key Changes from Previous Version

#### Doctor Patient Relationships
- ✨ Added: "Authenticated users can insert relationships"
- ✨ Added: "Service role full access on relationships"
- ❌ Removed: "Admins can manage relationships"

#### Doctor Profiles
- ✨ Added: "Authenticated users can view doctor profiles"

#### Patient Profiles
- ✨ Added: "Authenticated users can view patient profiles"

#### Predictions
- ✨ Added: "Admins can view hospital reports"
- ✨ Added: "Authenticated users can create predictions"
- ✨ Added: "Doctors can view patient reports"
- ✨ Added: "Patients can view own reports"
- ✨ Added: "Radiologists can view hospital reports"
- ✨ Added: "Users can update own predictions"

#### Radiologist Profiles
- ✨ Added: "Authenticated users can view radiologist profiles"

#### User Profiles
- ✨ Added: "Authenticated users can insert profiles"
- ✨ Added: "Authenticated users can view profiles"
- ✨ Added: "Service role full access"
- ❌ Removed: "Allow admin to view users in their own hospital"
- ❌ Removed: "Enable insert for authenticated users"
- ❌ Removed: "Enable select for authenticated users"
- ❌ Removed: "Enable update for authenticated users"
- ❌ Removed: "Users can insert own profile"

### Security Notes

1. **Enhanced Role-Based Access:** More granular permissions for admins, doctors, patients, and radiologists, especially in the predictions table
2. **Service Role Access:** Service role now has full access to doctor-patient relationships and user profiles for backend operations
3. **Broader Profile Visibility:** Authenticated users can now view doctor, patient, and radiologist profiles (previously more restricted)
4. **Password Reset Tokens:** Still needs policies to be functional
5. **Improved Predictions Access:** Multiple role-specific policies provide fine-grained control over who can view and create predictions