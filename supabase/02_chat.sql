-- Chat room: a single shared group feed for all members.
-- Run this in Supabase SQL Editor after schema.sql + seed.sql.
--
-- A message is either:
--   kind='verification'  -> the daily proof (clears the fine, shows a badge). `date` = KST reading date.
--   kind='chat'          -> normal conversation. `date` is null.
-- Verifications are still recorded in public.verifications too (fines/calendar depend on it);
-- the message row is just the chat-feed copy.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null default 'chat' check (kind in ('chat', 'verification')),
  body text,
  photo_path text,
  date date,
  created_at timestamptz not null default now()
);

create index if not exists messages_created_idx on public.messages(created_at);
create index if not exists messages_kind_date_idx on public.messages(kind, date);

-- Emoji reactions. One row per (message, user, emoji); toggling removes it.
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists reactions_message_idx on public.reactions(message_id);

-- RLS off: all access goes through the server with the service_role key only.
alter table public.messages disable row level security;
alter table public.reactions disable row level security;
