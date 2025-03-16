import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isApiKeyValid } from '@/lib/openai';

// Demo metrics for when user is not authenticated
const demoMetrics = [
  {
    date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    averageVoiceStrength: 6.5,
    voiceStability: 6.2,
    itemsCollected: 12,
    sessionDuration: 300,
    score: 78
  },
  {
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    averageVoiceStrength: 6.8,
    voiceStability: 6.5,
    itemsCollected: 14,
    sessionDuration: 320,
    score: 82
  },
  {
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    averageVoiceStrength: 7.1,
    voiceStability: 6.7,
    itemsCollected: 15,
    sessionDuration: 330,
    score: 85
  },
  {
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    averageVoiceStrength: 7.3,
    voiceStability: 6.9,
    itemsCollected: 16,
    sessionDuration: 340,
    score: 88
  },
  {
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    averageVoiceStrength: 7.6,
    voiceStability: 7.2,
    itemsCollected: 18,
    sessionDuration: 350,
    score: 92
  }
];

// Function to call OpenAI API directly using fetch
async function callOpenAI(systemPrompt: string, userMessage: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key is missing');
  }
  
  console.log('Calling OpenAI API directly with fetch');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      max_tokens: 500
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { message, debug = false } = await request.json();

    if (debug) {
      console.log('Chat API received message with debug mode enabled:', message);
    }

    // Get the user's session
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    let metrics = [];
    let isUsingDemoData = false;
    let userName = "Patient";
    
    if (!userId) {
      console.log('User not authenticated, using demo data for chat');
      metrics = demoMetrics;
      isUsingDemoData = true;
    } else {
      console.log('Authenticated user ID for chat API:', userId);
      
      // Get user information if available
      const { data: userData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      
      if (userData?.full_name) {
        userName = userData.full_name;
        console.log(`User name found: ${userName}`);
      } else {
        console.log('No user profile data found');
      }
      
      // Fetch the user's progress data from Supabase
      const { data: progressData, error } = await supabase
        .from('gait_data')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      console.log(`Retrieved ${progressData?.length || 0} gait_data records for user ${userId}`);
      
      if (error) {
        console.error('Database error:', error);
        metrics = demoMetrics; // Fallback to demo data
        isUsingDemoData = true;
      } else if (!progressData || progressData.length === 0) {
        console.log('No progress data found for user, using demo data for chat');
        metrics = demoMetrics;
        isUsingDemoData = true;
      } else {
        console.log('Using real user data from Supabase for chat');
        // Extract relevant metrics from the data
        metrics = progressData.map(entry => {
          const analysis = entry.analysis || {};
          const data = entry.data || {};
          
          // Log the raw entry to debug
          console.log('Raw entry from Supabase:', JSON.stringify({
            id: entry.id,
            created_at: entry.created_at,
            analysis: analysis,
            data: data
          }));
          
          return {
            date: new Date(entry.created_at).toLocaleDateString(),
            averageVoiceStrength: analysis.averageVolume || 0,
            voiceStability: analysis.stability || 0,
            itemsCollected: analysis.itemsCollected || 0,
            sessionDuration: analysis.sessionDuration || 0,
            score: data.score || 0
          };
        });
        
        console.log('Processed metrics:', JSON.stringify(metrics));
      }
    }

    // Create a summary of the patient's progress
    const progressSummary = `
      Recent voice therapy sessions for ${userName}:
      ${metrics.map((m, i) => `
        Session ${i+1} (${m.date}):
        - Score: ${m.score}
        - Voice Strength: ${m.averageVoiceStrength.toFixed(2)}
        - Voice Stability: ${m.voiceStability.toFixed(2)}
        - Items Collected: ${m.itemsCollected}
        - Session Duration: ${m.sessionDuration} seconds
      `).join('\n')}
    `;
    
    console.log('Progress summary sent to OpenAI:', progressSummary);
    
    // Additional context about the data source
    const dataSourceContext = isUsingDemoData 
      ? "Note: This is demo data as the user either isn't authenticated or has no session data."
      : "This is actual patient data from their voice therapy sessions.";

    try {
      // Create the system prompt
      const systemPrompt = `You are a helpful voice therapy assistant that provides insights and encouragement based on the patient's voice therapy progress data. 
      
      The data shows metrics from voice-controlled games where patients use their voice to control a ball. Higher voice strength and stability scores indicate better vocal control.
      
      Keep responses concise, encouraging, and focused on the patient's progress. Suggest specific exercises or techniques to improve areas where the patient might be struggling.
      
      ${dataSourceContext}
      
      Here is the patient's recent progress data:
      ${progressSummary}`;
      
      // Try to call OpenAI API directly
      const aiResponse = await callOpenAI(systemPrompt, message);
      
      console.log('Received response from OpenAI');
      
      // Return the AI's response
      return NextResponse.json({ 
        response: aiResponse,
        metrics: metrics,
        isDemo: isUsingDemoData
      });
    } catch (error: any) {
      console.error('OpenAI API error:', error);
      
      // Provide a helpful fallback response
      let errorMessage = "I'm sorry, but I encountered an error while processing your request.";
      
      if (isUsingDemoData) {
        // For demo data, we can provide a canned response based on the question
        const lowerCaseMessage = message.toLowerCase();
        
        if (lowerCaseMessage.includes("how") && lowerCaseMessage.includes("doing")) {
          return NextResponse.json({
            response: `Based on the demo data I can see, the patient is showing steady improvement in their voice therapy. Their voice strength has increased from 6.5 to 7.6 over the past week, and voice stability has improved from 6.2 to 7.2. This suggests good progress in vocal control. The patient should continue with regular practice sessions to maintain this positive trend.`,
            metrics: metrics,
            isDemo: isUsingDemoData
          });
        }
        
        if (lowerCaseMessage.includes("patient") || lowerCaseMessage.includes("paint")) {
          return NextResponse.json({
            response: `The patient is making good progress in their voice therapy. Looking at the most recent data, they've shown improvement in both voice strength (now at 7.6, up from 6.5) and stability (now at 7.2, up from 6.2). They've been consistent with their practice, completing 18 items in their last session with a score of 92. This represents a 14-point improvement from their first recorded session. I would recommend continuing with the current therapy plan while gradually increasing the difficulty to maintain progress.`,
            metrics: metrics,
            isDemo: isUsingDemoData
          });
        }
        
        if (lowerCaseMessage.includes("improve") || lowerCaseMessage.includes("better")) {
          return NextResponse.json({
            response: `To improve voice strength and stability, I recommend daily practice with sustained vowel sounds (like "ahhh" and "eeee") for 30 seconds at a time. Gradually increase the duration as control improves. Also try pitch glides (sliding from low to high pitch and back) and gentle humming exercises. Stay hydrated and practice in a quiet environment for best results.`,
            metrics: metrics,
            isDemo: isUsingDemoData
          });
        }
        
        // Generic fallback for demo data
        return NextResponse.json({
          response: `Based on the patient's data, I can see a positive trend in their voice therapy progress. Voice strength has improved from 6.5 to 7.6 (16.9% increase) and stability from 6.2 to 7.2 (16.1% increase) over the recorded sessions. Session scores have also increased from 78 to 92. This indicates good adherence to the therapy program and effective skill development. To continue this progress, I recommend maintaining the current practice schedule while gradually increasing exercise difficulty.`,
          metrics: metrics,
          isDemo: isUsingDemoData
        });
      }
      
      // If not using demo data or no specific fallback matched
      return NextResponse.json({ 
        response: errorMessage,
        metrics: metrics,
        isDemo: isUsingDemoData,
        error: error.message || 'Unknown OpenAI error'
      });
    }
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { 
        response: 'An error occurred while processing your request. Please try again later.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
