import os
import uuid
import json
import traceback
from datetime import datetime, timezone
import base64
import numpy as np
from flask import request, jsonify
from werkzeug.utils import secure_filename

from celery_utils import celery_app
from supabase_client_setup import get_supabase_client
from config import (
    UPLOAD_FOLDER, RAW_EEG_BUCKET, REPORT_ASSET_BUCKET,
    DEFAULT_FS, ALZ_REF_PATH, NORM_REF_PATH, MCI_REF_PATH,
    ALZ_REF_MULTICLASS_PATH, NORM_REF_MULTICLASS_PATH
)
from utils import NpEncoder
from database import get_prediction_and_eeg, get_comprehensive_report_data, cleanup_storage_on_error
from ml_runner import run_model
from visualization import (
    generate_stacked_timeseries_image,
    generate_average_psd_image,
    generate_descriptive_stats
)
from similarity_analyzer import run_similarity_analysis, run_multiclass_similarity_analysis
from pdf_generation import (
   TechnicalPDFReport, build_technical_pdf_report_content,
   PatientPDFReport, build_patient_pdf_report_content,
   ClinicianPDFReport, build_clinician_pdf_report_content
)
from routes import api_bp

def decode_base64_image_for_upload(base64_string):
    # Decode base64 image string for upload
    if not isinstance(base64_string, str): return None
    try: return base64.b64decode(base64_string.split(',', 1)[1])
    except (IndexError, TypeError, base64.binascii.Error): return None

