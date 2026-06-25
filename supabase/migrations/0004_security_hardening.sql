-- Security hardening (from code audit). Run in the Supabase SQL Editor
-- (dashboard → SQL) on the credeals project (ref dzduuhbtntikqjuzufpg).
--
-- Fixes:
--  1) CRITICAL — profiles_update_own let any authenticated user update their OWN row with no
--     column restriction, including is_admin. Combined with the security-definer is_admin()
--     check, a user could self-promote to admin and reach the service-role /api/admin actions.
--     A BEFORE UPDATE trigger now locks the privileged columns (is_admin, billable) to their
--     prior values for everyone except the service role (the /api/admin path) and existing admins.
--  2) MEDIUM — scenarios were readable in full by any authenticated user (incl. draft/off rows
--     and admin notes). Non-admins are now restricted to status='active'.

-- ---------- 1) prevent privilege escalation on profiles ----------
create or replace function prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service role (no auth.uid — the /api/admin service client) and existing admins may change
  -- privileged columns; everyone else has them pinned to their previous values.
  if auth.uid() is null or coalesce(public.is_admin(), false) then
    return new;
  end if;
  new.is_admin := old.is_admin;
  new.billable := old.billable;
  return new;
end;
$$;

drop trigger if exists profiles_no_priv_escalation on profiles;
create trigger profiles_no_priv_escalation
  before update on profiles
  for each row execute function prevent_profile_privilege_escalation();

-- ---------- 2) restrict scenario reads ----------
drop policy if exists scenarios_read on scenarios;
create policy scenarios_read on scenarios for select to authenticated
  using (status = 'active' or coalesce(public.is_admin(), false));
