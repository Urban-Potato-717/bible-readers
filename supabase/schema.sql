-- Bible Readers schema
-- Run this in Supabase SQL Editor after creating a new project.

create extension if not exists "pgcrypto";

-- Users: 8 fixed members.
-- A null pin_hash means the member sets their own PIN on first login.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pin_hash text,
  is_admin boolean not null default false,
  legacy_paid_total integer not null default 0,
  created_at timestamptz not null default now()
);

-- One verification record per day (date is KST-based).
-- photo_path points to a Supabase Storage object (cleaned up after 30 days by cron).
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  text text,
  photo_path text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists verifications_date_idx on public.verifications(date);

-- Fines: cron inserts one row per missed day (status='pending').
-- The admin flips it to 'paid' once the transfer is confirmed.
create table if not exists public.fines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  amount integer not null default 1000,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists fines_user_status_idx on public.fines(user_id, status);

-- Storage bucket for verification photos.
insert into storage.buckets (id, name, public)
values ('verifications', 'verifications', false)
on conflict (id) do nothing;

-- RLS off: all DB access goes through the server using the service_role key only.
alter table public.users disable row level security;
alter table public.verifications disable row level security;
alter table public.fines disable row level security;
