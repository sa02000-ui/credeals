-- Global app settings (admin-controlled feature flags, e.g. game mode on/off).
-- Run in the Supabase SQL Editor on project dzduuhbtntikqjuzufpg.

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

-- settings are non-sensitive feature flags: anyone (incl. the public landing) may read
drop policy if exists app_settings_read on app_settings;
create policy app_settings_read on app_settings for select to anon, authenticated using (true);

-- only admins write
drop policy if exists app_settings_write on app_settings;
create policy app_settings_write on app_settings for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

insert into app_settings (key, value) values ('gameEnabled', 'true'::jsonb)
  on conflict (key) do nothing;
