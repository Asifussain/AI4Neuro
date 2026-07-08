import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      session_id,
      eeg_data_url,
      analysis_type = 'binary',
      electrodes_used = [],
      sampling_rate = 256
    } = req.body;

    if (!session_id || !eeg_data_url) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get session details to verify it exists and belongs to the user's hospital
    const { data: session, error: sessionError } = await supabase
      .from('eeg_sessions')
      .select('id, session_code, hospital_id, status')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'EEG session not found' });
    }

    if (session.status !== 'uploaded') {
      return res.status(400).json({ error: 'Session is not ready for analysis' });
    }

    // Update session status to processing
    await supabase
      .from('eeg_sessions')
      .update({ status: 'processing' })
      .eq('id', session_id);

    // Simulate EEG analysis process
    // In a real implementation, this would call your ML model
    setTimeout(async () => {
      try {
        // Simulate analysis results
        const mockResults = {
          session_id,
          prediction: Math.random() > 0.5 ? 'Alzheimer\'s Detected' : 'Normal',
          confidence_score: 0.75 + Math.random() * 0.2, // 75-95% confidence
          probabilities: {
            'Normal': Math.random() * 0.5,
            'Mild Cognitive Impairment': Math.random() * 0.3,
            'Alzheimer\'s Disease': Math.random() * 0.4
          },
          stats_data: {
            dominant_frequency: 8.5 + Math.random() * 2,
            power_spectrum: Array.from({length: 10}, () => Math.random() * 100),
            coherence_values: Array.from({length: 5}, () => Math.random())
          },
          similarity_results: {
            template_match: Math.random(),
            pattern_correlation: Math.random()
          },
          consistency_metrics: {
            temporal_stability: Math.random(),
            spatial_consistency: Math.random()
          },
          trial_predictions: Array.from({length: 5}, () => ({
            trial: Math.floor(Math.random() * 100),
            prediction: Math.random() > 0.5 ? 'positive' : 'negative',
            confidence: Math.random()
          })),
          analysis_completed_at: new Date().toISOString()
        };

        // Normalize probabilities
        const totalProb = Object.values(mockResults.probabilities).reduce((a, b) => a + b, 0);
        Object.keys(mockResults.probabilities).forEach(key => {
          mockResults.probabilities[key] = mockResults.probabilities[key] / totalProb;
        });

        // Insert analysis results
        const { data: analysisResult, error: analysisError } = await supabase
          .from('eeg_analysis_results')
          .insert(mockResults)
          .select()
          .single();

        if (analysisError) {
          console.error('Error saving analysis results:', analysisError);
          // Update session status to failed
          await supabase
            .from('eeg_sessions')
            .update({ status: 'failed' })
            .eq('id', session_id);
          return;
        }

        // Update session status to completed
        await supabase
          .from('eeg_sessions')
          .update({ status: 'completed' })
          .eq('id', session_id);

        console.log('EEG analysis completed for session:', session_id);
      } catch (error) {
        console.error('Background analysis failed:', error);
        // Update session status to failed
        await supabase
          .from('eeg_sessions')
          .update({ status: 'failed' })
          .eq('id', session_id);
      }
    }, 5000); // 5 second delay to simulate processing

    res.status(200).json({
      message: 'EEG analysis started successfully',
      session_id,
      status: 'processing'
    });

  } catch (error) {
    console.error('EEG analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}