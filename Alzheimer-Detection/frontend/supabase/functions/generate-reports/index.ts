import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Enhanced PDF generation with real content
const generatePDFContent = (reportType: string, session: any, analysis: any) => {
  const baseContent = {
    session_code: session.session_code,
    patient_name: session.patient?.full_name || 'Unknown Patient',
    doctor_name: session.doctor?.full_name || 'Unknown Doctor',
    analysis_date: analysis.analysis_completed_at,
    prediction: analysis.prediction,
    confidence: (analysis.confidence_score * 100).toFixed(1) + '%',
    hospital_name: session.hospital?.name || 'Medical Center'
  };

  switch (reportType) {
    case 'patient':
      return {
        title: 'EEG Analysis Report - Patient Summary',
        summary: `Dear ${baseContent.patient_name},\n\nYour EEG analysis has been completed. The automated system has provided an assessment of your brain activity patterns.`,
        recommendation: 'Please discuss these results with your doctor during your next appointment.',
        key_findings: [
          `Analysis completed on ${new Date(baseContent.analysis_date).toLocaleDateString()}`,
          `Primary assessment: ${analysis.prediction}`,
          `Confidence level: ${baseContent.confidence}`,
          'This is a computer-generated assessment and should be interpreted by your healthcare provider.'
        ],
        next_steps: [
          'Schedule a follow-up appointment with your doctor',
          'Bring this report to your next consultation',
          'Discuss any questions or concerns with your healthcare team'
        ],
        technical_details: false,
        ...baseContent
      };
    
    case 'doctor':
      return {
        title: 'EEG Analysis Report - Clinical Summary',
        summary: `Comprehensive EEG analysis for ${baseContent.patient_name}. Analysis shows ${analysis.prediction} with ${baseContent.confidence} confidence.`,
        clinical_findings: {
          primary_prediction: analysis.prediction,
          confidence_score: analysis.confidence_score,
          session_details: {
            duration: `${session.session_duration} minutes`,
            sampling_rate: `${session.sampling_rate} Hz`,
            electrodes_used: session.electrodes_used?.length || 0,
            analysis_type: session.analysis_type
          }
        },
        statistical_analysis: analysis.stats_data || {},
        probabilities: analysis.probabilities || {},
        recommendations: [
          'Review technical details for comprehensive understanding',
          'Consider clinical correlation with patient presentation',
          'Recommend further testing if clinically indicated',
          'Follow institutional protocols for result interpretation'
        ],
        technical_details: true,
        ...baseContent
      };
    
    case 'technical':
      return {
        title: 'EEG Analysis Report - Technical Details',
        summary: `Complete technical analysis report including all computational details and intermediate results.`,
        methodology: {
          algorithm: 'Deep Neural Network trained on clinical EEG datasets',
          preprocessing: 'Standard EEG artifact removal and normalization',
          feature_extraction: 'Time-frequency domain analysis',
          classification: 'Multi-layer neural network with attention mechanism'
        },
        raw_analysis_data: analysis,
        technical_metrics: {
          processing_time: analysis.processing_time || 'N/A',
          model_version: analysis.model_version || '1.0',
          data_quality_score: analysis.data_quality_score || 'N/A'
        },
        validation_results: analysis.similarity_results || {},
        consistency_metrics: analysis.consistency_metrics || {},
        trial_by_trial: analysis.trial_predictions || [],
        technical_details: true,
        ...baseContent
      };
    
    default:
      return baseContent;
  }
};