@celery_app.task(name='predict_api.run_full_analysis_task')
def run_full_analysis_task(prediction_id, encoded_file_content, channel_index_for_plot, original_filename, classification_type='binary'):
    # Main background task for running ML and generating reports
    supabase = get_supabase_client()
    asset_prefix = f"report_assets/{prediction_id}"
    report_generation_errors = []
    ml_output_file_path = None
    assets_to_clean = []
    temp_filename_in_worker = f"{prediction_id}_{original_filename}"
    temp_filepath_in_worker = os.path.join(UPLOAD_FOLDER, temp_filename_in_worker)
    try:
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        # Save EEG file locally
        with open(temp_filepath_in_worker, 'wb') as f:
            f.write(base64.b64decode(encoded_file_content))
        # Run ML model
        ml_output_file_path = run_model(temp_filepath_in_worker, classification_type)
        if not os.path.exists(ml_output_file_path): raise FileNotFoundError(f"ML output at {ml_output_file_path} not found.")
        with open(ml_output_file_path, 'r') as f: ml_output_data = json.load(f)

        # Map prediction to label based on classification type
        majority_pred_value = ml_output_data.get('majority_prediction')
        if classification_type == 'multiclass':
            # Multiclass: 0=CN, 1=MCI, 2=AD (3 classes)
            class_labels = {0: "CN (Normal)", 1: "MCI", 2: "AD"}
            prediction_label = class_labels.get(majority_pred_value, "Unknown")
        else:
            # Binary: 0=Normal, 1=Alzheimer's
            prediction_label = "Alzheimer's" if majority_pred_value == 1 else "Normal"

        consistency_metrics = ml_output_data.get('consistency_metrics')
        ml_update_payload = {
            "prediction": prediction_label, "probabilities": ml_output_data.get('probabilities'),
            "status": "Generating assets", "trial_predictions": ml_output_data.get('trial_predictions'),
            "consistency_metrics": consistency_metrics
        }
        # Update DB with ML results
        supabase.table('predictions').update(json.loads(json.dumps(ml_update_payload, cls=NpEncoder))).eq('id', prediction_id).execute()
        # Load EEG data for report
        prediction_data_for_report, eeg_data, error_msg = get_prediction_and_eeg(prediction_id)
        if error_msg or eeg_data is None: raise Exception(f"Could not load EEG data: {error_msg}")
        # Generate stats and plots
        stats_json = generate_descriptive_stats(eeg_data, DEFAULT_FS)
        ts_img_base64 = generate_stacked_timeseries_image(eeg_data, DEFAULT_FS)
        psd_img_base64 = generate_average_psd_image(eeg_data, DEFAULT_FS)

        # Run appropriate similarity analysis based on classification type
        if classification_type == 'multiclass':
            # Use 256-timepoint reference files for multiclass (ADFD-Indep model)
            similarity_results = run_multiclass_similarity_analysis(
                temp_filepath_in_worker,
                NORM_REF_MULTICLASS_PATH,  # cn_repr.npy (256 timepoints)
                MCI_REF_PATH,               # mci_repr.npy (256 timepoints)
                ALZ_REF_MULTICLASS_PATH,    # ad_repr.npy (256 timepoints)
                channel_index_for_plot
            )
        else:
            similarity_results = run_similarity_analysis(temp_filepath_in_worker, ALZ_REF_PATH, NORM_REF_PATH, channel_index_for_plot)

        similarity_plot_base64 = similarity_results.get('plot_base64') if isinstance(similarity_results, dict) else None
        uploaded_asset_urls = {}
        # Upload generated images to storage
        for img_data, filename_s3, url_key in [
            (similarity_plot_base64, f"{asset_prefix}/similarity_plot.png", "similarity_plot_url"),
            (ts_img_base64, f"{asset_prefix}/timeseries.png", "timeseries_plot_url"),
            (psd_img_base64, f"{asset_prefix}/psd.png", "psd_plot_url")
        ]:
            assets_to_clean.append(filename_s3)
            img_bytes = decode_base64_image_for_upload(img_data)
            if img_bytes:
                try:
                    supabase.storage.from_(REPORT_ASSET_BUCKET).upload(path=filename_s3, file=img_bytes, file_options={"content-type": "image/png", "upsert": "true"})
                    uploaded_asset_urls[url_key] = supabase.storage.from_(REPORT_ASSET_BUCKET).get_public_url(filename_s3)
                except Exception as e: report_generation_errors.append(f"{url_key} Upload Fail")
        # Fetch comprehensive medical data for professional reports
        print(f"Fetching comprehensive medical data for report generation...")
        comprehensive_data, comp_error = get_comprehensive_report_data(prediction_id)
        if comp_error:
            print(f"WARNING: Could not fetch comprehensive data: {comp_error}")
            # Fallback to basic prediction data if comprehensive data fetch fails
            comprehensive_data = {
                'prediction': prediction_data_for_report,
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

        # Generate and upload PDF reports with comprehensive data
        pdf_types = [
            ("technical", TechnicalPDFReport, build_technical_pdf_report_content),
            ("patient", PatientPDFReport, build_patient_pdf_report_content),
            ("clinician", ClinicianPDFReport, build_clinician_pdf_report_content)
        ]
        for pdf_type, PdfClass, builder in pdf_types:
            pdf_filename_s3 = f"{asset_prefix}/{pdf_type}_report.pdf"
            assets_to_clean.append(pdf_filename_s3)
            try:
                pdf_doc = PdfClass()
                pdf_doc.alias_nb_pages()
                # Use new comprehensive data structure for all report types
                if pdf_type == "patient":
                    builder_args = [pdf_doc, comprehensive_data, similarity_results, consistency_metrics, similarity_plot_base64]
                else:
                    builder_args = [pdf_doc, comprehensive_data, stats_json, similarity_results, consistency_metrics, ts_img_base64, psd_img_base64, similarity_plot_base64]
                builder(*builder_args)
                pdf_bytes = bytes(pdf_doc.output())
                supabase.storage.from_(REPORT_ASSET_BUCKET).upload(path=pdf_filename_s3, file=pdf_bytes, file_options={"content-type": "application/pdf", "upsert": "true"})
                uploaded_asset_urls[f"{pdf_type}_pdf_url"] = supabase.storage.from_(REPORT_ASSET_BUCKET).get_public_url(pdf_filename_s3)
            except Exception as e_pdf:
                print(f"TASK ERROR [{prediction_id}]: PDF generation for {pdf_type} failed: {e_pdf}"); traceback.print_exc()
                report_generation_errors.append(f"{pdf_type} PDF Fail")
        # Final DB update with asset URLs and status
        final_status = "Completed" if not report_generation_errors else f"Completed with errors: {', '.join(report_generation_errors)}"
        final_update_payload = {"status": final_status, "stats_data": stats_json, "report_generated_at": datetime.now(timezone.utc).isoformat()}
        final_update_payload.update(uploaded_asset_urls)
        if isinstance(similarity_results, dict): final_update_payload["similarity_results"] = {k: v for k, v in similarity_results.items() if k != 'plot_base64'}
        supabase.table('predictions').update(json.loads(json.dumps(final_update_payload, cls=NpEncoder))).eq('id', prediction_id).execute()
    except Exception as e:
        # Handle errors, cleanup, and update DB
        print(f"!!! TASK ERROR [{prediction_id}]: A critical error occurred: {e}"); traceback.print_exc()
        supabase.table('predictions').update({"status": f"Failed: {str(e)[:100]}"}).eq('id', prediction_id).execute()
        for asset_path in assets_to_clean: cleanup_storage_on_error(REPORT_ASSET_BUCKET, asset_path)
    finally:
        # Remove temp files
        if os.path.exists(temp_filepath_in_worker):
            os.remove(temp_filepath_in_worker)
        if ml_output_file_path and os.path.exists(ml_output_file_path):
            os.remove(ml_output_file_path)

@api_bp.route('/predict', methods=['POST'])
def predict_route():
    # API endpoint for prediction request
    supabase = get_supabase_client()
    file = request.files.get('file')
    user_id = request.form.get('user_id')
    patient_id = request.form.get('patient_id')
    doctor_id = request.form.get('doctor_id')
    hospital_id = request.form.get('hospital_id')
    radiologist_id = request.form.get('radiologist_id')  # Optional
    uploaded_by_role = request.form.get('uploaded_by_role')
    channel_index_str = request.form.get('channel_index', '0')
    classification_type = request.form.get('classification_type', 'binary')  # 'binary' or 'multiclass'
    if not patient_id or not doctor_id or not hospital_id:
        return jsonify({'error': 'patient_id, doctor_id, and hospital_id required'}), 400
    try:
        channel_index_for_plot = int(channel_index_str)
    except (ValueError, TypeError):
        channel_index_for_plot = 0
    if not file or not user_id or not file.filename:
        return jsonify({'error': 'Invalid request: file and user_id are required.'}), 400
    prediction_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    temp_filepath = os.path.join(UPLOAD_FOLDER, f"{prediction_id}_{filename}")
    raw_eeg_storage_path = f'raw_eeg/{user_id}/{prediction_id}_{filename}'
    try:
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        # Save uploaded file temporarily
        file.save(temp_filepath)
        with open(temp_filepath, 'rb') as f:
            file_content = f.read()
            # Upload raw EEG to storage
            supabase.storage.from_(RAW_EEG_BUCKET).upload(path=raw_eeg_storage_path, file=file_content, file_options={"upsert": "true"})
        encoded_file_content = base64.b64encode(file_content).decode('utf-8')
        os.remove(temp_filepath)
        # Insert initial DB record
        initial_db_record = {
            "id": prediction_id,
            "user_id": user_id,
            "filename": filename,
            "status": "Pending",
            "prediction": "Processing...",
            "eeg_data_url": raw_eeg_storage_path,
            "analysis_type": classification_type,  # Store classification type for later interpretation
            # NEW: Metadata for role-based filtering
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "hospital_id": hospital_id,
            "radiologist_id": radiologist_id if radiologist_id else None,
            "technician_id": user_id,
            "uploaded_by_role": uploaded_by_role if uploaded_by_role else "technician"
        }
        insert_res = supabase.table('predictions').insert(initial_db_record).execute()
        if hasattr(insert_res, 'error') and insert_res.error:
            raise Exception(f"DB insert failed: {insert_res.error.message}")
        # Start background analysis task
        run_full_analysis_task.delay(prediction_id, encoded_file_content, channel_index_for_plot, filename, classification_type)
        return jsonify({"prediction_id": prediction_id}), 202
    except Exception as e:
        traceback.print_exc()
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)
        cleanup_storage_on_error(RAW_EEG_BUCKET, raw_eeg_storage_path)
        return jsonify({'error': f'Server error: {str(e)}'}), 500
