-- ============================================================
-- PestDispatch — Supabase Setup Script
-- Run this once in your Supabase project's SQL Editor.
-- ============================================================

-- Single table that holds all app data as named JSON blobs.
create table if not exists app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);

-- Enable Row Level Security.
-- All access goes through the service role key in the API routes,
-- so no client-facing policies are needed.
alter table app_config enable row level security;

-- Seed the two required rows.
insert into app_config (key, value) values
  ('technicians', '[]'::jsonb),
  ('auth',        '{"master": null, "managers": []}'::jsonb)
on conflict (key) do nothing;
