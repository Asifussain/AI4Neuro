'use client';

import { Navbar } from '@/components/shared/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useAuth } from '@/components/providers/AuthProvider';
import { Upload, ArrowLeft, FileUp, X, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { withAuth } from '@/lib/withAuth';
import { createClient } from '@/lib/supabase/client';

interface Patient {
  id: string;
  patient_code: string;
  full_name: string;
}

interface Doctor {
  id: string;
  doctor_code: string;
  full_name: string;
  specialization: string;
}

function RadiologistUploadPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [analysisType, setAnalysisType] = useState('multi-disease');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');

  // Data states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch patients and doctors
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      setLoadingData(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoadingData(false);
          return;
        }

        // Get patients
        const { data: patientsData, error: patientsError } = await supabase
          .from('patient_profiles')
          .select('id, patient_code, user_id')
          .limit(100);

        if (!patientsError && patientsData) {
          const userIds = patientsData.map((p: any) => p.user_id);
          const { data: usersData } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
          const userMap = new Map(usersData?.map((u: any) => [u.id, u.full_name]) || []);

          setPatients(patientsData.map((p: any) => ({
            id: p.id,
            patient_code: p.patient_code,
            full_name: userMap.get(p.user_id) || `Patient ${p.patient_code}`
          })));
        }

        // Get doctors
        const { data: doctorsData, error: doctorsError } = await supabase
          .from('doctor_profiles')
          .select('id, doctor_code, specialization, user_id')
          .limit(100);

        if (!doctorsError && doctorsData) {
          const userIds = doctorsData.map((d: any) => d.user_id);
          const { data: usersData } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
          const userMap = new Map(usersData?.map((u: any) => [u.id, u.full_name]) || []);

          setDoctors(doctorsData.map((d: any) => ({
            id: d.id,
            doctor_code: d.doctor_code,
            full_name: userMap.get(d.user_id) || `Doctor ${d.doctor_code}`,
            specialization: d.specialization || ''
          })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      const validFiles = filesArray.filter(f => /\.(nii|nii\.gz|dcm|dicom|zip|gz)$/i.test(f.name));
      if (validFiles.length > 0) setSelectedFiles(prev => [...prev, ...validFiles]);
    }
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!selectedPatient || selectedFiles.length === 0) {
      toast.error('Please select a patient and at least one file');
      return;
    }

    setUploading(true);
    setUploadProgress('uploading');

    try {
      const supabase = createClient();

      // 1. Get Radiologist ID
      const { data: radProfile } = await supabase
        .from('radiologist_profiles')
        .select('id')
        .eq('user_id', userProfile?.id)
        .single();

      // 2. Create Initial Session
      const { data: session, error: sessionError } = await supabase
        .from('mri_sessions')
        .insert({
          patient_id: selectedPatient,
          doctor_id: selectedDoctor || null,
          radiologist_id: radProfile?.id || null,
          scan_date: new Date().toISOString(),
          status: 'processing', // Mark as processing immediately
          session_code: `MRI-${Date.now()}`,
          analysis_type: analysisType,
          notes: notes || null
        })
        .select()
        .single();

      if (sessionError) throw new Error('Failed to create session');

      setUploadProgress('processing');

      // 3. Send to Python Backend
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      const formData = new FormData();
      formData.append('file', selectedFiles[0]);
      formData.append('session_id', session.id);
      formData.append('analysis_type', analysisType);

      // --- INCREASE TIMEOUT WARNING ---
      // Note: Browsers may timeout after 2-5 minutes. 
      // Ideally, ensure your browser doesn't kill the request.
      const response = await fetch(`${backendUrl}/api/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        await supabase.from('mri_sessions').update({ status: 'failed' }).eq('id', session.id);
        throw new Error('Analysis failed on server');
      }

      const result = await response.json();

      // 4. Backend handles everything (prediction records, reports, status updates)
      // Poll session status until completed or failed
      if (result.status === 'processing' || result.status === 'success') {
        setUploadProgress('processing');

        // Poll every 5 seconds for up to 40 minutes (CAT12 can take ~30 min)
        const maxAttempts = 480;
        let attempts = 0;
        let finalStatus = '';

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;

          const { data: sessionCheck } = await supabase
            .from('mri_sessions')
            .select('status')
            .eq('id', session.id)
            .single();

          if (sessionCheck?.status === 'completed') {
            finalStatus = 'completed';
            break;
          } else if (sessionCheck?.status === 'failed') {
            finalStatus = 'failed';
            break;
          }
        }

        if (finalStatus === 'completed') {
          setUploadProgress('success');
          toast.success('Analysis Complete!');
          setTimeout(() => router.push('/radiologist/dashboard'), 1500);
        } else if (finalStatus === 'failed') {
          throw new Error('Analysis failed during processing');
        } else {
          throw new Error('Analysis timed out - check dashboard for status');
        }
      } else {
        throw new Error('Backend returned unexpected status: ' + result.status);
      }

    } catch (error) {
      setUploadProgress('error');
      console.error(error);
      toast.error('Upload failed. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => setSelectedFiles(selectedFiles.filter((_, i) => i !== index));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="p-6 space-y-6 max-w-4xl mx-auto pt-24">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/radiologist/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Upload MRI Scan</h1>
            <p className="text-sm text-muted-foreground">Upload NIfTI or DICOM files for AI analysis</p>
          </div>
        </div>

        {/* Success/Error Messages */}
        {uploadProgress === 'success' && (
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-4 flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <h3 className="font-semibold text-green-500">Analysis Successful!</h3>
                <p className="text-sm text-green-400">Redirecting to dashboard...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Form */}
        {uploadProgress !== 'success' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>MRI Files</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary cursor-pointer"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm">Click to upload .nii or .dcm files</p>
                  <input id="file-input" type="file" multiple className="hidden" onChange={handleFileChange} />
                </div>
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex justify-between p-2 bg-muted rounded text-sm">
                    {f.name} <X className="h-4 w-4 cursor-pointer" onClick={() => removeFile(i)} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Patient</Label>
                  <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                    <SelectTrigger><SelectValue placeholder="Select Patient" /></SelectTrigger>
                    <SelectContent>
                      {patients.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Referring Doctor</Label>
                  <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                    <SelectTrigger><SelectValue placeholder="Select Doctor (Optional)" /></SelectTrigger>
                    <SelectContent>
                      {doctors.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.full_name}{d.specialization ? ` - ${d.specialization}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Analysis Type</Label>
                  <Select value={analysisType} onValueChange={setAnalysisType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multi-disease">Multi-Disease</SelectItem>
                      <SelectItem value="ad-only">Alzheimer's Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Actions */}
        {uploadProgress !== 'success' && (
          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild><Link href="/radiologist/dashboard">Cancel</Link></Button>
            <Button onClick={handleUpload} disabled={uploading || !selectedPatient || !selectedFiles.length}>
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing (This takes ~20 mins)...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Start Analysis</>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(RadiologistUploadPage, { allowedRoles: ['radiologist', 'admin'] });