// Mock PDF generation - in production, integrate with a PDF library
const generatePDFBlob = async (content: any): Promise<Uint8Array> => {
  // This is a mock implementation
  // In production, you would use a library like puppeteer, jsPDF, or PDFKit
  const pdfContent = JSON.stringify(content, null, 2);
  return new TextEncoder().encode(pdfContent);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const { session_id, analysis_result_id } = await req.json()

    if (!session_id || !analysis_result_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: session_id and analysis_result_id' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Starting report generation for session: ${session_id}`)

    // Update session status to processing (reports)
    await supabase
      .from('eeg_sessions')
      .update({ status: 'processing' })
      .eq('id', session_id)

    // BEGIN TRANSACTION-LIKE OPERATION
    // Note: Supabase doesn't support traditional transactions, so we'll implement rollback logic

    let generatedReports: any[] = []
    let rollbackNeeded = false

    try {
      // Get session and analysis details
      const { data: session, error: sessionError } = await supabase
        .from('eeg_sessions')
        .select(`
          *,
          doctor:user_profiles!doctor_id(
            id,
            full_name,
            email,
            doctor_profiles(specialization)
          ),
          patient:user_profiles!patient_id(
            id,
            full_name,
            patient_profiles(patient_id)
          ),
          hospital:hospitals(
            id,
            name,
            hospital_code
          )
        `)
        .eq('id', session_id)
        .single()

      if (sessionError || !session) {
        throw new Error('EEG session not found')
      }

      const { data: analysis, error: analysisError } = await supabase
        .from('eeg_analysis_results')
        .select('*')
        .eq('id', analysis_result_id)
        .single()

      if (analysisError || !analysis) {
        throw new Error('Analysis results not found')
      }

      // Generate reports for all three types
      const reportTypes = ['patient', 'doctor', 'technical']

      for (const reportType of reportTypes) {
        try {
          console.log(`Generating ${reportType} report...`)

          // Generate report content
          const reportContent = generatePDFContent(reportType, session, analysis)
          
          // Generate PDF blob (mock implementation)
          const pdfBlob = await generatePDFBlob(reportContent)
          
          // Upload PDF to storage
          const fileName = `reports/${session.session_code}/${reportType}-report.pdf`
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('report-assets')
            .upload(fileName, pdfBlob, {
              contentType: 'application/pdf',
              upsert: false
            })

          if (uploadError) {
            console.error(`Upload error for ${reportType}:`, uploadError)
            throw new Error(`Failed to upload ${reportType} report: ${uploadError.message}`)
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('report-assets')
            .getPublicUrl(fileName)

          // Determine who the report is for
          let generatedForUserId: string
          let generatedByDoctorId = session.doctor_id

          switch (reportType) {
            case 'patient':
              generatedForUserId = session.patient_id
              break
            case 'doctor':
              generatedForUserId = session.doctor_id
              break
            case 'technical':
              // Technical reports accessible by radiologists and doctors
              generatedForUserId = session.doctor_id // Default to doctor
              break
            default:
              throw new Error(`Unknown report type: ${reportType}`)
          }

          // Save report record to database
          const reportData = {
            session_id,
            analysis_result_id,
            report_type: reportType,
            report_url: publicUrl,
            generated_for_user_id: generatedForUserId,
            generated_by_doctor_id: generatedByDoctorId,
            is_accessible: true,
            access_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
            generated_at: new Date().toISOString()
          }

          const { data: savedReport, error: reportError } = await supabase
            .from('reports')
            .insert(reportData)
            .select()
            .single()

          if (reportError) {
            console.error(`Database error for ${reportType}:`, reportError)
            throw new Error(`Failed to save ${reportType} report record: ${reportError.message}`)
          }

          generatedReports.push({
            type: reportType,
            id: savedReport.id,
            url: publicUrl,
            generatedFor: generatedForUserId
          })

          console.log(`${reportType} report generated successfully`)

        } catch (error) {
          console.error(`Error generating ${reportType} report:`, error)
          rollbackNeeded = true
          throw error
        }
      }

      // If we get here, all reports were generated successfully
      // Update session status to completed with reports
      const { error: updateError } = await supabase
        .from('eeg_sessions')
        .update({ status: 'reports_generated' })
        .eq('id', session_id)

      if (updateError) {
        console.error('Failed to update session status:', updateError)
        rollbackNeeded = true
        throw new Error('Failed to update session status')
      }

      // Create notifications for relevant users
      try {
        const notifications = []
        
        // Notify patient
        notifications.push({
          user_id: session.patient_id,
          title: 'EEG Analysis Complete',
          message: `Your EEG analysis results are now available for review.`,
          type: 'report_ready',
          related_resource_type: 'eeg_session',
          related_resource_id: session_id,
          created_at: new Date().toISOString()
        })

        // Notify doctor if assigned
        if (session.doctor_id) {
          notifications.push({
            user_id: session.doctor_id,
            title: 'EEG Analysis Complete',
            message: `EEG analysis for ${session.patient?.full_name} has been completed. Clinical and technical reports are available.`,
            type: 'report_ready',
            related_resource_type: 'eeg_session',
            related_resource_id: session_id,
            created_at: new Date().toISOString()
          })
        }

        if (notifications.length > 0) {
          await supabase
            .from('notifications')
            .insert(notifications)
        }
      } catch (error) {
        console.error('Error creating notifications (non-critical):', error)
      }

      console.log(`Report generation completed successfully for session: ${session_id}`)

      return new Response(
        JSON.stringify({
          message: 'Reports generated successfully',
          reports: generatedReports,
          session_id
        }),
        { 
          status: 202,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (error) {
      console.error('Report generation failed:', error)
      rollbackNeeded = true
      throw error
    }

    // ROLLBACK LOGIC
    if (rollbackNeeded) {
      console.log('Rolling back due to errors...')
      
      // Delete any created report records
      if (generatedReports.length > 0) {
        const reportIds = generatedReports.map(r => r.id)
        await supabase
          .from('reports')
          .delete()
          .in('id', reportIds)
      }

      // Delete any uploaded files
      for (const report of generatedReports) {
        try {
          const fileName = report.url.split('/').slice(-2).join('/')
          await supabase.storage
            .from('report-assets')
            .remove([fileName])
        } catch (error) {
          console.error('Error cleaning up file:', error)
        }
      }

      // Update session status to failed
      await supabase
        .from('eeg_sessions')
        .update({ 
          status: 'failed',
          error_message: error.message 
        })
        .eq('id', session_id)

      throw error
    }

  } catch (error) {
    console.error('Edge function error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: 'Report generation failed'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})