import crypto from 'crypto';
import { db } from './db';
import { requireSupabase } from './supabase';
import type { AdminUser } from './types';

/** Server-only; invoke only after ADMIN_SETUP_KEY verification in the API route. */
export async function createFirstSupabaseAdminAtomic(username: string, password: string): Promise<AdminUser> {
  const cleanUsername = username.trim();
  if (cleanUsername.length < 3 || password.length < 12) {
    throw new Error('Username must have at least 3 characters and password at least 12');
  }
  const { hash, salt } = db.hashPassword(password);
  const admin: AdminUser = {
    id: `admin_${crypto.randomBytes(16).toString('hex')}`,
    username: cleanUsername,
    passwordHash: hash,
    salt,
    role: 'superadmin',
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
  };
  const { data, error } = await requireSupabase().rpc('amt_create_first_admin', {
    p_id: admin.id,
    p_username: admin.username,
    p_data: admin,
    p_created_at: admin.createdAt,
  });
  if (error) throw new Error(`Atomic administrator setup failed: ${error.message}`);
  if (data !== true) throw new Error('An administrator already exists');
  return admin;
}
