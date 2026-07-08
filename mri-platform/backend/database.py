"""
Database helper functions for MRI Platform.
Handles all Supabase database operations for report generation.
"""

import traceback
from typing import Dict, Any, Optional, Tuple
from supabase_client import get_supabase_client
from config import MRI_SCANS_BUCKET, REPORT_ASSETS_BUCKET


def get_session_with_prediction(session_id: str) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Fetch an MRI session with its prediction data.

    Args:
        session_id: UUID of the MRI session

    Returns:
        Tuple of (session_data, error_message)
    """
    supabase = get_supabase_client()

    try:
        # Fetch session
        session_res = supabase.table('mri_sessions').select('*').eq('id', session_id).maybe_single().execute()

        if not session_res.data:
            return None, "Session not found"

        session_data = session_res.data

        # Fetch associated prediction
        prediction_res = supabase.table('mri_predictions').select('*').eq('session_id', session_id).maybe_single().execute()

        if prediction_res.data:
            session_data['prediction'] = prediction_res.data

        return session_data, None

    except Exception as e:
        print(f"Error fetching session {session_id}: {e}")
        traceback.print_exc()
        return None, str(e)


def get_comprehensive_report_data(session_id: str) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Fetch all data needed for comprehensive medical report generation.

    Includes:
    - MRI session details
    - Prediction results
    - Patient information (user profile + patient profile)
    - Doctor information (user profile + doctor profile)
    - Radiologist information (user profile + radiologist profile)
    - Hospital information
    - Blood group
    - Qualifications

    Args:
        session_id: UUID of the MRI session

    Returns:
        Tuple of (comprehensive_data_dict, error_message)
    """
    supabase = get_supabase_client()

    try:
        # Initialize comprehensive data structure
        comprehensive_data = {
            'session': None,
            'prediction': None,
            'hospital': None,
            'patient': None,
            'patient_profile': None,
            'doctor': None,
            'doctor_profile': None,
            'radiologist': None,
            'radiologist_profile': None,
            'blood_group': None,
            'doctor_qualification': None,
            'radiologist_qualification': None
        }

        # =================================================================
        # Fetch MRI Session
        # =================================================================
        session_res = supabase.table('mri_sessions').select('*').eq('id', session_id).maybe_single().execute()

        if not session_res.data:
            return None, "Session not found"

        comprehensive_data['session'] = session_res.data
        session_data = session_res.data

        print(f"[DB] Fetched session: {session_data.get('session_code')}")

        # =================================================================
        # Fetch Prediction
        # =================================================================
        prediction_res = supabase.table('mri_predictions').select('*').eq('session_id', session_id).maybe_single().execute()

        if prediction_res.data:
            comprehensive_data['prediction'] = prediction_res.data
            print(f"[DB] Fetched prediction: {prediction_res.data.get('prediction')}")

        # =================================================================
        # Fetch Patient Information
        # =================================================================
        patient_profile_id = session_data.get('patient_id')
        if patient_profile_id:
            try:
                # Fetch patient profile
                patient_profile_res = supabase.table('patient_profiles').select('*').eq('id', patient_profile_id).maybe_single().execute()

                if patient_profile_res.data:
                    comprehensive_data['patient_profile'] = patient_profile_res.data
                    patient_user_id = patient_profile_res.data.get('user_id')

                    # Fetch user profile for patient
                    if patient_user_id:
                        patient_user_res = supabase.table('user_profiles').select('*').eq('id', patient_user_id).maybe_single().execute()
                        if patient_user_res.data:
                            comprehensive_data['patient'] = patient_user_res.data
                            print(f"[DB] Fetched patient: {patient_user_res.data.get('full_name')}")

                    # Fetch blood group
                    blood_group_id = patient_profile_res.data.get('blood_group_id')
                    if blood_group_id:
                        blood_res = supabase.table('blood_groups').select('*').eq('id', blood_group_id).maybe_single().execute()
                        if blood_res.data:
                            comprehensive_data['blood_group'] = blood_res.data.get('blood_group')

            except Exception as e:
                print(f"[DB] Warning: Could not fetch patient data: {e}")

        # =================================================================
        # Fetch Doctor Information
        # =================================================================
        doctor_profile_id = session_data.get('doctor_id')
        if doctor_profile_id:
            try:
                # Fetch doctor profile
                doctor_profile_res = supabase.table('doctor_profiles').select('*').eq('id', doctor_profile_id).maybe_single().execute()

                if doctor_profile_res.data:
                    comprehensive_data['doctor_profile'] = doctor_profile_res.data
                    doctor_user_id = doctor_profile_res.data.get('user_id')

                    # Fetch user profile for doctor
                    if doctor_user_id:
                        doctor_user_res = supabase.table('user_profiles').select('*').eq('id', doctor_user_id).maybe_single().execute()
                        if doctor_user_res.data:
                            comprehensive_data['doctor'] = doctor_user_res.data
                            print(f"[DB] Fetched doctor: {doctor_user_res.data.get('full_name')}")

                    # Fetch doctor's qualification
                    qual_id = doctor_profile_res.data.get('qualification_id')
                    if qual_id:
                        qual_res = supabase.table('qualifications').select('*').eq('id', qual_id).maybe_single().execute()
                        if qual_res.data:
                            comprehensive_data['doctor_qualification'] = qual_res.data

                    # Fetch hospital from doctor profile
                    hospital_id = doctor_profile_res.data.get('hospital_id')
                    if hospital_id and not comprehensive_data['hospital']:
                        hospital_res = supabase.table('hospitals').select('*').eq('id', hospital_id).maybe_single().execute()
                        if hospital_res.data:
                            comprehensive_data['hospital'] = hospital_res.data

            except Exception as e:
                print(f"[DB] Warning: Could not fetch doctor data: {e}")

        # =================================================================
        # Fetch Radiologist Information
        # =================================================================
        radiologist_profile_id = session_data.get('radiologist_id')
        if radiologist_profile_id:
            try:
                # Fetch radiologist profile
                radiologist_profile_res = supabase.table('radiologist_profiles').select('*').eq('id', radiologist_profile_id).maybe_single().execute()

                if radiologist_profile_res.data:
                    comprehensive_data['radiologist_profile'] = radiologist_profile_res.data
                    radiologist_user_id = radiologist_profile_res.data.get('user_id')

                    # Fetch user profile for radiologist
                    if radiologist_user_id:
                        radiologist_user_res = supabase.table('user_profiles').select('*').eq('id', radiologist_user_id).maybe_single().execute()
                        if radiologist_user_res.data:
                            comprehensive_data['radiologist'] = radiologist_user_res.data
                            print(f"[DB] Fetched radiologist: {radiologist_user_res.data.get('full_name')}")

                    # Fetch radiologist's qualification
                    qual_id = radiologist_profile_res.data.get('qualification_id')
                    if qual_id:
                        qual_res = supabase.table('qualifications').select('*').eq('id', qual_id).maybe_single().execute()
                        if qual_res.data:
                            comprehensive_data['radiologist_qualification'] = qual_res.data

                    # Fetch hospital from radiologist profile (if not already fetched)
                    if not comprehensive_data['hospital']:
                        hospital_id = radiologist_profile_res.data.get('hospital_id')
                        if hospital_id:
                            hospital_res = supabase.table('hospitals').select('*').eq('id', hospital_id).maybe_single().execute()
                            if hospital_res.data:
                                comprehensive_data['hospital'] = hospital_res.data

            except Exception as e:
                print(f"[DB] Warning: Could not fetch radiologist data: {e}")

        print(f"[DB] Successfully fetched comprehensive report data for session {session_id}")
        return comprehensive_data, None

    except Exception as e:
        print(f"[DB] Error fetching comprehensive data: {e}")
        traceback.print_exc()
        return None, str(e)


