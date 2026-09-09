-- v6 Borrowing Status Calendar + blocked resource dates
-- Apply after previous room-resource-booking-system migrations.

create table if not exists public.resource_blocks (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  block_date date not null,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique(resource_id, block_date)
);

create index if not exists idx_resource_blocks_resource_date
  on public.resource_blocks(resource_id, block_date);

alter table public.resource_blocks enable row level security;

drop policy if exists resource_blocks_public_select on public.resource_blocks;
create policy resource_blocks_public_select on public.resource_blocks
for select to anon
using (
  exists (
    select 1
    from public.resources r
    join public.organizations o on o.id = r.organization_id
    where r.id = resource_id
      and r.active
      and o.active
  )
);

drop policy if exists resource_blocks_authenticated_select on public.resource_blocks;
create policy resource_blocks_authenticated_select on public.resource_blocks
for select to authenticated
using (
  private.is_admin()
  or exists (
    select 1
    from public.resources r
    join public.organizations o on o.id = r.organization_id
    where r.id = resource_id
      and r.active
      and o.active
  )
);

drop policy if exists resource_blocks_admin_insert on public.resource_blocks;
create policy resource_blocks_admin_insert on public.resource_blocks
for insert to authenticated
with check (private.is_admin());

drop policy if exists resource_blocks_admin_update on public.resource_blocks;
create policy resource_blocks_admin_update on public.resource_blocks
for update to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists resource_blocks_admin_delete on public.resource_blocks;
create policy resource_blocks_admin_delete on public.resource_blocks
for delete to authenticated
using (private.is_admin());

grant select on public.resource_blocks to anon;
grant select, insert, update, delete on public.resource_blocks to authenticated;


-- A date may only be blocked when there is no approved/completed borrowing on that resource/date.
create or replace function private.enforce_block_empty_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.bookings b
    where b.resource_id = new.resource_id
      and b.status in ('approved','completed')
      and new.block_date between b.booking_date and coalesce(b.loan_end_date,b.booking_date)
  ) then
    raise exception 'DATE_ALREADY_BOOKED';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_block_empty_date() from public, anon, authenticated;

drop trigger if exists resource_blocks_empty_date_guard on public.resource_blocks;
create trigger resource_blocks_empty_date_guard
before insert or update of resource_id, block_date
on public.resource_blocks
for each row execute function private.enforce_block_empty_date();

-- Enforce blocked dates at database level, so public users cannot bypass the UI.
create or replace function private.enforce_resource_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_end_date date;
begin
  -- Rejected/cancelled rows no longer consume a borrowable date.
  if new.status in ('rejected','cancelled') then
    return new;
  end if;

  v_end_date := coalesce(new.loan_end_date, new.booking_date);

  if exists (
    select 1
    from public.resource_blocks rb
    where rb.resource_id = new.resource_id
      and rb.block_date between new.booking_date and v_end_date
  ) then
    raise exception 'RESOURCE_DATE_BLOCKED';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_resource_block() from public, anon, authenticated;

drop trigger if exists bookings_resource_block_guard on public.bookings;
create trigger bookings_resource_block_guard
before insert or update of resource_id, booking_date, loan_end_date, status
on public.bookings
for each row execute function private.enforce_resource_block();

-- Admin can safely edit an existing borrowing record through an authenticated RPC.
create or replace function public.admin_update_booking_record(
  p_booking_id uuid,
  p_resource_id uuid,
  p_booking_date date,
  p_loan_end_date date,
  p_start_time time,
  p_end_time time,
  p_quantity integer,
  p_applicant_name text,
  p_phone text,
  p_purpose text,
  p_applicant_note text,
  p_status text
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
  if p_end_time <= p_start_time then
    raise exception 'INVALID_TIME_RANGE';
  end if;
  if p_loan_end_date is not null and p_loan_end_date < p_booking_date then
    raise exception 'INVALID_RETURN_DATE';
  end if;
  if p_quantity < 1 then
    raise exception 'INVALID_QUANTITY';
  end if;
  if p_status not in ('pending','approved','rejected','completed','cancelled') then
    raise exception 'INVALID_STATUS';
  end if;
  if nullif(trim(p_applicant_name),'') is null or nullif(trim(p_phone),'') is null or nullif(trim(p_purpose),'') is null then
    raise exception 'MISSING_REQUIRED_FIELDS';
  end if;

  update public.bookings
  set resource_id = p_resource_id,
      booking_date = p_booking_date,
      loan_end_date = p_loan_end_date,
      start_time = p_start_time,
      end_time = p_end_time,
      quantity = p_quantity,
      applicant_name = trim(p_applicant_name),
      phone = trim(p_phone),
      purpose = trim(p_purpose),
      applicant_note = nullif(trim(coalesce(p_applicant_note,'')),''),
      status = p_status,
      reviewed_by = auth.uid(),
      reviewed_at = case when p_status in ('approved','rejected','completed','cancelled') then now() else reviewed_at end,
      updated_at = now()
  where id = p_booking_id;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.admin_update_booking_record(uuid,uuid,date,date,time,time,integer,text,text,text,text,text) from public;
grant execute on function public.admin_update_booking_record(uuid,uuid,date,date,time,time,integer,text,text,text,text,text) to authenticated;

create or replace function public.admin_delete_booking_record(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  delete from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.admin_delete_booking_record(uuid) from public;
grant execute on function public.admin_delete_booking_record(uuid) to authenticated;

-- Realtime support for the admin/public calendars.
do $$
begin
  begin
    alter publication supabase_realtime add table public.resource_blocks;
  exception when duplicate_object then null;
  end;
end $$;
