-- CRE Deal Lifecycle — initial schema
-- Designed for scale: 5,000+ deals (mostly archived) + ~1,000–1,500/yr, 500–600 users growing.
-- Access model (Monday-style): all deals view-only to the org; per-deal grant = edit on THAT deal only.
-- Game vs Real: each deal carries sim_mode; a real deal can be cloned into game mode to practice.

-- ---------- enums ----------
create type asset_class as enum (
  'multifamily','retail-nnn','storage','mixed-use','industrial',
  'rv-park','mobile-home-park','raw-land','land-development'
);
create type deal_stage as enum ('new','napkin','detailed','loi','c2c','am','archived');
create type sim_mode   as enum ('real','game');
create type member_role as enum ('viewer','editor');
create type file_kind  as enum ('T12','RentRoll','OM','CoStar','Other');

-- ---------- profiles (1:1 with auth.users) ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  full_name   text,
  domain      text generated always as (split_part(email,'@',2)) stored,
  is_admin    boolean not null default false,
  -- billable = admins + domain/edit users; view-only guests are free (business rule, tracked here)
  billable    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- deals ----------
create table deals (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address       text,
  city          text,
  state         text,
  msa           text,
  asset_class   asset_class not null default 'multifamily',
  vintage       int,
  unit_count    int,
  rentable_sqft int,
  ask_price     numeric,
  -- napkin "blue cells" + listing economics as flexible json (engine reads/writes)
  economics     jsonb not null default '{}'::jsonb,
  -- AI-enhanced address lookups (income, flood, crime, population, rent growth)
  lookups       jsonb not null default '{}'::jsonb,
  stage         deal_stage not null default 'new',
  sim_mode      sim_mode  not null default 'real',
  cloned_from   uuid references deals(id) on delete set null,  -- real → game practice copy
  owner_id      uuid not null references profiles(id) on delete restrict,
  broker        text,
  source        text,
  blurb         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index deals_stage_idx       on deals(stage);
create index deals_asset_class_idx on deals(asset_class);
create index deals_state_idx       on deals(state);
create index deals_sim_mode_idx    on deals(sim_mode);
create index deals_owner_idx       on deals(owner_id);
create index deals_created_idx     on deals(created_at desc);

-- ---------- per-deal access grants (the Monday "add someone to the row" model) ----------
create table deal_members (
  deal_id    uuid not null references deals(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       member_role not null default 'editor',
  granted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  primary key (deal_id, user_id)
);
create index deal_members_user_idx on deal_members(user_id);

-- ---------- comments (threaded + @mentions; the Monday "bubble") ----------
create table deal_comments (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references deals(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  parent_id  uuid references deal_comments(id) on delete cascade,
  body       text not null,
  mentions   uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index deal_comments_deal_idx on deal_comments(deal_id, created_at);

-- ---------- files (OM, CoStar, T-12, rent roll…) stored with the deal ----------
create table deal_files (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references deals(id) on delete cascade,
  kind         file_kind not null default 'Other',
  name         text not null,
  storage_path text,            -- Supabase Storage object path
  size_bytes   bigint not null default 0,
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);
create index deal_files_deal_idx on deal_files(deal_id);

-- ---------- napkin / UW versions ----------
create table napkin_versions (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references deals(id) on delete cascade,
  author_id  uuid references profiles(id),
  overrides  jsonb not null default '{}',
  result     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index napkin_versions_deal_idx on napkin_versions(deal_id, created_at desc);

-- ---------- buy boxes (per user) ----------
create table buy_boxes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  name          text not null default 'My buy box',
  asset_classes asset_class[] not null default '{multifamily}',
  states        text[] not null default '{TX}',
  min_units int, max_units int,
  min_vintage int, max_vintage int,
  min_price numeric, max_price numeric,
  min_stab_cap numeric,
  created_at    timestamptz not null default now()
);

-- ---------- helpers ----------
create or replace function is_admin() returns boolean language sql stable security definer as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create or replace function can_edit_deal(d uuid) returns boolean language sql stable security definer as $$
  select is_admin()
      or exists (select 1 from deals where id = d and owner_id = auth.uid())
      or exists (select 1 from deal_members where deal_id = d and user_id = auth.uid() and role = 'editor');
$$;

-- updated_at trigger
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger deals_touch before update on deals for each row execute function touch_updated_at();

-- ---------- RLS ----------
alter table profiles       enable row level security;
alter table deals          enable row level security;
alter table deal_members   enable row level security;
alter table deal_comments  enable row level security;
alter table deal_files     enable row level security;
alter table napkin_versions enable row level security;
alter table buy_boxes      enable row level security;

-- profiles: everyone authenticated can read (for @mentions/assignment); update own
create policy profiles_read on profiles for select to authenticated using (true);
create policy profiles_update_own on profiles for update to authenticated using (id = auth.uid());

-- deals: VIEW-ALL to the org (authenticated). Write gated by ownership/grant/admin.
create policy deals_select on deals for select to authenticated using (true);
create policy deals_insert on deals for insert to authenticated with check (owner_id = auth.uid());
create policy deals_update on deals for update to authenticated using (can_edit_deal(id));
create policy deals_delete on deals for delete to authenticated using (is_admin() or owner_id = auth.uid());

-- deal_members: visible to anyone who can view the deal; managed by owner/admin
create policy members_select on deal_members for select to authenticated using (true);
create policy members_write on deal_members for all to authenticated
  using (is_admin() or exists (select 1 from deals where id = deal_id and owner_id = auth.uid()))
  with check (is_admin() or exists (select 1 from deals where id = deal_id and owner_id = auth.uid()));

-- comments: anyone with view access can read AND post (bubble for all viewers)
create policy comments_select on deal_comments for select to authenticated using (true);
create policy comments_insert on deal_comments for insert to authenticated with check (author_id = auth.uid());
create policy comments_modify_own on deal_comments for update to authenticated using (author_id = auth.uid());
create policy comments_delete_own on deal_comments for delete to authenticated using (author_id = auth.uid() or is_admin());

-- files: viewers read; editors write
create policy files_select on deal_files for select to authenticated using (true);
create policy files_insert on deal_files for insert to authenticated with check (can_edit_deal(deal_id));
create policy files_delete on deal_files for delete to authenticated using (can_edit_deal(deal_id));

-- napkin versions: read if can view deal; write if can edit
create policy napkin_select on napkin_versions for select to authenticated using (true);
create policy napkin_insert on napkin_versions for insert to authenticated with check (can_edit_deal(deal_id));

-- buy boxes: private to the user
create policy buy_boxes_all on buy_boxes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- auto-create profile on signup ----------
create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
