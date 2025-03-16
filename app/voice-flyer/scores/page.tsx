import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import SupabaseAuth from '@/components/SupabaseAuth';

export default async function VoiceFlyerScores() {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  // Get the user's session
  const { data: { session } } = await supabase.auth.getSession();
  
  // Fetch top scores
  const { data: scores, error } = await supabase
    .from('game_scores')
    .select('*')
    .order('score', { ascending: false })
    .limit(10);

  // If user is logged in, fetch their personal scores
  let userScores = null;
  let userScoresError = null;
  
  if (session) {
    const { data, error: fetchError } = await supabase
      .from('game_scores')
      .select('*')
      .eq('user_id', session.user.id)
      .order('score', { ascending: false })
      .limit(5);
    
    userScores = data;
    userScoresError = fetchError;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <header className="w-full max-w-md mb-4">
        <h1 className="text-3xl font-bold text-center">Voice Flyer Leaderboard</h1>
        <p className="text-center text-gray-600 mb-4">See the top scores from players around the world!</p>
      </header>

      <div className="w-full max-w-md bg-white rounded-xl shadow-md overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Top Scores</h2>
            <Link 
              href="/voice-flyer"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
            >
              Play Game
            </Link>
          </div>

          {error ? (
            <p className="text-red-500">Error loading scores: {error.message}</p>
          ) : scores && scores.length > 0 ? (
            <div className="overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scores.map((score: any, index: number) => (
                    <tr key={score.id} className={index < 3 ? "bg-yellow-50" : ""}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {score.user_name || 'Anonymous'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold">
                        {score.score}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(score.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No scores recorded yet. Be the first to play!</p>
          )}
        </div>
      </div>

      {/* Authentication component */}
      <div className="w-full max-w-md mb-6">
        <SupabaseAuth />
      </div>

      {/* User's personal scores (if logged in) */}
      {session && (
        <div className="w-full max-w-md bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Your Scores</h2>
            
            {userScoresError ? (
              <p className="text-red-500">Error loading your scores: {userScoresError.message}</p>
            ) : !userScores || userScores.length === 0 ? (
              <p className="text-gray-500">You haven't played any games yet!</p>
            ) : (
              <ul className="space-y-2">
                {userScores.map((score: any) => (
                  <li key={score.id} className="p-2 bg-gray-100 rounded flex justify-between">
                    <span>{new Date(score.created_at).toLocaleDateString()}</span>
                    <span className="font-bold">{score.score} points</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
