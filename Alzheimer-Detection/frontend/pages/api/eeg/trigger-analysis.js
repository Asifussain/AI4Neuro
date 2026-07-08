import { createClient } from '@supabase/supabase-js';

// Create admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Anon client for auth verification
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, hospital_id, account_status')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    // Check role - radiologists and doctors can trigger analysis
    if (!['radiologist', 'doctor'].includes(userProfile.role)) {
      return res.status(403).json({ error: 'Radiologist or doctor access required' });
    }

    if (userProfile.account_status !== 'active') {
      return res.status(403).json({ error: 'Account not active' });
    }

    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    // Get session details
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('eeg_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('hospital_id', userProfile.hospital_id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'EEG session not found' });
    }

    // Check if session is ready for analysis
    if (session.status !== 'uploaded') {
      return res.status(400).json({
        error: `Session cannot be analyzed in current status: ${session.status}`,
        current_status: session.status
      });
    }

    // Update session status to processing
    await supabaseAdmin
      .from('eeg_sessions')
      .update({ status: 'processing' })
      .eq('id', session_id);

    // Start background analysis (asynchronous)
    setImmediate(async () => {
      await performAnalysis(session_id, session);
    });

    return res.status(202).json({
      success: true,
      message: 'EEG analysis started successfully',
      session_id: session_id,
      session_code: session.session_code,
      status: 'processing'
    });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

// Background analysis function
async function performAnalysis(session_id, session) {
  try {
    console.log(`Starting analysis for session: ${session_id}`);

    // Simulate ML analysis (in production, this would call your actual ML model)
    // You can replace this with actual ML inference
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
        coherence_values: Array.from({length: 5}, () => Math.random()),
        mean_amplitude: 50 + Math.random() * 30,
        peak_frequency: 10 + Math.random() * 5
      },
      similarity_results: {
        template_match: Math.random(),
        pattern_correlation: Math.random(),
        cross_correlation: Math.random()
      },
      consistency_metrics: {
        temporal_stability: Math.random(),
        spatial_consistency: Math.random(),
        signal_quality: 0.8 + Math.random() * 0.2
      },
      trial_predictions: Array.from({length: 5}, (_, i) => ({
        trial: i + 1,
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
    const { data: analysisResult, error: analysisError } = await supabaseAdmin
      .from('eeg_analysis_results')
      .insert(mockResults)
      .select()
      .single();

    if (analysisError) {
      console.error('Error saving analysis results:', analysisError);
      await supabaseAdmin
        .from('eeg_sessions')
        .update({ status: 'failed' })
        .eq('id', session_id);
      return;
    }

    // Update session status to completed
    await supabaseAdmin
      .from('eeg_sessions')
      .update({ status: 'completed' })
      .eq('id', session_id);

    console.log(`Analysis completed for session: ${session_id}`);

    // Automatically trigger report generation
    console.log(`Starting report generation for session: ${session_id}`);
    await generateReports(session_id, analysisResult.id, session);

  } catch (error) {
    console.error('Background analysis failed:', error);
    await supabaseAdmin
      .from('eeg_sessions')
      .update({ status: 'failed' })
      .eq('id', session_id);
  }
}

// Report generation function
async function generateReports(session_id, analysis_result_id, session) {
  try {
    console.log(`Generating reports for session: ${session_id}`);

    // Call the generate-reports API internally
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/generate-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id,
        analysis_result_id
      })
    });

    if (!response.ok) {
      console.error('Report generation failed:', await response.text());
    } else {
      console.log('Report generation started successfully');
    }

  } catch (error) {
    console.error('Error triggering report generation:', error);
  }
}
