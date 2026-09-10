-- v10.5 Booking application window + item categories

alter table public.resources
  add column if not exists category text;

create table if not exists public.booking_policy (
  singleton boolean primary key default true check (singleton = true),
  active boolean not null default false,
  mode text not null default 'fixed_month_day' check (mode in ('fixed_month_day','days_before_period')),
  scope text not null default 'month' check (scope in ('week','month','quarter')),
  fixed_day integer not null default 1 check (fixed_day between 1 and 28),
  days_before integer not null default 7 check (days_before between 0 and 365),
  updated_at timestamptz not null default now()
);

insert into public.booking_policy(singleton) values(true)
on conflict (singleton) do nothing;

alter table public.booking_policy enable row level security;
revoke all on table public.booking_policy from public, anon;
grant select, update on table public.booking_policy to authenticated;

drop policy if exists booking_policy_admin_select on public.booking_policy;
create policy booking_policy_admin_select on public.booking_policy
for select to authenticated using (private.is_admin());

drop policy if exists booking_policy_admin_update on public.booking_policy;
create policy booking_policy_admin_update on public.booking_policy
for update to authenticated using (private.is_admin()) with check (private.is_admin());

create or replace function private.booking_date_is_open(p_target date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.booking_policy%rowtype;
  v_today date := (now() at time zone 'Asia/Hong_Kong')::date;
  v_open date;
  v_limit date;
  v_period_start date;
begin
  if p_target is null or p_target < v_today then return false; end if;
  select * into s from public.booking_policy where singleton=true;
  if not found or not s.active then return true; end if;

  if s.mode='fixed_month_day' then
    v_open := make_date(extract(year from v_today)::int, extract(month from v_today)::int, s.fixed_day);
    if v_today < v_open then v_open := (v_open - interval '1 month')::date; end if;
    if s.scope='week' then v_limit := v_open + 7;
    elsif s.scope='month' then v_limit := (v_open + interval '1 month')::date;
    else v_limit := (v_open + interval '3 months')::date;
    end if;
    return p_target <= v_limit;
  end if;

  if s.scope='week' then
    v_period_start := date_trunc('week',p_target::timestamp)::date;
  elsif s.scope='month' then
    v_period_start := date_trunc('month',p_target::timestamp)::date;
  else
    v_period_start := date_trunc('quarter',p_target::timestamp)::date;
  end if;
  v_open := v_period_start - s.days_before;
  return v_today >= v_open;
end;
$$;
revoke all on function private.booking_date_is_open(date) from public, anon, authenticated;

create or replace function public.get_booking_policy()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'active',active,'mode',mode,'scope',scope,'fixed_day',fixed_day,'days_before',days_before,
    'today',(now() at time zone 'Asia/Hong_Kong')::date
  ) from public.booking_policy where singleton=true
$$;
revoke all on function public.get_booking_policy() from public;
grant execute on function public.get_booking_policy() to anon, authenticated;

-- Room request wrapper: preserve v10.4 Telegram behavior and enforce booking window.
create or replace function public.submit_organization_room_request(
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
declare v_group_ref text;
begin
  perform private.assert_organization_portal_password(p_organization_id,p_password);
  if not private.booking_date_is_open(p_booking_date) then raise exception 'BOOKING_WINDOW_CLOSED'; end if;
  if not exists(select 1 from public.resources r where r.id=p_room_resource_id and r.organization_id=p_organization_id and r.type='room' and r.active) then raise exception 'ORG_RESOURCE_MISMATCH'; end if;
  if p_items is not null and jsonb_typeof(p_items)='array' and exists(
    select 1 from jsonb_array_elements(p_items) item where not exists(
      select 1 from public.resources r where r.id=(item->>'resource_id')::uuid and r.organization_id=p_organization_id and r.type='item' and r.active
    )
  ) then raise exception 'ORG_RESOURCE_MISMATCH'; end if;
  v_group_ref:=public.submit_public_room_request(p_room_resource_id,p_booking_date,p_slots,p_items,p_purpose,p_applicant_name,p_phone,p_applicant_note);
  perform private.notify_new_application(p_organization_id,v_group_ref);
  return v_group_ref;
end;
$$;
revoke all on function public.submit_organization_room_request(uuid,text,uuid,date,jsonb,jsonb,text,text,text,text) from public;
grant execute on function public.submit_organization_room_request(uuid,text,uuid,date,jsonb,jsonb,text,text,text,text) to anon,authenticated;

-- External item request wrapper: both start and return dates must be open.
create or replace function public.submit_organization_loan_request(
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
declare v_group_ref text;
begin
  perform private.assert_organization_portal_password(p_organization_id,p_password);
  if not private.booking_date_is_open(p_start_date) or not private.booking_date_is_open(p_return_date) then raise exception 'BOOKING_WINDOW_CLOSED'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'INVALID_QUANTITY'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_items) item where not exists(
      select 1 from public.resources r where r.id=(item->>'resource_id')::uuid and r.organization_id=p_organization_id and r.type='item' and not r.requires_room and r.active
    )
  ) then raise exception 'ORG_RESOURCE_MISMATCH'; end if;
  v_group_ref:=public.submit_public_loan_request(p_start_date,p_return_date,p_items,p_purpose,p_applicant_name,p_phone,p_applicant_note);
  perform private.notify_new_application(p_organization_id,v_group_ref);
  return v_group_ref;
end;
$$;
revoke all on function public.submit_organization_loan_request(uuid,text,date,date,jsonb,text,text,text,text) from public;
grant execute on function public.submit_organization_loan_request(uuid,text,date,date,jsonb,text,text,text,text) to anon,authenticated;
