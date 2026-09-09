-- ============================================================
-- Admin CRUD permission repair for existing deployments
-- Run once in Supabase SQL Editor if an older installation
-- cannot create/update/delete organizations or resources.
-- Safe to run repeatedly.
-- ============================================================

create schema if not exists private;

grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.resources to authenticated;
grant select, insert, update, delete on public.resource_availability to authenticated;

alter table public.organizations enable row level security;
alter table public.resources enable row level security;
alter table public.resource_availability enable row level security;

-- Organizations
drop policy if exists organizations_select_active_or_admin on public.organizations;
create policy organizations_select_active_or_admin on public.organizations
for select to authenticated
using (active or private.is_admin());

drop policy if exists organizations_admin_insert on public.organizations;
create policy organizations_admin_insert on public.organizations
for insert to authenticated
with check (private.is_admin());

drop policy if exists organizations_admin_update on public.organizations;
create policy organizations_admin_update on public.organizations
for update to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists organizations_admin_delete on public.organizations;
create policy organizations_admin_delete on public.organizations
for delete to authenticated
using (private.is_admin());

-- Resources
drop policy if exists resources_select_active_or_admin on public.resources;
create policy resources_select_active_or_admin on public.resources
for select to authenticated
using (
  private.is_admin()
  or (
    active
    and exists (
      select 1
      from public.organizations o
      where o.id = organization_id and o.active
    )
  )
);

drop policy if exists resources_admin_insert on public.resources;
create policy resources_admin_insert on public.resources
for insert to authenticated
with check (private.is_admin());

drop policy if exists resources_admin_update on public.resources;
create policy resources_admin_update on public.resources
for update to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists resources_admin_delete on public.resources;
create policy resources_admin_delete on public.resources
for delete to authenticated
using (private.is_admin());

-- Availability
drop policy if exists availability_admin_insert on public.resource_availability;
create policy availability_admin_insert on public.resource_availability
for insert to authenticated
with check (private.is_admin());

drop policy if exists availability_admin_update on public.resource_availability;
create policy availability_admin_update on public.resource_availability
for update to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists availability_admin_delete on public.resource_availability;
create policy availability_admin_delete on public.resource_availability
for delete to authenticated
using (private.is_admin());
