import logging
import os
import json
import base64
import datetime
import threading
import traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from config import (
    FLASK_DEBUG, FLASK_HOST, FLASK_PORT,
    MAX_CONTENT_LENGTH, CORS_ORIGINS, UPLOAD_FOLDER,
    REPORT_ASSETS_BUCKET
)
from utils import NpEncoder

# --- PIPELINE IMPORTS ---
from ml_runner import run_model, get_volume_comparison
from similarity_analyzer import (
    run_similarity_analysis,
    generate_volume_comparison_chart,
    generate_confidence_chart
)

# --- REPORT IMPORTS ---
from pdf_generation.clinician_report import ClinicianPDFReport, build_clinician_report
from pdf_generation.patient_report import PatientPDFReport, build_patient_report
from pdf_generation.technical_report import TechnicalPDFReport, build_technical_report

# --- DATABASE IMPORTS ---
from database import (
    create_prediction_record,
    update_prediction_with_reports,
    update_session_status,
    upload_to_storage,
    get_comprehensive_report_data
)

app = Flask(__name__)
app.json_encoder = NpEncoder
CORS(app, origins=CORS_ORIGINS)

# ==========================================
# [FIX] THIS WAS MISSING AND CAUSED THE CRASH
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# ==========================================

app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
REPORT_FOLDER = os.path.join(UPLOAD_FOLDER, 'reports')
os.makedirs(REPORT_FOLDER, exist_ok=True)

def generate_mock_metadata(filename):
    return {
        "hospital": {
            "name": "General Neural Hospital",
            "address": "123 Medical Center Dr",
            "city": "Neuropolis",
            "state": "NY",
            "pincode": "10001",
            "phone": "+1 (555) 012-3456",
            "email": "radiology@hospital.com"
        },
        "patient": {
            "full_name": "John Doe (Test)",
            "phone": "+1 (555) 999-8888"
        },
        "patient_profile": {
            "patient_code": "PAT-2024-001",
            "date_of_birth": "1960-01-01",
            "gender": "Male",
            "medical_history": "History of mild memory loss reported by family."
        },
        "doctor": {
            "full_name": "Dr. Sarah Smith",
            "phone": "Ext. 404"
        },
        "doctor_profile": {
            "specialization": "Neurology",
            "license_number": "MED-998877"
        },
        "radiologist": {
            "full_name": "Dr. James Wilson",
            "phone": "Ext. 202"
        },
        "session": {
            "session_code": f"SES-{int(datetime.datetime.now().timestamp())}",
            "scan_date": datetime.datetime.now().isoformat(),
            "scanner_manufacturer": "Siemens",
            "scanner_model": "Magnetom Skyra 3T",
            "sequence_type": "T1-Weighted MPRAGE",
            "analysis_type": "Multi-Disease AI Analysis"
        }
    }

