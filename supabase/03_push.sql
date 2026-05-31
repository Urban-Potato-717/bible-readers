-- Web Push subscriptions: one row per browser/device that opted into notifications.
-- Run this in Supabase SQL Editor after 02_chat.sql.
--
-- `endpoint` is the unique push-service URL for that device; `p256dh`/`auth` are the
-- client's encryption keys. A user may have several rows (phone, laptop, etc.).
-- All access goes through the server with the service_role key only.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions disable row level security;
