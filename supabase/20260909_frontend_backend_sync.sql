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
