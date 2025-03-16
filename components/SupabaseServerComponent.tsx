import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase';

export default async function SupabaseServerComponent() {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);
  
  // Get the user's session
  const { data: { session } } = await supabase.auth.getSession();
  
  // If the user is logged in, fetch some data
  let gameData = null;
  if (session) {
    // Example query - replace with your actual table name and query
    const { data, error } = await supabase
      .from('game_scores')
      .select('*')
      .order('score', { ascending: false })
      .limit(5);
    
    if (!error) {
      gameData = data;
    }
  }
  
  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md">
      <h2 className="text-xl font-bold mb-4">Server-Side Supabase Data</h2>
      
      {session ? (
        <div>
          <p className="mb-2">Logged in as: {session.user.email}</p>
          
          <h3 className="text-lg font-semibold mt-4 mb-2">Top Game Scores</h3>
          {gameData ? (
            <ul className="space-y-2">
              {gameData.map((score: any) => (
                <li key={score.id} className="p-2 bg-gray-100 rounded">
                  <span className="font-medium">{score.user_name || 'Anonymous'}</span>: {score.score} points
                </li>
              ))}
            </ul>
          ) : (
            <p>No game scores found or table doesn't exist yet.</p>
          )}
        </div>
      ) : (
        <p>Please log in to view your data.</p>
      )}
    </div>
  );
}
