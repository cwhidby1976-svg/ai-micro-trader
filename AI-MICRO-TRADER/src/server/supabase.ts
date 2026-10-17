import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export const isSupabaseConfigured = Boolean(url && secretKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, secretKey as string, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase is not configured on this local device. Customer keys and licenses are stored on the device.');
  }
  return supabase;
}
