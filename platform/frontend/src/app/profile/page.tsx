'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { withAuth } from '@/lib/withAuth';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { getRoleMeta, type Role } from '@/lib/navigation';
import { ACCENT_STYLES, type Accent } from '@/components/dashboards/shared/primitives';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { adminApi, type Hospital } from '@/features/admin/api';
import { apiClient } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

interface BloodGroup {
  id: number;
  blood_type: string;
}

interface Qualification {
  id: number;
  qualification_name: string;
  specialization?: string | null;
}

// Cover-photo gradients per accent — lighter than ACCENT_STYLES.gradient (which
// is tuned for opaque badges/buttons, too dark for a large background panel).
const COVER_GRADIENT: Record<Accent, string> = {
  green: 'from-emerald-100 via-emerald-50 to-teal-50',
  indigo: 'from-indigo-100 via-indigo-50 to-violet-50',
  blue: 'from-blue-100 via-blue-50 to-indigo-50',
  teal: 'from-teal-100 via-teal-50 to-cyan-50',
};

// Border shade to pair with ACCENT_STYLES.soft/.text (not itself in that map).
const ACCENT_BORDER: Record<Accent, string> = {
  green: 'border-emerald-200',
  indigo: 'border-indigo-200',
  blue: 'border-blue-200',
  teal: 'border-teal-200',
};

// SettingsLink hover state per accent. Tailwind's JIT scanner only picks up
// class names that appear literally in source, so these must be complete
// strings rather than built by concatenating a variant prefix onto
// ACCENT_STYLES at runtime.
const SETTINGS_LINK_HOVER: Record<
  Accent,
  { border: string; bg: string; iconBg: string; text: string }
> = {
  green: {
    border: 'hover:border-emerald-300',
    bg: 'hover:bg-emerald-50/50',
    iconBg: 'group-hover:bg-emerald-50',
    text: 'group-hover:text-emerald-700',
  },
  indigo: {
    border: 'hover:border-indigo-300',
    bg: 'hover:bg-indigo-50/50',
    iconBg: 'group-hover:bg-indigo-50',
    text: 'group-hover:text-indigo-700',
  },
  blue: {
    border: 'hover:border-blue-300',
    bg: 'hover:bg-blue-50/50',
    iconBg: 'group-hover:bg-blue-50',
    text: 'group-hover:text-blue-700',
  },
  teal: {
    border: 'hover:border-teal-300',
    bg: 'hover:bg-teal-50/50',
    iconBg: 'group-hover:bg-teal-50',
    text: 'group-hover:text-teal-700',
  },
};

// Info card component
function InfoCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: Accent;
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', styles.soft)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-sm text-slate-900 truncate">{value || 'Not provided'}</p>
      </div>
    </div>
  );
}

// Settings link component
function SettingsLink({ icon, title, description, href, badge, accent }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  badge?: string;
  accent: Accent;
}) {
  const styles = ACCENT_STYLES[accent];
  const hover = SETTINGS_LINK_HOVER[accent];
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 transition-all',
        hover.border,
        hover.bg
      )}
    >
      <div className={cn('w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center transition-colors', hover.iconBg)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium text-slate-900 transition-colors', hover.text)}>{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      {badge && (
        <span className={cn('px-2 py-1 text-xs rounded-full', styles.soft, styles.text)}>{badge}</span>
      )}
      <svg viewBox="0 0 24 24" className={cn('w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-all', hover.text)} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </Link>
  );
}

