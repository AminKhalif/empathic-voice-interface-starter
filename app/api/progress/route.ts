import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Demo data for when user is not authenticated
const demoData = {
  weeklyStats: {
    exercisesCompleted: 5,
    totalPracticeTime: 1800, // 30 minutes
    averageScore: 85,
    averageVoiceStrength: 7.2,
    averageVoiceStability: 6.8
  },
  recentSessions: [
    {
      id: 'demo-1',
      date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      score: 78,
      averageVoiceStrength: 6.5,
      voiceStability: 6.2,
      itemsCollected: 12,
      sessionDuration: 300
    },
    {
      id: 'demo-2',
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      score: 82,
      averageVoiceStrength: 6.8,
      voiceStability: 6.5,
      itemsCollected: 14,
      sessionDuration: 320
    },
    {
      id: 'demo-3',
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      score: 85,
      averageVoiceStrength: 7.1,
      voiceStability: 6.7,
      itemsCollected: 15,
      sessionDuration: 330
    },
    {
      id: 'demo-4',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      score: 88,
      averageVoiceStrength: 7.3,
      voiceStability: 6.9,
      itemsCollected: 16,
      sessionDuration: 340
    },
    {
      id: 'demo-5',
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      score: 92,
      averageVoiceStrength: 7.6,
      voiceStability: 7.2,
      itemsCollected: 18,
      sessionDuration: 350
    }
  ]
};

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Get the user's session
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    if (!userId) {
      console.log('User not authenticated, returning demo data');
      return NextResponse.json(demoData);
    }

    console.log('Authenticated user ID:', userId);

    // Fetch the user's progress data from Supabase
    const { data: progressData, error } = await supabase
      .from('gait_data')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`Retrieved ${progressData?.length || 0} records from Supabase for user ${userId}`);

    // If no data is found, return demo data
    if (!progressData || progressData.length === 0) {
      console.log('No progress data found for user, returning demo data');
      return NextResponse.json(demoData);
    }

    // Process the data to extract relevant metrics
    const processedData = progressData.map(entry => {
      const analysis = entry.analysis || {};
      const data = entry.data || {};
      
      return {
        id: entry.id,
        date: entry.created_at,
        score: data.score || 0,
        averageVoiceStrength: analysis.averageVolume || 0,
        voiceStability: analysis.stability || 0,
        itemsCollected: analysis.itemsCollected || 0,
        sessionDuration: analysis.sessionDuration || 0
      };
    });

    // Calculate weekly stats
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const weeklyData = processedData.filter(entry => 
      new Date(entry.date) >= oneWeekAgo
    );
    
    const weeklyStats = {
      exercisesCompleted: weeklyData.length,
      totalPracticeTime: weeklyData.reduce((total, entry) => total + entry.sessionDuration, 0),
      averageScore: weeklyData.length > 0 
        ? weeklyData.reduce((total, entry) => total + entry.score, 0) / weeklyData.length 
        : 0,
      averageVoiceStrength: weeklyData.length > 0
        ? weeklyData.reduce((total, entry) => total + entry.averageVoiceStrength, 0) / weeklyData.length
        : 0,
      averageVoiceStability: weeklyData.length > 0
        ? weeklyData.reduce((total, entry) => total + entry.voiceStability, 0) / weeklyData.length
        : 0
    };

    // Calculate progress over time (last 10 sessions)
    const recentSessions = processedData.slice(0, 10);
    
    return NextResponse.json({ 
      weeklyStats,
      recentSessions
    });
  } catch (error) {
    console.error('Server error:', error);
    // Return demo data in case of error
    return NextResponse.json(demoData);
  }
}
