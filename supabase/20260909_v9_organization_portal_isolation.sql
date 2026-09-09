-- ============================================================
-- v9: Organization portal password + strict organization isolation
-- Run after v7/v8 on an existing database.
-- Existing organizations receive temporary portal password: 1234
-- Change it immediately in Admin > 機構管理.
-- ============================================================

create extension if not exists pgcrypto;

alter table public.organizations
  add column if not exists access_password_hash text;

update public.organizations
set access_password_hash = crypt('1234', gen_salt('bf', 10))
where access_password_hash is null;

-- Internal password assertion. Never expose hashes to the browser.
create or replace function private.assert_organization_portal_password(
  p_organization_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  select o.access_password_hash into v_hash
  from public.organizations o
  where o.id = p_organization_id
    and o.active;

  if v_hash is null then
    raise exception 'ORGANIZATION_NOT_AVAILABLE';
  end if;

  if p_password is null or crypt(p_password, v_hash) <> v_hash then
    raise exception 'INVALID_ORGANIZATION_PASSWORD';
  end if;
end;
$$;

revoke all on function private.assert_organization_portal_password(uuid,text) from public;

-- Admin-only password setter.
create or replace function public.admin_set_organization_portal_password(
  p_organization_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_password is null or char_length(p_password) < 4 then
    raise exception 'PASSWORD_TOO_SHORT';
  end if;
  if char_length(p_password) > 64 then
    raise exception 'PASSWORD_TOO_LONG';
  end if;

  update public.organizations
  set access_password_hash = crypt(p_password, gen_salt('bf', 10)),
      updated_at = now()
  where id = p_organization_id;

  if not found then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
end;
$$;

revoke all on function public.admin_set_organization_portal_password(uuid,text) from public;
grant execute on function public.admin_set_organization_portal_password(uuid,text) to authenticated;

-- Public landing page may only see active organization IDs/names.
drop function if exists public.get_portal_organizations();
create function public.get_portal_organizations()
returns table(id uuid, name text)
language sql
security definer
set search_path = ''
as $$
  select o.id, o.name
  from public.organizations o
  where o.active
  order by o.name;
$$;

revoke all on function public.get_portal_organizations() from public;
grant execute on function public.get_portal_organizations() to anon, authenticated;

-- Password check for initial entry.
drop function if exists public.verify_organization_portal(uuid,text);
create function public.verify_organization_portal(
  p_organization_id uuid,
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_organization_portal_password(p_organization_id, p_password);
  return true;
exception
  when others then
    return false;
end;
$$;

revoke all on function public.verify_organization_portal(uuid,text) from public;
grant execute on function public.verify_organization_portal(uuid,text) to anon, authenticated;

-- One organization-scoped read endpoint for the complete public portal.
drop function if exists public.get_organization_portal_data(uuid,text);
create function public.get_organization_portal_data(
  p_organization_id uuid,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.assert_organization_portal_password(p_organization_id, p_password);

  select jsonb_build_object(
    'organization', jsonb_build_object('id', o.id, 'name', o.name),
    'resources', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.type, r.name)
      from public.resources r
      where r.organization_id = o.id and r.active
    ), '[]'::jsonb),
    'availability', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.resource_id, a.specific_date nulls last, a.weekday, a.start_time)
      from public.resource_availability a
      join public.resources r on r.id = a.resource_id
      where r.organization_id = o.id and r.active and a.active
    ), '[]'::jsonb),
    'resource_blocks', coalesce((
      select jsonb_agg(jsonb_build_object('resource_id', b.resource_id, 'block_date', b.block_date) order by b.block_date)
      from public.resource_blocks b
      join public.resources r on r.id = b.resource_id
      where r.organization_id = o.id and r.active
    ), '[]'::jsonb),
    'purpose_options', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.sort_order, p.label)
      from public.purpose_options p
      where p.active
    ), '[]'::jsonb),
    'public_bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'resource_id', r.id,
        'resource_name', r.name,
        'resource_type', r.type,
        'booking_date', b.booking_date,
        'loan_end_date', coalesce(b.loan_end_date, b.booking_date),
        'status', b.status,
        'quantity', b.quantity
      ) order by b.booking_date, r.name)
      from public.bookings b
      join public.resources r on r.id = b.resource_id
      where r.organization_id = o.id
        and r.active
        and b.status in ('approved','completed')
    ), '[]'::jsonb),
    'busy_periods', coalesce((
      select jsonb_agg(jsonb_build_object(
        'resource_id', r.id,
        'booking_date', b.booking_date,
        'loan_end_date', coalesce(b.loan_end_date, b.booking_date),
        'start_time', b.start_time,
        'end_time', b.end_time,
        'quantity', b.quantity
      ) order by b.booking_date, b.start_time)
      from public.bookings b
      join public.resources r on r.id = b.resource_id
      where r.organization_id = o.id
        and r.active
        and b.status in ('approved','completed')
    ), '[]'::jsonb)
  ) into v_result
  from public.organizations o
  where o.id = p_organization_id and o.active;

  if v_result is null then raise exception 'ORGANIZATION_NOT_AVAILABLE'; end if;
  return v_result;
