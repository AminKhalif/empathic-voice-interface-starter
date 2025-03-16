import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { user_id, data, analysis } = await request.json();

    // Get the user's session
    const { data: { session } } = await supabase.auth.getSession();
    
    // Insert game data into gait_data table
    const { data: insertedData, error } = await supabase
      .from('gait_data')
      .insert([
        { 
          user_id: session?.user?.id || user_id || null,
          data,
          analysis
        }
      ])
      .select();
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, id: insertedData[0].id });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
