-- Run this once in the Supabase SQL editor.
-- Creates the waitlist table and locks it down with RLS so only the service
-- role (used by our API route) can read/write it.  Anon clients cannot touch
-- it directly.

create extension if not exists "pgcrypto";

create table if not exists public.waitlist (
  id            uuid          primary key default gen_random_uuid(),
  email         text          not null unique,
  referrer      text,
  created_at    timestamptz   not null default now()
);

create index if not exists waitlist_created_at_idx on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;

-- No policies are granted to anon or authenticated roles.  Only the service
-- role key (used server-side in our API route) can read or insert.