def update_prediction_with_reports(
    prediction_id: str,
    report_urls: Dict[str, str],
    additional_data: Optional[Dict[str, Any]] = None
) -> Tuple[bool, Optional[str]]:
    """
    Update prediction record with report URLs and additional data.

    Args:
        prediction_id: UUID of the prediction
        report_urls: Dict with keys like 'technical_pdf_url', 'clinician_pdf_url', etc.
        additional_data: Optional additional fields to update

    Returns:
        Tuple of (success, error_message)
    """
    supabase = get_supabase_client()

    try:
        update_payload = {**report_urls}

        if additional_data:
            update_payload.update(additional_data)

        supabase.table('mri_predictions').update(update_payload).eq('id', prediction_id).execute()

        print(f"[DB] Updated prediction {prediction_id} with report URLs")
        return True, None

    except Exception as e:
        print(f"[DB] Error updating prediction: {e}")
        traceback.print_exc()
        return False, str(e)


def update_session_status(session_id: str, status: str) -> Tuple[bool, Optional[str]]:
    """
    Update MRI session status.

    Args:
        session_id: UUID of the session
        status: New status value

    Returns:
        Tuple of (success, error_message)
    """
    supabase = get_supabase_client()

    try:
        supabase.table('mri_sessions').update({'status': status}).eq('id', session_id).execute()
        print(f"[DB] Updated session {session_id} status to: {status}")
        return True, None

    except Exception as e:
        print(f"[DB] Error updating session status: {e}")
        return False, str(e)


