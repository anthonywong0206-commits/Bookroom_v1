-- ============================================================
-- 房間及物品預約系統 - Supabase schema
-- Target: Supabase hosted Postgres (2026)
-- Run this whole file once in Supabase SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;
create schema if not exists private;

-- -----------------------------
-- Tables
-- -----------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('room','item')),
  name text not null,
  location text,
  description text,
  capacity integer not null default 1 check (capacity > 0),
  stock_quantity integer not null default 1 check (stock_quantity > 0),
  requires_room boolean not null default false,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, type, name)
);

create table if not exists public.resource_availability (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  specific_date date,
  weekday smallint check (weekday between 0 and 6),
  date_from date,
  date_to date,
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint availability_mode_check check (
    (specific_date is not null and weekday is null)
    or (specific_date is null and weekday is not null)
  ),
  constraint availability_time_check check (end_time > start_time),
  constraint availability_range_check check (date_to is null or date_from is null or date_to >= date_from)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference_no text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete restrict,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  quantity integer not null default 1 check (quantity > 0),
  attendees integer not null default 1 check (attendees > 0),
  purpose text not null check (char_length(trim(purpose)) > 0),
  applicant_name text not null check (char_length(trim(applicant_name)) > 0),
  phone text not null check (char_length(trim(phone)) > 0),
  applicant_note text,
  related_booking_id uuid references public.bookings(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','completed','cancelled')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_time_check check (end_time > start_time)
);

create index if not exists idx_resources_org_type on public.resources (organization_id, type, active);
create index if not exists idx_availability_resource_date on public.resource_availability (resource_id, specific_date, weekday, start_time);
create index if not exists idx_bookings_user on public.bookings (user_id, created_at desc);
create index if not exists idx_bookings_resource_slot on public.bookings (resource_id, booking_date, start_time, end_time, status);
create index if not exists idx_bookings_status on public.bookings (status, created_at desc);

-- -----------------------------
-- Updated-at trigger
-- -----------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function private.set_updated_at();

drop trigger if exists resources_set_updated_at on public.resources;
create trigger resources_set_updated_at before update on public.resources
for each row execute function private.set_updated_at();

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at before update on public.bookings
for each row execute function private.set_updated_at();

-- -----------------------------
-- New auth user -> profile
-- -----------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    'user',
    nullif(new.raw_user_meta_data ->> 'full_name',''),
    nullif(new.raw_user_meta_data ->> 'phone','')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- Backfill profiles for any users that existed before this schema was installed.
insert into public.profiles (id, role, full_name, phone)
select id, 'user', nullif(raw_user_meta_data ->> 'full_name',''), nullif(raw_user_meta_data ->> 'phone','')
from auth.users
on conflict (id) do nothing;

-- -----------------------------
-- Admin helper: private schema, not exposed as a Data API RPC
-- -----------------------------
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- -----------------------------
-- RLS
-- -----------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.resources enable row level security;
alter table public.resource_availability enable row level security;
alter table public.bookings enable row level security;

-- profiles
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
for select to authenticated
using ((select auth.uid()) = id or private.is_admin());

-- organizations
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

-- resources
drop policy if exists resources_select_active_or_admin on public.resources;
create policy resources_select_active_or_admin on public.resources
for select to authenticated
using (
  private.is_admin()
  or (
    active
    and exists (
      select 1 from public.organizations o
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

-- availability
drop policy if exists availability_select_active_resource on public.resource_availability;
create policy availability_select_active_resource on public.resource_availability
for select to authenticated
using (
  private.is_admin()
  or (
    active
    and exists (
      select 1
      from public.resources r
      join public.organizations o on o.id = r.organization_id
      where r.id = resource_id and r.active and o.active
    )
  )
);

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

-- bookings are inserted/updated through secured RPCs below.
drop policy if exists bookings_select_own_or_admin on public.bookings;
create policy bookings_select_own_or_admin on public.bookings
for select to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

-- -----------------------------
-- Explicit Data API grants
-- Supabase 2026 no longer guarantees new public tables are auto-exposed.
-- RLS above remains the row-level authorization layer.
-- -----------------------------
revoke all on public.profiles, public.organizations, public.resources, public.resource_availability, public.bookings from anon;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.resources to authenticated;
grant select, insert, update, delete on public.resource_availability to authenticated;
grant select on public.bookings to authenticated;

-- -----------------------------
-- RPC: remaining capacity/stock for an exact slot
-- -----------------------------
create or replace function public.get_resource_remaining(
  p_resource_id uuid,
  p_booking_date date,
  p_start_time time,
  p_end_time time
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_type text;
  v_capacity integer;
  v_stock integer;
  v_used integer;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_end_time <= p_start_time then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  select r.type, r.capacity, r.stock_quantity
  into v_type, v_capacity, v_stock
  from public.resources r
  join public.organizations o on o.id = r.organization_id
  where r.id = p_resource_id and r.active and o.active;

  if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;

  if v_type = 'room' then
    if exists (
      select 1 from public.bookings b
      where b.resource_id = p_resource_id
        and b.booking_date = p_booking_date
        and b.status = 'approved'
        and b.start_time < p_end_time
        and b.end_time > p_start_time
    ) then return 0; end if;
    return v_capacity;
  end if;

  select coalesce(sum(b.quantity),0)::integer
  into v_used
  from public.bookings b
  where b.resource_id = p_resource_id
    and b.booking_date = p_booking_date
    and b.status = 'approved'
    and b.start_time < p_end_time
    and b.end_time > p_start_time;

  return greatest(v_stock - v_used, 0);
end;
$$;

revoke all on function public.get_resource_remaining(uuid,date,time,time) from public, anon;
grant execute on function public.get_resource_remaining(uuid,date,time,time) to authenticated;

-- -----------------------------
-- RPC: submit a booking safely
-- Pending requests do not consume stock/room capacity; approved bookings do.
-- Approval performs the same check again under a resource row lock.
-- -----------------------------
create or replace function public.submit_booking(
  p_resource_id uuid,
  p_booking_date date,
  p_start_time time,
  p_end_time time,
  p_quantity integer,
  p_attendees integer,
  p_purpose text,
  p_applicant_name text,
  p_phone text,
  p_related_booking_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_resource public.resources%rowtype;
  v_ref text;
  v_used integer := 0;
  v_related public.bookings%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_booking_date < current_date then raise exception 'PAST_DATE_NOT_ALLOWED'; end if;
  if p_end_time <= p_start_time then raise exception 'INVALID_TIME_RANGE'; end if;
  if coalesce(p_quantity,0) < 1 or coalesce(p_attendees,0) < 1 then raise exception 'INVALID_QUANTITY'; end if;
  if nullif(trim(p_purpose),'') is null or nullif(trim(p_applicant_name),'') is null or nullif(trim(p_phone),'') is null then
    raise exception 'MISSING_REQUIRED_FIELDS';
  end if;

  -- Locks this resource so approval/capacity checks serialize correctly.
  select r.* into v_resource
  from public.resources r
  join public.organizations o on o.id = r.organization_id
  where r.id = p_resource_id and r.active and o.active
  for update of r;
  if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;

  -- The requested exact slot must be configured by an active availability rule.
  if not exists (
    select 1 from public.resource_availability a
    where a.resource_id = p_resource_id
      and a.active
      and a.start_time = p_start_time
      and a.end_time = p_end_time
      and (
        a.specific_date = p_booking_date
        or (
          a.specific_date is null
          and a.weekday = extract(dow from p_booking_date)::smallint
          and (a.date_from is null or p_booking_date >= a.date_from)
          and (a.date_to is null or p_booking_date <= a.date_to)
        )
      )
  ) then raise exception 'SLOT_NOT_AVAILABLE'; end if;

  if v_resource.type = 'room' then
    if p_attendees > v_resource.capacity then raise exception 'ROOM_CAPACITY_EXCEEDED'; end if;
    if exists (
      select 1 from public.bookings b
      where b.resource_id = p_resource_id
        and b.booking_date = p_booking_date
        and b.status = 'approved'
        and b.start_time < p_end_time
        and b.end_time > p_start_time
    ) then raise exception 'ROOM_ALREADY_BOOKED'; end if;
  else
    select coalesce(sum(b.quantity),0)::integer into v_used
    from public.bookings b
    where b.resource_id = p_resource_id
      and b.booking_date = p_booking_date
      and b.status = 'approved'
      and b.start_time < p_end_time
      and b.end_time > p_start_time;
    if p_quantity > greatest(v_resource.stock_quantity - v_used, 0) then raise exception 'ITEM_STOCK_EXCEEDED'; end if;

    if v_resource.requires_room then
      if p_related_booking_id is null then raise exception 'RELATED_ROOM_REQUIRED'; end if;
      select b.* into v_related
      from public.bookings b
      join public.resources rr on rr.id = b.resource_id
      where b.id = p_related_booking_id
        and b.user_id = v_user
        and rr.type = 'room'
        and rr.organization_id = v_resource.organization_id
        and b.booking_date = p_booking_date
        and b.start_time <= p_start_time
        and b.end_time >= p_end_time
        and b.status in ('pending','approved');
      if not found then raise exception 'INVALID_RELATED_ROOM'; end if;
    else
      p_related_booking_id := null;
    end if;
  end if;

  v_ref := 'R' || to_char(clock_timestamp(),'YYYYMMDDHH24MISS') || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));

  insert into public.bookings (
    reference_no,user_id,resource_id,booking_date,start_time,end_time,
    quantity,attendees,purpose,applicant_name,phone,related_booking_id,status
  ) values (
    v_ref,v_user,p_resource_id,p_booking_date,p_start_time,p_end_time,
    case when v_resource.type='item' then p_quantity else 1 end,
    case when v_resource.type='room' then p_attendees else 1 end,
    trim(p_purpose),trim(p_applicant_name),trim(p_phone),p_related_booking_id,'pending'
  );

  return v_ref;
end;
$$;

revoke all on function public.submit_booking(uuid,date,time,time,integer,integer,text,text,text,uuid) from public, anon;
grant execute on function public.submit_booking(uuid,date,time,time,integer,integer,text,text,text,uuid) to authenticated;

-- -----------------------------
-- RPC: admin approval/status changes with concurrency-safe recheck
-- -----------------------------
create or replace function public.update_booking_status(
  p_booking_id uuid,
  p_status text,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_resource public.resources%rowtype;
  v_used integer := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_status not in ('approved','rejected','completed') then raise exception 'INVALID_STATUS'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if p_status in ('approved','rejected') and v_booking.status <> 'pending' then
    raise exception 'ONLY_PENDING_CAN_BE_REVIEWED';
  end if;
  if p_status = 'completed' and v_booking.status <> 'approved' then
    raise exception 'ONLY_APPROVED_CAN_BE_COMPLETED';
  end if;

  if p_status = 'approved' then
    select r.* into v_resource
    from public.resources r
    join public.organizations o on o.id = r.organization_id
    where r.id = v_booking.resource_id and r.active and o.active
    for update of r;
    if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;

    if v_resource.type = 'room' then
      if v_booking.attendees > v_resource.capacity then raise exception 'ROOM_CAPACITY_EXCEEDED'; end if;
      if exists (
        select 1 from public.bookings b
        where b.id <> v_booking.id
          and b.resource_id = v_booking.resource_id
          and b.booking_date = v_booking.booking_date
          and b.status = 'approved'
          and b.start_time < v_booking.end_time
          and b.end_time > v_booking.start_time
      ) then raise exception 'ROOM_ALREADY_BOOKED'; end if;
    else
      select coalesce(sum(b.quantity),0)::integer into v_used
      from public.bookings b
      where b.id <> v_booking.id
        and b.resource_id = v_booking.resource_id
        and b.booking_date = v_booking.booking_date
        and b.status = 'approved'
        and b.start_time < v_booking.end_time
        and b.end_time > v_booking.start_time;
      if v_booking.quantity > greatest(v_resource.stock_quantity - v_used,0) then raise exception 'ITEM_STOCK_EXCEEDED'; end if;

      if v_resource.requires_room then
        if v_booking.related_booking_id is null or not exists (
          select 1 from public.bookings rb
          join public.resources rr on rr.id = rb.resource_id
          where rb.id = v_booking.related_booking_id
            and rb.user_id = v_booking.user_id
            and rb.status = 'approved'
            and rr.type = 'room'
            and rr.organization_id = v_resource.organization_id
            and rb.booking_date = v_booking.booking_date
            and rb.start_time <= v_booking.start_time
            and rb.end_time >= v_booking.end_time
        ) then raise exception 'RELATED_ROOM_MUST_BE_APPROVED'; end if;
      end if;
    end if;
  end if;

  update public.bookings
  set status = p_status,
      admin_note = nullif(trim(coalesce(p_admin_note,'')),''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_booking_id;
end;
$$;

revoke all on function public.update_booking_status(uuid,text,text) from public, anon;
grant execute on function public.update_booking_status(uuid,text,text) to authenticated;

-- -----------------------------
-- RPC: user cancels own pending request
-- -----------------------------
create or replace function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  update public.bookings
  set status = 'cancelled'
  where id = p_booking_id
    and user_id = auth.uid()
    and status = 'pending';

  if not found then raise exception 'ONLY_OWN_PENDING_CAN_BE_CANCELLED'; end if;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- -----------------------------
-- Realtime publication
-- Safe to re-run; does not modify Supabase's locked realtime schema.
-- -----------------------------
do $$
declare
  t text;
begin
  foreach t in array array['organizations','resources','resource_availability','bookings']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- INITIAL ADMIN (run AFTER that person signs up)
-- Replace the email below, then run this one statement manually:
--
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'admin@example.com');
-- ============================================================


-- ============================================================
-- Frontend / Admin synchronization additions (2026-09-09)
-- ============================================================
-- Frontend / Admin single-source synchronization fix
-- Safe to run after the existing reservation schema.

-- Public website requests do not require a member account.
alter table public.bookings alter column user_id drop not null;
alter table public.bookings add column if not exists loan_end_date date;

-- Read-only public catalogue. Admin/authenticated policies remain unchanged.
drop policy if exists organizations_public_select on public.organizations;
create policy organizations_public_select on public.organizations
for select to anon
using (active);

drop policy if exists resources_public_select on public.resources;
create policy resources_public_select on public.resources
for select to anon
using (
  active
  and exists (
    select 1 from public.organizations o
    where o.id = organization_id and o.active
  )
);

drop policy if exists availability_public_select on public.resource_availability;
create policy availability_public_select on public.resource_availability
for select to anon
using (
  active
  and exists (
    select 1
    from public.resources r
    join public.organizations o on o.id = r.organization_id
    where r.id = resource_id and r.active and o.active
  )
);

grant select on public.organizations, public.resources, public.resource_availability to anon;

-- Public booking calendar intentionally exposes no applicant / purpose / phone / reference number.
create or replace function public.get_public_resource_bookings()
returns table (
  resource_id uuid,
  resource_name text,
  resource_type text,
  booking_date date,
  loan_end_date date,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct
    r.id,
    r.name,
    r.type,
    b.booking_date,
    coalesce(b.loan_end_date, b.booking_date),
    b.status
  from public.bookings b
  join public.resources r on r.id = b.resource_id
  join public.organizations o on o.id = r.organization_id
  where b.status in ('approved','completed')
    and r.active
    and o.active
  order by b.booking_date, r.name;
$$;

revoke all on function public.get_public_resource_bookings() from public;
grant execute on function public.get_public_resource_bookings() to anon, authenticated;

-- Submit one room request, optionally containing several configured room slots
-- and same-day centre-use items. Applicant details remain private in bookings.
create or replace function public.submit_public_room_request(
  p_room_resource_id uuid,
  p_booking_date date,
  p_slots jsonb,
  p_items jsonb,
  p_purpose text,
  p_applicant_name text,
  p_phone text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.resources%rowtype;
  v_slot jsonb;
  v_item_req jsonb;
  v_item public.resources%rowtype;
  v_start time;
  v_end time;
  v_min_start time := '23:59';
  v_max_end time := '00:00';
  v_group_ref text;
  v_row_ref text;
  v_room_booking_id uuid;
  v_first_room_booking_id uuid;
  v_index integer := 0;
  v_qty integer;
  v_used integer;
begin
  if p_booking_date < current_date then raise exception 'PAST_DATE_NOT_ALLOWED'; end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 then raise exception 'SLOT_NOT_AVAILABLE'; end if;
  if nullif(trim(p_purpose),'') is null or nullif(trim(p_applicant_name),'') is null or nullif(trim(p_phone),'') is null then
    raise exception 'MISSING_REQUIRED_FIELDS';
  end if;

  select r.* into v_room
  from public.resources r
  join public.organizations o on o.id = r.organization_id
  where r.id = p_room_resource_id and r.type = 'room' and r.active and o.active
  for update of r;
  if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;

  v_group_ref := 'R' || to_char(clock_timestamp(),'YYYYMMDDHH24MISS') || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));

  for v_slot in select * from jsonb_array_elements(p_slots)
  loop
    v_index := v_index + 1;
    v_start := (v_slot->>'start_time')::time;
    v_end := (v_slot->>'end_time')::time;
    if v_end <= v_start then raise exception 'INVALID_TIME_RANGE'; end if;

    if not exists (
      select 1 from public.resource_availability a
      where a.resource_id = p_room_resource_id
        and a.active
        and a.start_time = v_start
        and a.end_time = v_end
        and (
          a.specific_date = p_booking_date
          or (
            a.specific_date is null
            and a.weekday = extract(dow from p_booking_date)::smallint
            and (a.date_from is null or p_booking_date >= a.date_from)
            and (a.date_to is null or p_booking_date <= a.date_to)
          )
        )
    ) then raise exception 'SLOT_NOT_AVAILABLE'; end if;

    if exists (
      select 1 from public.bookings b
      where b.resource_id = p_room_resource_id
        and b.booking_date = p_booking_date
        and b.status = 'approved'
        and b.start_time < v_end
        and b.end_time > v_start
    ) then raise exception 'ROOM_ALREADY_BOOKED'; end if;

    v_row_ref := v_group_ref || '-' || v_index::text;
    insert into public.bookings (
      reference_no,user_id,resource_id,booking_date,start_time,end_time,
      quantity,attendees,purpose,applicant_name,phone,related_booking_id,status,loan_end_date
    ) values (
      v_row_ref,null,p_room_resource_id,p_booking_date,v_start,v_end,
      1,1,trim(p_purpose),trim(p_applicant_name),trim(p_phone),null,'pending',null
    ) returning id into v_room_booking_id;

    if v_first_room_booking_id is null then v_first_room_booking_id := v_room_booking_id; end if;
    if v_start < v_min_start then v_min_start := v_start; end if;
    if v_end > v_max_end then v_max_end := v_end; end if;
  end loop;

  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    v_index := 0;
    for v_item_req in select * from jsonb_array_elements(p_items)
    loop
      v_index := v_index + 1;
      v_qty := greatest(1, coalesce((v_item_req->>'quantity')::integer, 1));
      select r.* into v_item
      from public.resources r
      join public.organizations o on o.id = r.organization_id
      where r.id = (v_item_req->>'resource_id')::uuid
        and r.type = 'item'
        and r.requires_room
        and r.organization_id = v_room.organization_id
        and r.active and o.active
      for update of r;
      if not found then raise exception 'INVALID_RELATED_ROOM'; end if;

      select coalesce(sum(b.quantity),0)::integer into v_used
      from public.bookings b
      where b.resource_id = v_item.id
        and b.booking_date = p_booking_date
        and b.status = 'approved'
        and b.start_time < v_max_end
        and b.end_time > v_min_start;
      if v_qty > greatest(v_item.stock_quantity - v_used,0) then raise exception 'ITEM_STOCK_EXCEEDED'; end if;

      insert into public.bookings (
        reference_no,user_id,resource_id,booking_date,start_time,end_time,
        quantity,attendees,purpose,applicant_name,phone,related_booking_id,status,loan_end_date
      ) values (
        v_group_ref || '-I' || v_index::text,null,v_item.id,p_booking_date,v_min_start,v_max_end,
        v_qty,1,trim(p_purpose),trim(p_applicant_name),trim(p_phone),v_first_room_booking_id,'pending',null
      );
    end loop;
  end if;

  return v_group_ref;
end;
$$;

revoke all on function public.submit_public_room_request(uuid,date,jsonb,jsonb,text,text,text) from public;
grant execute on function public.submit_public_room_request(uuid,date,jsonb,jsonb,text,text,text) to anon, authenticated;

-- External item loan request with a start and return date.
create or replace function public.submit_public_loan_request(
  p_start_date date,
  p_return_date date,
  p_items jsonb,
  p_purpose text,
  p_applicant_name text,
  p_phone text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_req jsonb;
  v_item public.resources%rowtype;
  v_group_ref text;
  v_index integer := 0;
  v_qty integer;
  v_used integer;
begin
  if p_start_date < current_date then raise exception 'PAST_DATE_NOT_ALLOWED'; end if;
  if p_return_date < p_start_date then raise exception 'INVALID_RETURN_DATE'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'INVALID_QUANTITY'; end if;
  if nullif(trim(p_purpose),'') is null or nullif(trim(p_applicant_name),'') is null or nullif(trim(p_phone),'') is null then
    raise exception 'MISSING_REQUIRED_FIELDS';
  end if;

  v_group_ref := 'B' || to_char(clock_timestamp(),'YYYYMMDDHH24MISS') || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));

  for v_item_req in select * from jsonb_array_elements(p_items)
  loop
    v_index := v_index + 1;
    v_qty := greatest(1, coalesce((v_item_req->>'quantity')::integer, 1));
    select r.* into v_item
    from public.resources r
    join public.organizations o on o.id = r.organization_id
    where r.id = (v_item_req->>'resource_id')::uuid
      and r.type = 'item'
      and not r.requires_room
      and r.active and o.active
    for update of r;
    if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;

    select coalesce(sum(b.quantity),0)::integer into v_used
    from public.bookings b
    where b.resource_id = v_item.id
      and b.status = 'approved'
      and b.booking_date <= p_return_date
      and coalesce(b.loan_end_date,b.booking_date) >= p_start_date;
    if v_qty > greatest(v_item.stock_quantity - v_used,0) then raise exception 'ITEM_STOCK_EXCEEDED'; end if;

    insert into public.bookings (
      reference_no,user_id,resource_id,booking_date,loan_end_date,start_time,end_time,
      quantity,attendees,purpose,applicant_name,phone,related_booking_id,status
    ) values (
      v_group_ref || '-' || v_index::text,null,v_item.id,p_start_date,p_return_date,'09:00','18:00',
      v_qty,1,trim(p_purpose),trim(p_applicant_name),trim(p_phone),null,'pending'
    );
  end loop;

  return v_group_ref;
end;
$$;

revoke all on function public.submit_public_loan_request(date,date,jsonb,text,text,text) from public;
grant execute on function public.submit_public_loan_request(date,date,jsonb,text,text,text) to anon, authenticated;

-- Approval recheck updated for public (NULL user_id) requests and multi-day external loans.
create or replace function public.update_booking_status(
  p_booking_id uuid,
  p_status text,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_resource public.resources%rowtype;
  v_used integer := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_status not in ('approved','rejected','completed') then raise exception 'INVALID_STATUS'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if p_status in ('approved','rejected') and v_booking.status <> 'pending' then raise exception 'ONLY_PENDING_CAN_BE_REVIEWED'; end if;
  if p_status = 'completed' and v_booking.status <> 'approved' then raise exception 'ONLY_APPROVED_CAN_BE_COMPLETED'; end if;

  if p_status = 'approved' then
    select r.* into v_resource
    from public.resources r
    join public.organizations o on o.id = r.organization_id
    where r.id = v_booking.resource_id and r.active and o.active
    for update of r;
    if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;

    if v_resource.type = 'room' then
      if v_booking.attendees > v_resource.capacity then raise exception 'ROOM_CAPACITY_EXCEEDED'; end if;
      if exists (
        select 1 from public.bookings b
        where b.id <> v_booking.id
          and b.resource_id = v_booking.resource_id
          and b.booking_date = v_booking.booking_date
          and b.status = 'approved'
          and b.start_time < v_booking.end_time
          and b.end_time > v_booking.start_time
      ) then raise exception 'ROOM_ALREADY_BOOKED'; end if;
    else
      if not v_resource.requires_room and v_booking.loan_end_date is not null then
        select coalesce(sum(b.quantity),0)::integer into v_used
        from public.bookings b
        where b.id <> v_booking.id
          and b.resource_id = v_booking.resource_id
          and b.status = 'approved'
          and b.booking_date <= v_booking.loan_end_date
          and coalesce(b.loan_end_date,b.booking_date) >= v_booking.booking_date;
      else
        select coalesce(sum(b.quantity),0)::integer into v_used
        from public.bookings b
        where b.id <> v_booking.id
          and b.resource_id = v_booking.resource_id
          and b.booking_date = v_booking.booking_date
          and b.status = 'approved'
          and b.start_time < v_booking.end_time
          and b.end_time > v_booking.start_time;
      end if;
      if v_booking.quantity > greatest(v_resource.stock_quantity - v_used,0) then raise exception 'ITEM_STOCK_EXCEEDED'; end if;

      if v_resource.requires_room then
        if v_booking.related_booking_id is null or not exists (
          select 1 from public.bookings rb
          join public.resources rr on rr.id = rb.resource_id
          where rb.id = v_booking.related_booking_id
            and rb.user_id is not distinct from v_booking.user_id
            and rb.status = 'approved'
            and rr.type = 'room'
            and rr.organization_id = v_resource.organization_id
            and rb.booking_date = v_booking.booking_date
            and rb.start_time <= v_booking.start_time
            and rb.end_time >= v_booking.end_time
        ) then raise exception 'RELATED_ROOM_MUST_BE_APPROVED'; end if;
      end if;
    end if;
  end if;

  update public.bookings
  set status = p_status,
      admin_note = nullif(trim(coalesce(p_admin_note,'')),''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_booking_id;
end;
$$;

revoke all on function public.update_booking_status(uuid,text,text) from public, anon;
grant execute on function public.update_booking_status(uuid,text,text) to authenticated;


-- After this base schema, run supabase/20260909_v5_items_images_purposes.sql for v5 public flows, purpose options and resource images.
