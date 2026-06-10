-- Scenario Builder storage (admin-authored branching game scenarios).
-- Run this in the Supabase SQL Editor (dashboard → SQL) on project dzduuhbtntikqjuzufpg.

create table if not exists scenarios (
  id         text primary key,              -- slug, e.g. 'appraisal-low'
  title      text not null,
  phase      text not null default 'other', -- buybox|sourcing|napkin|loi|psa|c2c|am|other
  severity   int  not null default 50,      -- 0..100, scales effect harshness in-game
  status     text not null default 'draft', -- draft|active|off
  entry      text not null default 'start', -- starting step id
  steps      jsonb not null default '{}'::jsonb,
  notes      text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table scenarios enable row level security;

-- all signed-in users can read (the game loads active scenarios)
drop policy if exists scenarios_read on scenarios;
create policy scenarios_read on scenarios for select to authenticated using (true);

-- only admins can write
drop policy if exists scenarios_write on scenarios;
create policy scenarios_write on scenarios for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

create or replace function touch_scenarios_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists scenarios_touch on scenarios;
create trigger scenarios_touch before update on scenarios for each row execute function touch_scenarios_updated_at();
