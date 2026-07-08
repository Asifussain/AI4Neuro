import io
import numpy as np
import traceback
from supabase_client_setup import get_supabase_client
from config import RAW_EEG_BUCKET

def get_prediction_and_eeg(prediction_id: str):
    """
    Fetches a prediction record and its associated raw EEG data from Supabase.
    """
    supabase = get_supabase_client()
    print(f"DB Helper: Fetching record for prediction ID: {prediction_id}")
    prediction_rec = None
    try:
        prediction_res = supabase.table('predictions').select('*').eq('id', prediction_id).maybe_single().execute()
        
        if not prediction_res.data:
            return None, None, "Prediction record not found"
        
        prediction_rec = prediction_res.data
        eeg_url_path = prediction_rec.get('eeg_data_url')

        if not eeg_url_path:
            return prediction_rec, None, "EEG data URL missing from prediction record"

        print(f"DB Helper: Downloading EEG data from path: {eeg_url_path}")
        eeg_file_response = supabase.storage.from_(RAW_EEG_BUCKET).download(eeg_url_path)

        if not isinstance(eeg_file_response, bytes):
            error_message = f"Failed to download raw EEG file. Response: {getattr(eeg_file_response, 'message', str(eeg_file_response))}"
            print(f"DB Helper Error: {error_message}")
            return prediction_rec, None, error_message

        with io.BytesIO(eeg_file_response) as f:
            eeg_data = np.load(f, allow_pickle=True)
        
        # Standardize EEG data shape (samples, channels)
        if eeg_data.ndim == 3: 
            print(f"DB Helper: Original 3D EEG data shape: {eeg_data.shape}. Using first trial.")
            eeg_data = eeg_data[0, :, :] 
        
        if eeg_data.ndim != 2:
            raise ValueError(f"Unsupported EEG data dimension after potential trial selection: {eeg_data.ndim}")

        if eeg_data.shape[0] < eeg_data.shape[1]:
            print(f"DB Helper: Transposing EEG data from {eeg_data.shape} to {(eeg_data.shape[1], eeg_data.shape[0])}")
            eeg_data = eeg_data.T
            
        if eeg_data.ndim != 2: 
             raise ValueError(f"Final EEG data is not 2D after processing: {eeg_data.shape}")

        print(f"DB Helper: Successfully processed EEG data. Final shape: {eeg_data.shape}")
        return prediction_rec, eeg_data.astype(np.double), None

    except Exception as e:
        print(f"DB Helper Error for prediction ID {prediction_id}: {e}")
        traceback.print_exc()
        return (prediction_rec if prediction_rec else None), None, f"Error accessing/processing data: {str(e)}"