function ProfilePage() {
  const { user, userProfile, signOut, refreshProfile } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  // Display-only label for a picked file — kept separate from editAvatarUrl
  // (which holds the actual data: URI / URL value) so the raw base64 string
  // never ends up rendered into a text input.
  const [editAvatarFileName, setEditAvatarFileName] = useState('');
  const [editQualificationId, setEditQualificationId] = useState('');
  const [editLicense, setEditLicense] = useState('');
  const [editSpecialization, setEditSpecialization] = useState('');
  const [editImagingExpertise, setEditImagingExpertise] = useState('');
  const [editCertifications, setEditCertifications] = useState('');
  const [editExperience, setEditExperience] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editEmergencyName, setEditEmergencyName] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');
  const [editBloodGroupId, setEditBloodGroupId] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [bloodGroups, setBloodGroups] = useState<BloodGroup[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hospitalName, setHospitalName] = useState<string>('');

  const displayName = userProfile?.full_name || 'User';
  const role = userProfile?.role || 'patient';
  const accent = getRoleMeta(role as Role).accent;
  const styles = ACCENT_STYLES[accent];
  const email = userProfile?.email || user?.email || '';
  const phone = userProfile?.phone || '';
  const accountStatus = userProfile?.account_status || 'active';
  const roleProfile = (userProfile?.roleProfile || (userProfile as any)?.profile?.roleProfile || (userProfile as any)?.profile || {}) as any;
  const avatarUrl = (userProfile as any)?.avatar_url || roleProfile?.avatar_url || (userProfile as any)?.profile?.avatar_url || '';

  const PRESET_AVATARS = [
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1594824813566-88855ce7890b?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  ];

  useEffect(() => {
    if (userProfile) {
      setEditName(userProfile.full_name || '');
      setEditPhone(userProfile.phone || '');
      setEditAvatarUrl((userProfile as any)?.avatar_url || roleProfile?.avatar_url || (userProfile as any)?.profile?.avatar_url || '');
      setEditAvatarFileName('');
      setEditBloodGroupId(roleProfile?.blood_group_id ? String(roleProfile.blood_group_id) : '');
      setEditQualificationId(roleProfile?.qualification_id ? String(roleProfile.qualification_id) : '');
      // doctor_profiles.medical_license vs radiologist_profiles.radiologist_license —
      // the UI shows one "License Number" field regardless of which column backs it.
      setEditLicense(roleProfile?.medical_license || roleProfile?.radiologist_license || '');
      setEditSpecialization(roleProfile?.specialization || '');
      setEditImagingExpertise(roleProfile?.imaging_expertise || '');
      setEditCertifications(roleProfile?.certifications || '');
      setEditExperience(roleProfile?.experience_years ? String(roleProfile.experience_years) : '');
      setEditDob(roleProfile?.date_of_birth ? String(roleProfile.date_of_birth).slice(0, 10) : '');
      setEditEmergencyName(roleProfile?.emergency_contact_name || '');
      setEditEmergencyPhone(roleProfile?.emergency_contact_phone || '');
      setEditEmployeeId(roleProfile?.employee_id || '');
      setEditDepartment(roleProfile?.department || '');
    }
  }, [userProfile]);

  useEffect(() => {
    if (role !== 'patient') return;
    let cancelled = false;
    apiClient
      .get<BloodGroup[]>('/api/v1/users/blood-groups')
      .then((rows) => !cancelled && setBloodGroups(rows))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    if (role !== 'doctor' && role !== 'radiologist') return;
    let cancelled = false;
    apiClient
      .get<Qualification[]>('/api/v1/users/qualifications')
      .then((rows) => !cancelled && setQualifications(rows))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    const hospitalId = roleProfile?.hospital_id || (userProfile as any)?.hospital_id;
    if (hospitalId) {
      const supabase = createClient();
      supabase
        .from('hospitals')
        .select('name')
        .eq('id', hospitalId)
        .single()
        .then((res: { data: { name: string } | null }) => {
          if (!cancelled && res.data?.name) {
            setHospitalName(res.data.name);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [userProfile]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch {
      toast.error('Failed to log out');
      setIsLoggingOut(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!userProfile) return;
    setIsSaving(true);

    let backendSuccess = false;
    let supabaseSuccess = false;

    try {
      const supabase = createClient();
      const experienceYears = editExperience ? parseInt(editExperience, 10) : null;
      const qualificationId = editQualificationId ? parseInt(editQualificationId, 10) : null;
      const bloodGroupId = editBloodGroupId ? parseInt(editBloodGroupId, 10) : null;

      // 1. Update backend FastAPI users/me endpoint (service role bypasses
      // RLS). Only real column names for the caller's role are sent — see
      // _ROLE_FIELD_MAP in app/api/v1/users.py — so a field that doesn't
      // apply to this role is simply ignored server-side rather than
      // breaking the whole save.
      try {
        await apiClient.patch('/api/v1/users/me', {
          full_name: editName,
          phone: editPhone,
          avatar_url: editAvatarUrl || null,
          license_number: editLicense || null,
          qualification_id: qualificationId,
          experience_years: experienceYears,
          specialization: editSpecialization || null,
          imaging_expertise: editImagingExpertise || null,
          certifications: editCertifications || null,
          date_of_birth: editDob || null,
          emergency_contact_name: editEmergencyName || null,
          emergency_contact_phone: editEmergencyPhone || null,
          blood_group_id: bloodGroupId,
          employee_id: editEmployeeId || null,
          department: editDepartment || null,
        });
        backendSuccess = true;
      } catch (err) {
        console.warn('API client patch error (backend might be down or blocked by CORS):', err);
      }

      // 2. Fallback: Update user_profiles in Supabase directly
      try {
        const { error: userError } = await supabase
          .from('user_profiles')
          .update({
            full_name: editName,
            phone: editPhone,
            avatar_url: editAvatarUrl || null,
          })
          .eq('id', userProfile.id);

        if (userError) {
           console.warn('Supabase direct update error:', userError);
        } else {
           supabaseSuccess = true;
        }
      } catch (err) {
        console.warn('Supabase client exception:', err);
      }

      // 3. Fallback: Update role-specific table in Supabase directly, using
      // each table's real column names (doctor_profiles.medical_license vs
      // radiologist_profiles.radiologist_license, etc — see full_setup.sql).
      if (role === 'doctor') {
        try {
          const { error: roleError } = await supabase.from('doctor_profiles').upsert(
            {
              user_id: userProfile.id,
              medical_license: editLicense || undefined,
              qualification_id: qualificationId,
              specialization: editSpecialization || null,
              experience_years: experienceYears,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
          if (roleError) console.warn('Doctor table upsert error:', roleError);
        } catch (err) {
          console.warn('Doctor table upsert exception:', err);
        }
      } else if (role === 'radiologist') {
        try {
          const { error: roleError } = await supabase.from('radiologist_profiles').upsert(
            {
              user_id: userProfile.id,
              radiologist_license: editLicense || undefined,
              qualification_id: qualificationId,
              imaging_expertise: editImagingExpertise || undefined,
              certifications: editCertifications || null,
              experience_years: experienceYears,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
          if (roleError) console.warn('Radiologist table upsert error:', roleError);
        } catch (err) {
          console.warn('Radiologist table upsert exception:', err);
        }
      } else if (role === 'patient') {
        try {
          const { error: roleError } = await supabase.from('patient_profiles').upsert(
            {
              user_id: userProfile.id,
              date_of_birth: editDob || null,
              emergency_contact_name: editEmergencyName || null,
              emergency_contact_phone: editEmergencyPhone || null,
              blood_group_id: bloodGroupId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
          if (roleError) console.warn('Patient table upsert error:', roleError);
        } catch (err) {
          console.warn('Patient table upsert exception:', err);
        }
      } else if (role === 'admin') {
        try {
          const { error: roleError } = await supabase.from('hospital_admin_profiles').upsert(
            {
              user_id: userProfile.id,
              employee_id: editEmployeeId || null,
              department: editDepartment || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
          if (roleError) console.warn('Hospital admin table upsert error:', roleError);
        } catch (err) {
          console.warn('Hospital admin table upsert exception:', err);
        }
      }

      if (!backendSuccess && !supabaseSuccess) {
        toast.error('Failed to save profile. Please check connection and try again.');
        setIsSaving(false);
        return;
      }

      await refreshProfile();
      toast.success('Profile updated successfully');
      setIsEditModalOpen(false);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const initials = getInitials(displayName);
  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  // Role-specific info
  const getRoleSpecificInfo = () => {
    switch (role) {
      case 'patient': {
        const assignedDoctorName = roleProfile?.assigned_doctor_name
          ? (String(roleProfile.assigned_doctor_name).startsWith('Dr.')
              ? roleProfile.assigned_doctor_name
              : `Dr. ${roleProfile.assigned_doctor_name}`)
          : '';
        return [
          {
            label: 'Assigned Doctor',
            value: assignedDoctorName,
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            ),
          },
          {
            label: 'Associated Hospital',
            value: roleProfile?.hospitals?.name || hospitalName || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            ),
          },
          {
            label: 'Date of Birth',
            value: roleProfile?.date_of_birth ? new Date(roleProfile.date_of_birth).toLocaleDateString() : '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
          },
          {
            label: 'Blood Group',
            value: roleProfile?.blood_type || roleProfile?.blood_groups?.blood_type || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            ),
          },
          {
            label: 'Emergency Contact',
            value: [roleProfile?.emergency_contact_name, roleProfile?.emergency_contact_phone]
              .filter(Boolean)
              .join(' - '),
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            ),
          },
        ];
      }
      case 'doctor':
        return [
          {
            label: 'Qualification',
            value: roleProfile?.qualification_name || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            ),
          },
          {
            label: 'License Number',
            value: roleProfile?.medical_license || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            ),
          },
          {
            label: 'Specialization',
            value: roleProfile?.specialization || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            ),
          },
          {
            label: 'Hospital',
            value: roleProfile?.hospitals?.name || hospitalName || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            ),
          },
          {
            label: 'Experience',
            value: roleProfile?.experience_years ? `${roleProfile.experience_years} years` : '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
        ];
      case 'radiologist':
        return [
          {
            label: 'Qualification',
            value: roleProfile?.qualification_name || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            ),
          },
          {
            label: 'License Number',
            value: roleProfile?.radiologist_license || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            ),
          },
          {
            label: 'Imaging Expertise',
            value: roleProfile?.imaging_expertise || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            ),
          },
          {
            label: 'Certifications',
            value: roleProfile?.certifications || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            ),
          },
          {
            label: 'Hospital',
            value: roleProfile?.hospitals?.name || hospitalName || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            ),
          },
          {
            label: 'Experience',
            value: roleProfile?.experience_years ? `${roleProfile.experience_years} years` : '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
        ];
      case 'admin':
        return [
          {
            label: 'Employee ID',
            value: roleProfile?.employee_id || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            ),
          },
          {
            label: 'Department',
            value: roleProfile?.department || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            ),
          },
          {
            label: 'Hospital',
            value: roleProfile?.hospitals?.name || hospitalName || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            ),
          },
        ];
      case 'super_admin':
        return [
          {
            label: 'Access Level',
            value: 'Platform (all hospitals)',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            ),
          },
        ];
      default:
        return [];
    }
  };

  const roleSpecificInfo = getRoleSpecificInfo();

  return (
    <RoleShell>
      <div className="pb-12">
        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="relative mb-8">
            {/* Cover Background */}
            <div className={cn('h-32 sm:h-40 rounded-t-3xl bg-gradient-to-r border border-slate-200 border-b-0 overflow-hidden', COVER_GRADIENT[accent])}>
              <div className="absolute inset-0">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="profileGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(100, 116, 139, 0.12)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#profileGrid)" />
                </svg>
              </div>
            </div>

            {/* Profile Card */}
            <div className="relative -mt-16 mx-4 sm:mx-8 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar */}
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-28 h-28 rounded-2xl object-cover shadow-lg border border-slate-200"
                    />
                  ) : (
                    <div className={cn('w-28 h-28 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-lg', styles.solid)}>
                      {initials}
                    </div>
                  )}
                  {/* Status indicator */}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-slate-200 rounded-lg flex items-center justify-center">
                    <div className={`w-3 h-3 rounded-full ${accountStatus === 'active' ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></div>
                  </div>
                </div>

                {/* User Info */}
                <div className="flex-1 text-center sm:text-left">
                  <h1 className="text-2xl font-bold text-slate-900 mb-1">{displayName}</h1>
                  <p className="text-slate-500 mb-3">
                    {role === 'patient'
                      ? (roleProfile?.assigned_doctor_name
                          ? `Assigned Doctor - ${String(roleProfile.assigned_doctor_name).startsWith('Dr.') ? roleProfile.assigned_doctor_name : `Dr. ${roleProfile.assigned_doctor_name}`}`
                          : 'No assigned doctor yet')
                      : email}
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border', styles.soft, styles.text, ACCENT_BORDER[accent])}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', styles.solid)}></span>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                      accountStatus === 'active'
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${accountStatus === 'active' ? 'bg-teal-500' : 'bg-red-500'}`}></span>
                      {accountStatus.charAt(0).toUpperCase() + accountStatus.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid md:grid-cols-2 gap-6 mx-4 sm:mx-0">
            {/* Contact Information */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className={cn('w-5 h-5', styles.text)} fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Contact Information
              </h2>
              <div className="space-y-3">
                <InfoCard
                  label="Email Address"
                  value={email}
                  accent={accent}
                  icon={<svg viewBox="0 0 24 24" className={cn('w-5 h-5', styles.text)} fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                />
                <InfoCard
                  label="Phone Number"
                  value={phone}
                  accent={accent}
                  icon={<svg viewBox="0 0 24 24" className={cn('w-5 h-5', styles.text)} fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
                />
                <InfoCard
                  label="Member Since"
                  value={joinDate}
                  accent={accent}
                  icon={<svg viewBox="0 0 24 24" className={cn('w-5 h-5', styles.text)} fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                />
              </div>
            </div>

            {/* Role Specific Information */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className={cn('w-5 h-5', styles.text)} fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                {role.charAt(0).toUpperCase() + role.slice(1)} Details
              </h2>
              <div className="space-y-3">
                {roleSpecificInfo.length > 0 ? (
                  roleSpecificInfo.map((info, index) => (
                    <InfoCard key={index} {...info} accent={accent} />
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p>No additional details available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Settings Section */}
          <div className="mt-6 mx-4 sm:mx-0 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Account Settings
            </h2>
            <div className="space-y-3">
              <SettingsLink
                href="/change-password"
                accent={accent}
                icon={<svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                title="Change Password"
                description="Update your account password"
              />
              <SettingsLink
                href={`/${role.replace(/_/g, '-')}/dashboard`}
                accent={accent}
                icon={<svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
                title="Go to Dashboard"
                description="Access your role-specific dashboard"
              />
            </div>
          </div>

          {/* Logout Section */}
          <div className="mt-6 mx-4 sm:mx-0">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full p-4 rounded-2xl flex items-center justify-center gap-3 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Logging out...</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-medium">Sign Out</span>
                </>
              )}
            </button>
          </div>

          {/* Footer Note */}
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400">
              Your data is protected with end-to-end encryption.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => !isSaving && setIsEditModalOpen(open)}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile &amp; Contact Information</DialogTitle>
            <DialogDescription>Update your profile picture, contact details, and role details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Profile Picture Selector */}
            <div className="grid gap-2">
              <Label>Profile Picture</Label>
              <div className="flex items-center gap-3 mb-2">
                {editAvatarUrl ? (
                  <img src={editAvatarUrl} alt="Avatar Preview" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl">
                    {initials}
                  </div>
                )}
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="avatar-file-input"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              setEditAvatarUrl(event.target.result as string);
                              setEditAvatarFileName(file.name);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label
                      htmlFor="avatar-file-input"
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all inline-block"
                    >
                      Upload JPG/PNG Image
                    </label>
                  </div>
                  {editAvatarFileName ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600">
                      <span className="truncate">Selected: {editAvatarFileName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditAvatarFileName('');
                          setEditAvatarUrl('');
                        }}
                        disabled={isSaving}
                        className="shrink-0 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <Input
                      placeholder="Or paste image URL..."
                      value={editAvatarUrl}
                      onChange={(e) => setEditAvatarUrl(e.target.value)}
                      disabled={isSaving}
                      className="text-xs"
                    />
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500">Choose a preset avatar:</p>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setEditAvatarUrl(url);
                      setEditAvatarFileName('');
                    }}
                    className={cn(
                      'w-10 h-10 rounded-lg overflow-hidden border-2 transition-all shrink-0',
                      editAvatarUrl === url ? 'border-indigo-600 scale-105' : 'border-transparent opacity-80 hover:opacity-100'
                    )}
                  >
                    <img src={url} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Contact Details */}
            <div className="grid gap-2">
              <Label htmlFor="edit-full-name">Full Name</Label>
              <Input
                id="edit-full-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                placeholder="+1 (555) 000-1003"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                disabled={isSaving}
              />
            </div>

            {/* Doctor / Radiologist Shared Fields */}
            {(role === 'doctor' || role === 'radiologist') && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-qualification">Qualification</Label>
                  <Select value={editQualificationId} onValueChange={setEditQualificationId} disabled={isSaving}>
                    <SelectTrigger id="edit-qualification">
                      <SelectValue placeholder="Select qualification" />
                    </SelectTrigger>
                    <SelectContent>
                      {qualifications.map((q) => (
                        <SelectItem key={q.id} value={String(q.id)}>
                          {q.qualification_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-license">License Number</Label>
                  <Input
                    id="edit-license"
                    placeholder="e.g. MED-849201"
                    value={editLicense}
                    onChange={(e) => setEditLicense(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-experience">Experience (Years)</Label>
                  <Input
                    id="edit-experience"
                    type="number"
                    placeholder="e.g. 8"
                    value={editExperience}
                    onChange={(e) => setEditExperience(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </>
            )}

            {/* Doctor-only field (doctor_profiles.specialization) */}
            {role === 'doctor' && (
              <div className="grid gap-2">
                <Label htmlFor="edit-specialization">Specialization</Label>
                <Input
                  id="edit-specialization"
                  placeholder="e.g. Neuroradiology / Clinical Neurology"
                  value={editSpecialization}
                  onChange={(e) => setEditSpecialization(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            )}

            {/* Radiologist-only fields (radiologist_profiles has no specialization
                column — it has imaging_expertise/certifications instead) */}
            {role === 'radiologist' && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-imaging-expertise">Imaging Expertise</Label>
                  <Input
                    id="edit-imaging-expertise"
                    placeholder="e.g. MRI, CT, Neuroimaging"
                    value={editImagingExpertise}
                    onChange={(e) => setEditImagingExpertise(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-certifications">Certifications</Label>
                  <Input
                    id="edit-certifications"
                    placeholder="e.g. Board Certified Radiologist"
                    value={editCertifications}
                    onChange={(e) => setEditCertifications(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </>
            )}

            {/* Patient Specific Fields */}
            {role === 'patient' && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-dob">Date of Birth</Label>
                  <Input
                    id="edit-dob"
                    type="date"
                    value={editDob}
                    onChange={(e) => setEditDob(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-emergency-name">Emergency Contact Name</Label>
                  <Input
                    id="edit-emergency-name"
                    placeholder="e.g. Jane Doe"
                    value={editEmergencyName}
                    onChange={(e) => setEditEmergencyName(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-emergency-phone">Emergency Contact Phone</Label>
                  <Input
                    id="edit-emergency-phone"
                    placeholder="+1 (555) 999-8888"
                    value={editEmergencyPhone}
                    onChange={(e) => setEditEmergencyPhone(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-blood-group">Blood Group</Label>
                  <Select value={editBloodGroupId} onValueChange={setEditBloodGroupId} disabled={isSaving}>
                    <SelectTrigger id="edit-blood-group">
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      {bloodGroups.map((bg) => (
                        <SelectItem key={bg.id} value={String(bg.id)}>
                          {bg.blood_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Hospital Admin Specific Fields */}
            {role === 'admin' && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-employee-id">Employee ID</Label>
                  <Input
                    id="edit-employee-id"
                    placeholder="e.g. EMP-2024-001"
                    value={editEmployeeId}
                    onChange={(e) => setEditEmployeeId(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-department">Department</Label>
                  <Input
                    id="edit-department"
                    placeholder="e.g. Radiology Administration"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={isSaving || !editName}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}

export default withAuth(ProfilePage);
