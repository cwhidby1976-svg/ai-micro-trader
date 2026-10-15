-- AI Micro Trader: initial Supabase database schema
-- Run once in Supabase SQL Editor. Creates EMPTY tables; does not migrate local JSON.
-- This schema is a starting point for the existing Express backend, not a drop-in replacement.
-- The Express server must use a server-only database connection and implement migrations.

begin;

-- Single-row server configuration, including sensitive signing material.
create table if not exists public.amt_server_state (
  id integer primary key default 1 check (id = 1),
  version integer not null default 2,
  server_secret text,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.amt_admin_users (
  id text primary key,
  username text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists amt_admin_username_unique on public.amt_admin_users (lower(username));

create table if not exists public.amt_members (
  id text primary key,
  email text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists amt_member_email_unique on public.amt_members (lower(email));

create table if not exists public.amt_orders (
  id text primary key,
  member_id text,
  status text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists amt_orders_member_idx on public.amt_orders(member_id);

create table if not exists public.amt_discount_codes (
  id text primary key,
  code text not null,
  percentage numeric(5,2) not null check (percentage >= 1 and percentage <= 50),
  max_uses integer not null check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0 and used_count <= max_uses),
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists amt_discount_code_unique on public.amt_discount_codes (upper(code));

create table if not exists public.amt_discount_redemptions (
  id text primary key,
  discount_code_id text not null references public.amt_discount_codes(id),
  member_id text not null,
  order_id text not null,
  data jsonb not null default '{}'::jsonb,
  redeemed_at timestamptz not null default now(),
  unique(discount_code_id, member_id),
  unique(order_id)
);
create index if not exists amt_redemptions_member_idx on public.amt_discount_redemptions(member_id);

create table if not exists public.amt_licenses (
  id text primary key,
  member_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists amt_licenses_member_idx on public.amt_licenses(member_id);

create table if not exists public.amt_audit_logs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.amt_user_api_keys (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Private-by-default. Do not allow direct access from browser anon/authenticated roles.
-- Future Express integration should access through a protected server-only connection.
do $$
declare t text;
begin
  foreach t in array array[
    'amt_server_state','amt_admin_users','amt_members','amt_orders',
    'amt_discount_codes','amt_discount_redemptions','amt_licenses',
    'amt_audit_logs','amt_user_api_keys'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

commit;

-- Check the tables after execution:
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'amt_%'
order by table_name;