def get_comprehensive_report_data(prediction_id: str):
    """
    Fetches comprehensive data for medical report generation including:
    - Prediction/analysis results
    - Complete hospital information
    - Complete patient demographics and medical history
    - Complete doctor information
    - Complete radiologist/technician information
    - EEG session details (if available)
    """
    supabase = get_supabase_client()
    print(f"DB Helper: Fetching comprehensive report data for prediction ID: {prediction_id}")

    try:
        # Fetch prediction record
        prediction_res = supabase.table('predictions').select('*').eq('id', prediction_id).maybe_single().execute()

        if not prediction_res.data:
            return None, "Prediction record not found"

        prediction_data = prediction_res.data
        comprehensive_data = {
            'prediction': prediction_data,
            'hospital': None,
            'patient': None,
            'patient_profile': None,
            'doctor': None,
            'doctor_profile': None,
            'radiologist': None,
            'radiologist_profile': None,
            'session': None,
            'blood_group': None,
            'doctor_qualification': None,
            'radiologist_qualification': None
        }

        # Fetch Hospital Information
        hospital_id = prediction_data.get('hospital_id')
        if hospital_id:
            try:
                hospital_res = supabase.table('hospitals').select('*').eq('id', hospital_id).maybe_single().execute()
                if hospital_res.data:
                    comprehensive_data['hospital'] = hospital_res.data
                    print(f"DB Helper: Hospital data fetched for {hospital_res.data.get('name')}")
            except Exception as e:
                print(f"DB Helper Warning: Could not fetch hospital data: {e}")

        # Fetch Patient Information
        patient_id = prediction_data.get('patient_id')
        if patient_id:
            try:
                # Fetch user profile
                patient_user_res = supabase.table('user_profiles').select('*').eq('id', patient_id).maybe_single().execute()
                if patient_user_res.data:
                    comprehensive_data['patient'] = patient_user_res.data

                # Fetch patient profile
                patient_profile_res = supabase.table('patient_profiles').select('*').eq('user_id', patient_id).maybe_single().execute()
                if patient_profile_res.data:
                    comprehensive_data['patient_profile'] = patient_profile_res.data

                    # Fetch blood group if available
                    blood_group_id = patient_profile_res.data.get('blood_group_id')
                    if blood_group_id:
                        blood_group_res = supabase.table('blood_groups').select('*').eq('id', blood_group_id).maybe_single().execute()
                        if blood_group_res.data:
                            comprehensive_data['blood_group'] = blood_group_res.data.get('blood_type')

                print(f"DB Helper: Patient data fetched for {patient_user_res.data.get('full_name', 'Unknown')}")
            except Exception as e:
                print(f"DB Helper Warning: Could not fetch patient data: {e}")

        # Fetch Doctor Information
        doctor_id = prediction_data.get('doctor_id')
        if doctor_id:
            try:
                # Fetch user profile
                doctor_user_res = supabase.table('user_profiles').select('*').eq('id', doctor_id).maybe_single().execute()
                if doctor_user_res.data:
                    comprehensive_data['doctor'] = doctor_user_res.data

                # Fetch doctor profile
                doctor_profile_res = supabase.table('doctor_profiles').select('*').eq('user_id', doctor_id).maybe_single().execute()
                if doctor_profile_res.data:
                    comprehensive_data['doctor_profile'] = doctor_profile_res.data

                    # Fetch qualification if available
                    qual_id = doctor_profile_res.data.get('qualification_id')
                    if qual_id:
                        qual_res = supabase.table('qualifications').select('*').eq('id', qual_id).maybe_single().execute()
                        if qual_res.data:
                            comprehensive_data['doctor_qualification'] = qual_res.data

                print(f"DB Helper: Doctor data fetched for {doctor_user_res.data.get('full_name', 'Unknown')}")
            except Exception as e:
                print(f"DB Helper Warning: Could not fetch doctor data: {e}")

        # Fetch Radiologist/Technician Information
        radiologist_id = prediction_data.get('radiologist_id') or prediction_data.get('technician_id')
        if radiologist_id:
            try:
                # Fetch user profile
                radiologist_user_res = supabase.table('user_profiles').select('*').eq('id', radiologist_id).maybe_single().execute()
                if radiologist_user_res.data:
                    comprehensive_data['radiologist'] = radiologist_user_res.data

                # Try to fetch radiologist profile
                radiologist_profile_res = supabase.table('radiologist_profiles').select('*').eq('user_id', radiologist_id).maybe_single().execute()
                if radiologist_profile_res.data:
                    comprehensive_data['radiologist_profile'] = radiologist_profile_res.data

                    # Fetch qualification if available
                    qual_id = radiologist_profile_res.data.get('qualification_id')
                    if qual_id:
                        qual_res = supabase.table('qualifications').select('*').eq('id', qual_id).maybe_single().execute()
                        if qual_res.data:
                            comprehensive_data['radiologist_qualification'] = qual_res.data

                print(f"DB Helper: Radiologist data fetched for {radiologist_user_res.data.get('full_name', 'Unknown')}")
            except Exception as e:
                print(f"DB Helper Warning: Could not fetch radiologist data: {e}")

        # Try to fetch EEG session information if session_code exists
        session_code = prediction_data.get('session_code')
        if session_code:
            try:
                session_res = supabase.table('eeg_sessions').select('*').eq('session_code', session_code).maybe_single().execute()
                if session_res.data:
                    comprehensive_data['session'] = session_res.data
                    print(f"DB Helper: EEG session data fetched for session {session_code}")
            except Exception as e:
                print(f"DB Helper Warning: Could not fetch session data: {e}")

        print(f"DB Helper: Successfully fetched comprehensive report data")
        return comprehensive_data, None

    except Exception as e:
        print(f"DB Helper Error fetching comprehensive data for prediction ID {prediction_id}: {e}")
        traceback.print_exc()
        return None, f"Error fetching comprehensive report data: {str(e)}"

def cleanup_storage_on_error(bucket_name: str, path: str):
    """
    Removes an object from the specified Supabase storage bucket.
    """
    supabase = get_supabase_client()
    try:
        if bucket_name and path:
            print(f"Storage Cleanup: Attempting to remove '{path}' from bucket '{bucket_name}'")
            response = supabase.storage.from_(bucket_name).remove([path])
            # print(f"Storage Cleanup Response: {response}") # For detailed debugging
    except Exception as e:
        print(f"Error during storage cleanup of '{path}' in '{bucket_name}': {e}")
        traceback.print_exc()