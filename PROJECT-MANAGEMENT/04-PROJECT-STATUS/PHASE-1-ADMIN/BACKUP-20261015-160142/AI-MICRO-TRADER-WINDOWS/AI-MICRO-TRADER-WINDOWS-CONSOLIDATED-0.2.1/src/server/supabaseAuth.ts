import crypto from 'crypto';
import { db } from './db';
import { supabase } from './supabase';
import type { AdminUser, MemberUser } from './types';

function throwDbError(operation: string, error: { code?: string; message: string }): never {
  if (error.code === '23505') throw new Error('An account with this email or username already exists');
  throw new Error(`${operation} failed: ${error.message}`);
}

export async function registerSupabaseMember(params: {
  name: string; email: string; password: string;
}): Promise<MemberUser> {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Valid name and email are required');
  if (params.password.length < 8) throw new Error('Password must be at least 8 characters');
  const { hash, salt } = db.hashPassword(params.password);
  const now = new Date().toISOString();
  const member: MemberUser = {
    id: `mem_${crypto.randomBytes(8).toString('hex')}`,
    name, email, passwordHash: hash, salt,
    isEmailVerified: false,
    activePlan: 'NONE', planStatus: 'NONE',
    trialExpiresAt: null, annualExpiresAt: null, trialUsed: false,
    licenseId: null, licensePrefix: null,
    createdAt: now, lastLoginAt: null, termsAcceptedAt: now,
  };
  const { error } = await supabase.from('amt_members').insert({
    id: member.id, email: member.email, data: member, created_at: now,
  });
  if (error) throwDbError('Member registration', error);
  return member;
}

export async function loginSupabaseMember(email: string, password: string): Promise<MemberUser | null> {
  const { data, error } = await supabase.from('amt_members')
    .select('id,data').eq('email', email.trim().toLowerCase()).maybeSingle();
  if (error) throwDbError('Member lookup', error);
  if (!data) return null;
  const member = data.data as MemberUser;
  if (!db.verifyPassword(password, member.passwordHash, member.salt)) return null;
  const updated: MemberUser = { ...member, lastLoginAt: new Date().toISOString() };
  const { data: saved, error: saveError } = await supabase.from('amt_members')
    .update({ data: updated }).eq('id', member.id).select('id');
  if (saveError) throwDbError('Member login update', saveError);
  if (saved?.length !== 1) throw new Error('Member login update did not persist');
  return updated;
}

// First-admin creation intentionally excluded until atomic single-admin provisioning is implemented.
// Never use count-then-insert for first-admin creation: concurrent requests can both succeed.
export async function loginSupabaseAdmin(username: string, password: string): Promise<AdminUser | null> {
  const { data, error } = await supabase.from('amt_admin_users')
    .select('id,data').ilike('username', username.trim()).maybeSingle();
  if (error) throwDbError('Administrator lookup', error);
  if (!data) return null;
  const admin = data.data as AdminUser;
  if (admin.lockedUntil && Date.parse(admin.lockedUntil) > Date.now()) return null;
  const valid = db.verifyPassword(password, admin.passwordHash, admin.salt);
  const failures = valid ? 0 : (admin.failedLoginAttempts ?? 0) + 1;
  const updated: AdminUser = {
    ...admin,
    lastLoginAt: valid ? new Date().toISOString() : admin.lastLoginAt,
    failedLoginAttempts: failures,
    lockedUntil: valid ? null : failures >= 5
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : admin.lockedUntil,
  };
  const { data: saved, error: saveError } = await supabase.from('amt_admin_users')
    .update({ data: updated }).eq('id', admin.id).select('id');
  if (saveError) throwDbError('Administrator login update', saveError);
  if (saved?.length !== 1) throw new Error('Administrator login update did not persist');
  return valid ? updated : null;
}