def _run_pipeline_background(session_id: str, filepath: str, analysis_type: str):
    """Background pipeline: ML -> slices -> charts -> reports -> update DB."""
    uploaded_urls = {}
    report_errors = []
    asset_prefix = f"report_assets/{session_id}"

    try:
        # Mark processing
        update_session_status(session_id, 'processing')

        # ---- Step 1: Run ML Pipeline (CAT12 -> Slicing -> Model) ----
        logging.info(f"[Pipeline] Starting analysis for session {session_id}")
        ml_results = run_model(filepath, analysis_type)

        if ml_results.get('prediction') == 'Error':
            logging.error(f"[Pipeline] ML pipeline returned error: {ml_results.get('error_details')}")
            update_session_status(session_id, 'failed')
            return

        logging.info(f"[Pipeline] Prediction: {ml_results.get('prediction')}")

        # Convert probabilities list to dict for frontend compatibility
        probs = ml_results.get('probabilities', [])
        classes = ml_results.get('classes', ['CN', 'MCI', 'AD'])
        if isinstance(probs, list) and len(probs) == len(classes):
            ml_results['probabilities'] = dict(zip(classes, probs))

        # ---- Step 2: Create prediction record in DB ----
        prediction_id, err = create_prediction_record(session_id, ml_results)
        if err:
            logging.error(f"[Pipeline] Failed to create prediction: {err}")
            update_session_status(session_id, 'failed')
            return
        logging.info(f"[Pipeline] Prediction record created: {prediction_id}")

        # ---- Step 3: Upload Viewer Slices to Supabase ----
        slice_urls = {}
        is_nifti = filepath.lower().endswith(('.nii', '.nii.gz', '.gz'))
        if is_nifti:
            try:
                from supabase_client import get_supabase_client
                from ml.nifti_slicer import extract_and_upload_viewer_slices
                supabase = get_supabase_client()
                session_code = f"SES-{session_id[:8]}"
                slice_urls = extract_and_upload_viewer_slices(
                    nifti_path=filepath,
                    session_code=session_code,
                    supabase_client=supabase,
                    num_slices=20,
                    orientations=['axial', 'sagittal', 'coronal']
                )
                total = sum(len(v) for v in slice_urls.values())
                logging.info(f"[Pipeline] Uploaded {total} viewer slices")
            except Exception as e:
                logging.warning(f"[Pipeline] Viewer slice upload failed (non-critical): {e}")

        # ---- Step 4: Similarity Analysis ----
        logging.info("[Pipeline] Running similarity analysis...")
        similarity_results = run_similarity_analysis(
            scan_path=filepath,
            analysis_type=analysis_type,
            ml_results=ml_results
        )
        similarity_chart_b64 = similarity_results.get('plot_base64')

        # ---- Step 5: Generate Visualizations ----
        logging.info("[Pipeline] Generating visualizations...")
        volume_chart_b64 = generate_volume_comparison_chart(ml_results)

        # probabilities may be dict (after conversion) or list - normalize for chart
        probs_for_chart = ml_results.get('probabilities', {})
        if isinstance(probs_for_chart, dict):
            chart_classes = list(probs_for_chart.keys())
            chart_probs = list(probs_for_chart.values())
        else:
            chart_probs = probs_for_chart
            chart_classes = ml_results.get('classes', ['CN', 'MCI', 'AD'])

        confidence_chart_b64 = generate_confidence_chart(chart_probs, chart_classes)

        # ---- Step 6: Upload charts to Supabase storage ----
        logging.info("[Pipeline] Uploading visualizations to storage...")
        chart_configs = [
            (similarity_chart_b64, f"{asset_prefix}/similarity_plot.png", "similarity_plot_url"),
            (volume_chart_b64, f"{asset_prefix}/volume_chart.png", "volume_chart_url"),
            (confidence_chart_b64, f"{asset_prefix}/confidence_chart.png", "confidence_chart_url"),
        ]
        for img_data, path, url_key in chart_configs:
            if img_data:
                try:
                    if img_data.startswith('data:image'):
                        img_bytes = base64.b64decode(img_data.split(',', 1)[1])
                    else:
                        img_bytes = base64.b64decode(img_data)
                    url, err = upload_to_storage(REPORT_ASSETS_BUCKET, path, img_bytes, 'image/png')
                    if url:
                        uploaded_urls[url_key] = url
                except Exception as e:
                    logging.warning(f"[Pipeline] Chart upload failed ({url_key}): {e}")
                    report_errors.append(f"{url_key} upload failed")

        # ---- Step 7: Fetch comprehensive data for reports ----
        logging.info("[Pipeline] Fetching comprehensive data for reports...")
        comprehensive_data, err = get_comprehensive_report_data(session_id)
        if err or not comprehensive_data:
            logging.warning(f"[Pipeline] Using mock metadata: {err}")
            comprehensive_data = generate_mock_metadata("scan.nii")

        # ---- Step 8: Generate and upload PDF Reports ----
        logging.info("[Pipeline] Generating PDF reports...")
        pdf_configs = [
            ("technical", TechnicalPDFReport, build_technical_report, "technical_pdf_url"),
            ("clinician", ClinicianPDFReport, build_clinician_report, "clinician_pdf_url"),
            ("patient", PatientPDFReport, build_patient_report, "patient_pdf_url"),
        ]

        # Also save locally for direct download
        timestamp = int(datetime.datetime.now().timestamp())

        for pdf_type, PDFClass, builder, url_key in pdf_configs:
            try:
                logging.info(f"[Pipeline] Building {pdf_type} report...")
                pdf = PDFClass()
                pdf.alias_nb_pages()

                if pdf_type == "patient":
                    builder(pdf, comprehensive_data, ml_results, similarity_results,
                            similarity_chart_b64, None)  # No volume chart for patient
                else:
                    builder(pdf, comprehensive_data, ml_results, similarity_results,
                            similarity_chart_b64, volume_chart_b64, confidence_chart_b64)

                # Save locally
                local_path = os.path.join(REPORT_FOLDER, f"{pdf_type}_report_{timestamp}.pdf")
                pdf.output(local_path)

                # Upload to Supabase storage
                pdf_bytes = open(local_path, 'rb').read()
                storage_path = f"{asset_prefix}/{pdf_type}_report.pdf"
                url, err = upload_to_storage(REPORT_ASSETS_BUCKET, storage_path, pdf_bytes, 'application/pdf')
                if url:
                    uploaded_urls[url_key] = url
                    logging.info(f"[Pipeline] {pdf_type} report uploaded: {url}")
                else:
                    report_errors.append(f"{pdf_type} upload failed")

            except Exception as e:
                logging.error(f"[Pipeline] Error generating {pdf_type} report: {e}")
                traceback.print_exc()
                report_errors.append(f"{pdf_type} PDF failed")

        # ---- Step 9: Update database with all results ----
        logging.info("[Pipeline] Updating database with results...")

        has_any_report = any([
            uploaded_urls.get('technical_pdf_url'),
            uploaded_urls.get('clinician_pdf_url'),
            uploaded_urls.get('patient_pdf_url'),
        ])

        if report_errors and not has_any_report:
            final_status = "failed"
        else:
            final_status = "completed"

        additional_data = {
            'report_generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        if slice_urls:
            additional_data['slice_urls'] = slice_urls

        update_prediction_with_reports(prediction_id, uploaded_urls, additional_data)
        update_session_status(session_id, final_status)

        if report_errors:
            logging.warning(f"[Pipeline] Completed with errors: {report_errors}")
        else:
            logging.info(f"[Pipeline] Analysis complete for session: {session_id}")

    except Exception as e:
        logging.error(f"[Pipeline] Critical error for session {session_id}: {e}")
        traceback.print_exc()
        update_session_status(session_id, 'failed')

    finally:
        # Clean up temp file
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception:
                pass


@app.route('/api/analyze', methods=['POST'])
def analyze_scan():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    analysis_type = request.form.get('analysis_type', 'multi-disease')
    session_id = request.form.get('session_id', 'unknown')

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    filepath = os.path.join(UPLOAD_FOLDER, f"{session_id}_{file.filename}")
    file.save(filepath)

    logging.info(f"[API] File uploaded: {file.filename} for session {session_id}")

    # Run pipeline in background thread so the request returns immediately
    thread = threading.Thread(
        target=_run_pipeline_background,
        args=(session_id, filepath, analysis_type)
    )
    thread.daemon = True
    thread.start()

    return jsonify({
        'session_id': session_id,
        'status': 'processing',
        'message': 'Analysis started. Check session status for updates.'
    }), 202

@app.route('/uploads/reports/<path:filename>')
def download_report(filename):
    return send_from_directory(os.path.join(app.config['UPLOAD_FOLDER'], 'reports'), filename)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.datetime.now().isoformat()}), 200

@app.route('/')
def index():
    return jsonify({
        'name': 'NeuroXiva MRI Platform API',
        'version': '2.0.0',
        'status': 'running',
        'endpoints': {
            'health': '/api/health',
            'analyze': '/api/analyze [POST]',
            'reports': '/uploads/reports/<filename>'
        }
    })

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    print(f"Server running on http://{FLASK_HOST}:{FLASK_PORT}")
    app.run(host=FLASK_HOST, port=FLASK_PORT, debug=FLASK_DEBUG)