end;
$$;

revoke all on function public.get_organization_portal_data(uuid,text) from public;
grant execute on function public.get_organization_portal_data(uuid,text) to anon, authenticated;

-- Organization-protected room submission wrapper.
drop function if exists public.submit_organization_room_request(uuid,text,uuid,date,jsonb,jsonb,text,text,text,text);
create function public.submit_organization_room_request(
  p_organization_id uuid,
  p_password text,
  p_room_resource_id uuid,
  p_booking_date date,
  p_slots jsonb,
  p_items jsonb,
  p_purpose text,
  p_applicant_name text,
  p_phone text,
  p_applicant_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_organization_portal_password(p_organization_id, p_password);

  if not exists (
    select 1 from public.resources r
    where r.id = p_room_resource_id
      and r.organization_id = p_organization_id
      and r.type = 'room'
      and r.active
  ) then raise exception 'ORG_RESOURCE_MISMATCH'; end if;

  if p_items is not null and jsonb_typeof(p_items) = 'array' and exists (
    select 1
    from jsonb_array_elements(p_items) item
    where not exists (
      select 1 from public.resources r
      where r.id = (item->>'resource_id')::uuid
        and r.organization_id = p_organization_id
        and r.type = 'item'
        and r.active
    )
  ) then raise exception 'ORG_RESOURCE_MISMATCH'; end if;

  return public.submit_public_room_request(
    p_room_resource_id, p_booking_date, p_slots, p_items,
    p_purpose, p_applicant_name, p_phone, p_applicant_note
  );
end;
$$;

revoke all on function public.submit_organization_room_request(uuid,text,uuid,date,jsonb,jsonb,text,text,text,text) from public;
grant execute on function public.submit_organization_room_request(uuid,text,uuid,date,jsonb,jsonb,text,text,text,text) to anon, authenticated;

-- Organization-protected standalone item submission wrapper.
drop function if exists public.submit_organization_loan_request(uuid,text,date,date,jsonb,text,text,text,text);
create function public.submit_organization_loan_request(
  p_organization_id uuid,
  p_password text,
  p_start_date date,
  p_return_date date,
  p_items jsonb,
  p_purpose text,
  p_applicant_name text,
  p_phone text,
  p_applicant_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_organization_portal_password(p_organization_id, p_password);

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_QUANTITY';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where not exists (
      select 1 from public.resources r
      where r.id = (item->>'resource_id')::uuid
        and r.organization_id = p_organization_id
        and r.type = 'item'
        and not r.requires_room
        and r.active
    )
  ) then raise exception 'ORG_RESOURCE_MISMATCH'; end if;

  return public.submit_public_loan_request(
    p_start_date, p_return_date, p_items,
    p_purpose, p_applicant_name, p_phone, p_applicant_note
  );
end;
$$;

revoke all on function public.submit_organization_loan_request(uuid,text,date,date,jsonb,text,text,text,text) from public;
grant execute on function public.submit_organization_loan_request(uuid,text,date,date,jsonb,text,text,text,text) to anon, authenticated;

-- IMPORTANT: remove old anonymous cross-organization table reads.
drop policy if exists organizations_public_select on public.organizations;
drop policy if exists resources_public_select on public.resources;
drop policy if exists availability_public_select on public.resource_availability;
drop policy if exists resource_blocks_public_select on public.resource_blocks;

revoke select on public.organizations from anon;
revoke select on public.resources from anon;
revoke select on public.resource_availability from anon;
revoke select on public.resource_blocks from anon;

-- Remove anonymous access to legacy unscoped public APIs so the organization
-- password cannot be bypassed by calling them directly.
revoke execute on function public.get_public_resource_bookings() from anon, authenticated;
revoke execute on function public.get_public_resource_busy_periods() from anon, authenticated;
revoke execute on function public.submit_public_room_request(uuid,date,jsonb,jsonb,text,text,text,text) from anon, authenticated;
revoke execute on function public.submit_public_loan_request(date,date,jsonb,text,text,text,text) from anon, authenticated;
