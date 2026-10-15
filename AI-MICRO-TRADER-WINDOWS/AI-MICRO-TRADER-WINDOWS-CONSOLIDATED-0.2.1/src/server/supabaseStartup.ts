import { supabase } from './supabase';

export async function verifySupabaseConnection(): Promise<void> {
  const { error } = await supabase
    .from('amt_server_state')
    .select('id')
    .limit(1);

  if (error) {
    throw new Error(`Supabase connection failed: ${error.message}`);
  }

  console.log('[AI Micro Trader] Supabase connection verified');
}
