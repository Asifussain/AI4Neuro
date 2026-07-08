"""
Prediction API Routes for MRI Analysis.
Handles file upload, prediction, and report generation.
"""

import os
import uuid
import json
import base64
import threading
import traceback
from datetime import datetime, timezone
from flask import request, jsonify
from werkzeug.utils import secure_filename

from . import api_bp

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import UPLOAD_FOLDER, MRI_SCANS_BUCKET, REPORT_ASSETS_BUCKET
from utils import NpEncoder, generate_session_code
from database import (
    get_comprehensive_report_data,
    create_prediction_record,
    update_prediction_with_reports,
    update_session_status,
    upload_to_storage,
    cleanup_storage_on_error
)
from ml_runner import run_model, get_volume_comparison
from similarity_analyzer import (
    run_similarity_analysis,
    generate_volume_comparison_chart,
    generate_confidence_chart
)
from pdf_generation import (
    PatientPDFReport, build_patient_report,
    ClinicianPDFReport, build_clinician_report,
    TechnicalPDFReport, build_technical_report
)


def run_analysis_background(
    session_id: str,
    file_path: str,
    analysis_type: str = 'multi-disease'
):
    """
    Background task to run ML analysis and generate reports.

    Args:
        session_id: MRI session UUID
        file_path: Path to uploaded MRI file
        analysis_type: Type of analysis
    """
    from supabase_client import get_supabase_client

    supabase = get_supabase_client()
    asset_prefix = f"report_assets/{session_id}"
    report_errors = []
    uploaded_urls = {}

    try:
        print(f"[Analysis] Starting analysis for session: {session_id}")

        # Update session status
        update_session_status(session_id, 'processing')

        # =================================================================
        # Step 1: Run ML Model
        # =================================================================
        print(f"[Analysis] Running ML model...")
        ml_results = run_model(file_path, analysis_type)

        # Create prediction record
        prediction_id, err = create_prediction_record(session_id, ml_results)
        if err:
            raise Exception(f"Failed to create prediction: {err}")

        print(f"[Analysis] Prediction created: {ml_results.get('prediction')}")

        # =================================================================
        # Step 1.5: Extract and Upload Viewer Slices
        # =================================================================
        slice_urls = {}
        print(f"[Analysis] Starting slice extraction for file: {file_path}")
        print(f"[Analysis] File exists: {os.path.exists(file_path)}")
        print(f"[Analysis] File extension check: {file_path.lower()}")

        # Check if file is NIfTI format
        is_nifti = file_path.lower().endswith(('.nii', '.nii.gz', '.gz'))
        print(f"[Analysis] Is NIfTI format: {is_nifti}")

        if is_nifti:
            try:
                import nibabel as nib
                print(f"[Analysis] nibabel imported successfully")
            except ImportError as e:
                print(f"[Analysis] ERROR: nibabel not installed! Run: pip install nibabel")
                print(f"[Analysis] ImportError: {e}")
                is_nifti = False  # Skip slice extraction

        if is_nifti:
            try:
                from ml.nifti_slicer import extract_and_upload_viewer_slices
                print(f"[Analysis] nifti_slicer imported successfully")

                # Get session code for storage path
                session_res = supabase.table('mri_sessions').select('session_code').eq('id', session_id).maybe_single().execute()
                session_code = session_res.data.get('session_code', session_id) if session_res.data else session_id
                print(f"[Analysis] Session code: {session_code}")

                print(f"[Analysis] Calling extract_and_upload_viewer_slices...")
                slice_urls = extract_and_upload_viewer_slices(
                    nifti_path=file_path,
                    session_code=session_code,
                    supabase_client=supabase,
                    num_slices=20,
                    orientations=['axial', 'sagittal', 'coronal']
                )

                if slice_urls:
                    total_slices = sum(len(urls) for urls in slice_urls.values())
                    print(f"[Analysis] SUCCESS: Uploaded {total_slices} viewer slices")
                    for orientation, urls in slice_urls.items():
                        print(f"[Analysis]   {orientation}: {len(urls)} slices")
                        if urls:
                            print(f"[Analysis]     First URL: {urls[0]}")
                else:
                    print(f"[Analysis] WARNING: No viewer slices extracted - check nifti_slicer logs")

            except ImportError as e:
                print(f"[Analysis] ERROR: Failed to import nifti_slicer: {e}")
                traceback.print_exc()
            except Exception as e:
                print(f"[Analysis] ERROR: Slice extraction failed: {e}")
                traceback.print_exc()
        else:
            print(f"[Analysis] Skipping slice extraction - not a NIfTI file")

        # =================================================================
        # Step 2: Run Similarity Analysis
        # =================================================================
        print(f"[Analysis] Running similarity analysis...")
        similarity_results = run_similarity_analysis(file_path, analysis_type, ml_results)
        similarity_plot = similarity_results.get('plot_base64')

        # =================================================================
        # Step 3: Generate Visualizations
        # =================================================================
        print(f"[Analysis] Generating visualizations...")
        volume_chart = generate_volume_comparison_chart(ml_results)

        probabilities = ml_results.get('probabilities', [])
        classes = ml_results.get('classes', ['CN', 'MCI', 'AD'])
        confidence_chart = generate_confidence_chart(probabilities, classes)

        # =================================================================
        # Step 4: Upload Visualizations to Storage
        # =================================================================
        print(f"[Analysis] Uploading visualizations...")

        visualizations = [
            (similarity_plot, f"{asset_prefix}/similarity_plot.png", "similarity_plot_url"),
            (volume_chart, f"{asset_prefix}/volume_chart.png", "volume_chart_url"),
            (confidence_chart, f"{asset_prefix}/confidence_chart.png", "confidence_chart_url")
        ]

        for img_data, path, url_key in visualizations:
            if img_data:
                try:
                    # Decode base64
                    if img_data.startswith('data:image'):
                        img_bytes = base64.b64decode(img_data.split(',', 1)[1])
                    else:
                        img_bytes = base64.b64decode(img_data)

                    url, err = upload_to_storage(
                        REPORT_ASSETS_BUCKET, path, img_bytes, 'image/png'
                    )
                    if url:
                        uploaded_urls[url_key] = url
                except Exception as e:
                    print(f"[Analysis] Failed to upload {url_key}: {e}")
                    report_errors.append(f"{url_key} upload failed")

        # =================================================================
        # Step 5: Fetch Comprehensive Data for Reports
        # =================================================================
        print(f"[Analysis] Fetching comprehensive data...")
        comprehensive_data, err = get_comprehensive_report_data(session_id)

        if err or not comprehensive_data:
            print(f"[Analysis] Warning: Could not fetch comprehensive data: {err}")
            comprehensive_data = {
                'session': {'id': session_id},
                'prediction': ml_results,
                'hospital': None,
                'patient': None,
                'patient_profile': None,
                'doctor': None,
                'radiologist': None
            }

        # =================================================================
        # Step 6: Generate PDF Reports
        # =================================================================
        print(f"[Analysis] Generating PDF reports...")

        pdf_configs = [
            ("technical", TechnicalPDFReport, build_technical_report, "technical_pdf_url"),
            ("clinician", ClinicianPDFReport, build_clinician_report, "clinician_pdf_url"),
            ("patient", PatientPDFReport, build_patient_report, "patient_pdf_url")
        ]

        for pdf_type, PDFClass, builder, url_key in pdf_configs:
            pdf_path = f"{asset_prefix}/{pdf_type}_report.pdf"

            try:
                print(f"[Analysis] Building {pdf_type} report...")

                pdf = PDFClass()
                pdf.alias_nb_pages()

                # Build report
                if pdf_type == "patient":
                    builder(
                        pdf, comprehensive_data, ml_results, similarity_results,
                        similarity_plot, None  # No volume chart for patient reports
                    )
                else:
                    builder(
                        pdf, comprehensive_data, ml_results, similarity_results,
                        similarity_plot, volume_chart, confidence_chart
                    )

                # Convert to bytes
                pdf_bytes = bytes(pdf.output())

                # Upload to storage
                url, err = upload_to_storage(
                    REPORT_ASSETS_BUCKET, pdf_path, pdf_bytes, 'application/pdf'
                )

                if url:
                    uploaded_urls[url_key] = url
                    print(f"[Analysis] {pdf_type} report uploaded: {url}")
                else:
                    report_errors.append(f"{pdf_type} upload failed")

            except Exception as e:
                print(f"[Analysis] Error generating {pdf_type} report: {e}")
                traceback.print_exc()
                report_errors.append(f"{pdf_type} PDF failed")

        # =================================================================
        # Step 7: Update Database with Results
        # =================================================================
        print(f"[Analysis] Updating database...")

        # Determine final status based on whether reports were generated
        has_any_report = any([
            uploaded_urls.get('technical_pdf_url'),
            uploaded_urls.get('clinician_pdf_url'),
            uploaded_urls.get('patient_pdf_url')
        ])

        # Status must be max 20 chars: uploaded, processing, completed, failed, reviewed
        if report_errors and not has_any_report:
            final_status = "failed"
            print(f"[Analysis] All reports failed: {report_errors}")
        elif report_errors:
            final_status = "completed"  # Partial success
            print(f"[Analysis] Some reports failed: {report_errors}")
        else:
            final_status = "completed"

        additional_data = {
            'report_generated_at': datetime.now(timezone.utc).isoformat()
        }

        # Add slice URLs if available
        if slice_urls:
            additional_data['slice_urls'] = slice_urls

        update_prediction_with_reports(prediction_id, uploaded_urls, additional_data)
        update_session_status(session_id, final_status)

        if report_errors:
            print(f"[Analysis] Analysis complete with errors for session: {session_id}")
            print(f"[Analysis] Errors: {report_errors}")
        else:
            print(f"[Analysis] Analysis complete for session: {session_id}")

    except Exception as e:
        print(f"[Analysis] Critical error for session {session_id}: {e}")
        traceback.print_exc()

        # Update status to failed
        update_session_status(session_id, 'failed')

        # Cleanup uploaded files on error
        for url in uploaded_urls.values():
            try:
                # Extract path from URL and cleanup
                path = url.split(REPORT_ASSETS_BUCKET + '/')[1] if REPORT_ASSETS_BUCKET in url else None
                if path:
                    cleanup_storage_on_error(REPORT_ASSETS_BUCKET, path)
            except:
                pass

    finally:
        # Clean up temp file
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass


@api_bp.route('/analyze', methods=['POST'])
def analyze_mri():
    """
    Upload MRI scan and trigger analysis.

    Expected form data:
    - file: MRI scan file
    - session_id: MRI session UUID
    - analysis_type: 'multi-disease', 'ad-only', 'pd-only', 'ftd-only'

    Returns:
        JSON with session_id and status
    """
    try:
        file = request.files.get('file')
        session_id = request.form.get('session_id')
        analysis_type = request.form.get('analysis_type', 'multi-disease')

        # Validation
        if not file or not file.filename:
            return jsonify({'error': 'No file provided'}), 400

        if not session_id:
            return jsonify({'error': 'session_id is required'}), 400

        # Save file temporarily
        filename = secure_filename(file.filename)
        temp_path = os.path.join(UPLOAD_FOLDER, f"{session_id}_{filename}")

        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        file.save(temp_path)

        print(f"[API] File uploaded: {filename} for session {session_id}")

        # Start background analysis
        thread = threading.Thread(
            target=run_analysis_background,
            args=(session_id, temp_path, analysis_type)
        )
        thread.daemon = True
        thread.start()

        return jsonify({
            'session_id': session_id,
            'status': 'processing',
            'message': 'Analysis started. Check session status for updates.'
        }), 202

    except Exception as e:
        print(f"[API] Error in analyze endpoint: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/session/<session_id>/status', methods=['GET'])
def get_session_status(session_id: str):
    """
    Get the status of an MRI analysis session.

    Returns:
        JSON with session status and report URLs if available
    """
    try:
        from supabase_client import get_supabase_client
        supabase = get_supabase_client()

        # Fetch session
        session_res = supabase.table('mri_sessions').select('*').eq('id', session_id).maybe_single().execute()

        if not session_res.data:
            return jsonify({'error': 'Session not found'}), 404

        session = session_res.data

        # Fetch prediction if exists
        prediction_res = supabase.table('mri_predictions').select('*').eq('session_id', session_id).maybe_single().execute()

        response = {
            'session_id': session_id,
            'status': session.get('status'),
            'session_code': session.get('session_code'),
            'scan_date': session.get('scan_date'),
            'analysis_type': session.get('analysis_type')
        }

        if prediction_res.data:
            pred = prediction_res.data
            response['prediction'] = {
                'result': pred.get('prediction'),
                'confidence': pred.get('confidence_score'),
                'probabilities': pred.get('probabilities'),
                'report_generated_at': pred.get('report_generated_at')
            }
            response['reports'] = {
                'technical_pdf': pred.get('technical_pdf_url'),
                'clinician_pdf': pred.get('clinician_pdf_url'),
                'patient_pdf': pred.get('patient_pdf_url')
            }
            response['visualizations'] = {
                'similarity_plot': pred.get('similarity_plot_url'),
                'volume_chart': pred.get('volume_chart_url'),
                'confidence_chart': pred.get('confidence_chart_url')
            }
            # Include slice URLs for the viewer
            if pred.get('slice_urls'):
                response['slice_urls'] = pred.get('slice_urls')

        return jsonify(response), 200

    except Exception as e:
        print(f"[API] Error getting session status: {e}")
        return jsonify({'error': str(e)}), 500


@api_bp.route('/session/<session_id>/reports', methods=['GET'])
def get_session_reports(session_id: str):
    """
    Get report URLs for a session.

    Returns:
        JSON with report URLs
    """
    try:
        from supabase_client import get_supabase_client
        supabase = get_supabase_client()

        # Fetch prediction
        prediction_res = supabase.table('mri_predictions').select(
            'technical_pdf_url, clinician_pdf_url, patient_pdf_url, '
            'similarity_plot_url, volume_chart_url, confidence_chart_url, '
            'prediction, confidence_score, report_generated_at'
        ).eq('session_id', session_id).maybe_single().execute()

        if not prediction_res.data:
            return jsonify({'error': 'No reports found for this session'}), 404

        pred = prediction_res.data

        return jsonify({
            'session_id': session_id,
            'prediction': pred.get('prediction'),
            'confidence': pred.get('confidence_score'),
            'generated_at': pred.get('report_generated_at'),
            'reports': {
                'technical': pred.get('technical_pdf_url'),
                'clinician': pred.get('clinician_pdf_url'),
                'patient': pred.get('patient_pdf_url')
            },
            'visualizations': {
                'similarity_plot': pred.get('similarity_plot_url'),
                'volume_chart': pred.get('volume_chart_url'),
                'confidence_chart': pred.get('confidence_chart_url')
            }
        }), 200

    except Exception as e:
        print(f"[API] Error getting reports: {e}")
        return jsonify({'error': str(e)}), 500


@api_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }), 200