def create_prediction_record(
    session_id: str,
    prediction_data: Dict[str, Any]
) -> Tuple[Optional[str], Optional[str]]:
    """
    Create a new prediction record.

    Args:
        session_id: UUID of the MRI session
        prediction_data: Prediction data from ML model

    Returns:
        Tuple of (prediction_id, error_message)
    """
    supabase = get_supabase_client()

    try:
        record = {
            'session_id': session_id,
            'prediction': prediction_data.get('prediction'),
            'confidence_score': prediction_data.get('confidence'),
            'probabilities': prediction_data.get('probabilities'),
            'brain_volume': prediction_data.get('brain_volume'),
            'gm_volume': prediction_data.get('gm_volume'),
            'wm_volume': prediction_data.get('wm_volume'),
            'csf_volume': prediction_data.get('csf_volume'),
            'hippocampal_volume': prediction_data.get('hippocampal_volume'),
            'ventricular_volume': prediction_data.get('ventricular_volume'),
            'model_version': prediction_data.get('model_version'),
            'processing_time': prediction_data.get('processing_time')
        }

        result = supabase.table('mri_predictions').insert(record).execute()

        if result.data:
            prediction_id = result.data[0]['id']
            print(f"[DB] Created prediction record: {prediction_id}")
            return prediction_id, None

        return None, "Failed to create prediction record"

    except Exception as e:
        print(f"[DB] Error creating prediction: {e}")
        traceback.print_exc()
        return None, str(e)


def cleanup_storage_on_error(bucket_name: str, path: str) -> None:
    """
    Clean up uploaded files from storage on error.

    Args:
        bucket_name: Storage bucket name
        path: File path to remove
    """
    supabase = get_supabase_client()

    try:
        if bucket_name and path:
            print(f"[Storage] Cleaning up: {bucket_name}/{path}")
            supabase.storage.from_(bucket_name).remove([path])
    except Exception as e:
        print(f"[Storage] Cleanup error: {e}")


def upload_to_storage(
    bucket_name: str,
    path: str,
    file_bytes: bytes,
    content_type: str = 'application/octet-stream'
) -> Tuple[Optional[str], Optional[str]]:
    """
    Upload a file to Supabase storage.

    Args:
        bucket_name: Storage bucket name
        path: Destination path
        file_bytes: File content as bytes
        content_type: MIME type of the file

    Returns:
        Tuple of (public_url, error_message)
    """
    supabase = get_supabase_client()

    try:
        supabase.storage.from_(bucket_name).upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "true"}
        )

        public_url = supabase.storage.from_(bucket_name).get_public_url(path)
        print(f"[Storage] Uploaded: {bucket_name}/{path}")

        return public_url, None

    except Exception as e:
        print(f"[Storage] Upload error: {e}")
        return None, str(e)
