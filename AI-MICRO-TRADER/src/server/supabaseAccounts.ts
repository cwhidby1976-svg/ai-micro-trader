import { supabase } from './supabase';
import type { AdminUser, MemberUser } from './types';

function checkError(error: { message: string } | null): void {
  if (error) {
    throw new Error(`Supabase account operation failed: ${error.message}`);
  }
}

export async function loadSupabaseAdmins(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('amt_admin_users')
    .select('data');

  checkError(error);
  return (data ?? []).map(row => row.data as AdminUser);
}

export async function loadSupabaseMembers(): Promise<MemberUser[]> {
  const { data, error } = await supabase
    .from('amt_members')
    .select('data');

  checkError(error);
  return (data ?? []).map(row => row.data as MemberUser);
}

export async function insertSupabaseAdmin(
  admin: AdminUser
): Promise<void> {
  const { error } = await supabase
    .from('amt_admin_users')
    .insert({
      id: admin.id,
      username: admin.username,
      data: admin,
      created_at: admin.createdAt
    });

  checkError(error);
}

export async function insertSupabaseMember(
  member: MemberUser
): Promise<void> {
  const { error } = await supabase
    .from('amt_members')
    .insert({
      id: member.id,
      email: member.email,
      data: member,
      created_at: member.createdAt
    });

  checkError(error);
}

export async function updateSupabaseAdmin(
  admin: AdminUser
): Promise<void> {
  const { data, error } = await supabase
    .from('amt_admin_users')
    .update({
      username: admin.username,
      data: admin
    })
    .eq('id', admin.id)
    .select('id');

  checkError(error);

  if (!data || data.length !== 1) {
    throw new Error('Administrator update did not affect exactly one record');
  }
}

export async function updateSupabaseMember(
  member: MemberUser
): Promise<void> {
  const { data, error } = await supabase
    .from('amt_members')
    .update({
      email: member.email,
      data: member
    })
    .eq('id', member.id)
    .select('id');

  checkError(error);

  if (!data || data.length !== 1) {
    throw new Error('Member update did not affect exactly one record');
  }
}