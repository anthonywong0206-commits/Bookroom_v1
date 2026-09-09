-- ============================================================
-- v7: calendar CRUD, related room items, duration/start-time flow
-- Run after v5 + v6 migrations.
-- ============================================================

-- Public-safe busy periods for room availability calculations.
-- Applicant name / phone / purpose / reference numbers are intentionally omitted.
drop function if exists public.get_public_resource_busy_periods();
create function public.get_public_resource_busy_periods()
returns table (
  resource_id uuid,
  booking_date date,
  loan_end_date date,
  start_time time,
  end_time time,
  quantity integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.resource_id,
    b.booking_date,
    coalesce(b.loan_end_date,b.booking_date),
    b.start_time,
    b.end_time,
    b.quantity
  from public.bookings b
  join public.resources r on r.id=b.resource_id
  join public.organizations o on o.id=r.organization_id
  where b.status in ('approved','completed')
    and r.active and o.active
  order by b.booking_date,b.start_time;
$$;
revoke all on function public.get_public_resource_busy_periods() from public;
grant execute on function public.get_public_resource_busy_periods() to anon, authenticated;

-- Room bookings now accept any 30-minute-aligned interval that is fully contained
-- inside an active availability window. This supports 30 min / 1h / 2h / custom duration.
drop function if exists public.submit_public_room_request(uuid,date,jsonb,jsonb,text,text,text,text);
create function public.submit_public_room_request(
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
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots)=0 then raise exception 'SLOT_NOT_AVAILABLE'; end if;
  if nullif(trim(p_purpose),'') is null or nullif(trim(p_applicant_name),'') is null or nullif(trim(p_phone),'') is null then raise exception 'MISSING_REQUIRED_FIELDS'; end if;

  select r.* into v_room
  from public.resources r join public.organizations o on o.id=r.organization_id
  where r.id=p_room_resource_id and r.type='room' and r.active and o.active
  for update of r;
  if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;

  v_group_ref := 'R'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));

  for v_slot in select * from jsonb_array_elements(p_slots)
  loop
    v_index := v_index+1;
    v_start := (v_slot->>'start_time')::time;
    v_end := (v_slot->>'end_time')::time;
    if v_end<=v_start then raise exception 'INVALID_TIME_RANGE'; end if;

    -- Selected time can be a subsection of a configured availability window.
    if not exists (
      select 1 from public.resource_availability a
      where a.resource_id=p_room_resource_id and a.active
        and a.start_time<=v_start and a.end_time>=v_end
        and (
          a.specific_date=p_booking_date
          or (
            a.specific_date is null
            and a.weekday=extract(dow from p_booking_date)::smallint
            and (a.date_from is null or p_booking_date>=a.date_from)
            and (a.date_to is null or p_booking_date<=a.date_to)
          )
        )
    ) then raise exception 'SLOT_NOT_AVAILABLE'; end if;

    if exists (
      select 1 from public.bookings b
      where b.resource_id=p_room_resource_id
        and b.booking_date=p_booking_date
        and b.status in ('approved','completed')
        and b.start_time<v_end and b.end_time>v_start
    ) then raise exception 'ROOM_ALREADY_BOOKED'; end if;

    v_row_ref := v_group_ref||'-'||v_index::text;
    insert into public.bookings(reference_no,user_id,resource_id,booking_date,start_time,end_time,quantity,attendees,purpose,applicant_name,phone,applicant_note,related_booking_id,status,loan_end_date)
    values(v_row_ref,null,p_room_resource_id,p_booking_date,v_start,v_end,1,1,trim(p_purpose),trim(p_applicant_name),trim(p_phone),nullif(trim(coalesce(p_applicant_note,'')),''),null,'pending',null)
    returning id into v_room_booking_id;

    if v_first_room_booking_id is null then v_first_room_booking_id:=v_room_booking_id; end if;
    if v_start<v_min_start then v_min_start:=v_start; end if;
    if v_end>v_max_end then v_max_end:=v_end; end if;
  end loop;

  if p_items is not null and jsonb_typeof(p_items)='array' then
    v_index:=0;
    for v_item_req in select * from jsonb_array_elements(p_items)
    loop
      v_index:=v_index+1;
      v_qty:=greatest(1,coalesce((v_item_req->>'quantity')::integer,1));
      select r.* into v_item
      from public.resources r join public.organizations o on o.id=r.organization_id
      where r.id=(v_item_req->>'resource_id')::uuid
        and r.type='item'
        and r.organization_id=v_room.organization_id
        and r.active and o.active
      for update of r;
      if not found then raise exception 'INVALID_RELATED_ROOM'; end if;

      select coalesce(sum(b.quantity),0)::integer into v_used
      from public.bookings b
      where b.resource_id=v_item.id
        and b.booking_date=p_booking_date
        and b.status in ('approved','completed')
        and b.start_time<v_max_end and b.end_time>v_min_start;
      if v_qty>greatest(v_item.stock_quantity-v_used,0) then raise exception 'ITEM_STOCK_EXCEEDED'; end if;

      insert into public.bookings(reference_no,user_id,resource_id,booking_date,start_time,end_time,quantity,attendees,purpose,applicant_name,phone,applicant_note,related_booking_id,status,loan_end_date)
      values(v_group_ref||'-I'||v_index::text,null,v_item.id,p_booking_date,v_min_start,v_max_end,v_qty,1,trim(p_purpose),trim(p_applicant_name),trim(p_phone),nullif(trim(coalesce(p_applicant_note,'')),''),v_first_room_booking_id,'pending',null);
    end loop;
  end if;
  return v_group_ref;
end;
$$;
revoke all on function public.submit_public_room_request(uuid,date,jsonb,jsonb,text,text,text,text) from public;
grant execute on function public.submit_public_room_request(uuid,date,jsonb,jsonb,text,text,text,text) to anon, authenticated;

-- Admin calendar: one RPC for both creating and editing a booking.
-- For a room booking, p_items contains same-day related item quantities and they
-- are stored as child booking rows linked by related_booking_id.
drop function if exists public.admin_upsert_booking_record(uuid,uuid,date,date,time,time,integer,text,text,text,text,text,jsonb);
create function public.admin_upsert_booking_record(
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
  p_status text,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resource public.resources%rowtype;
  v_existing public.bookings%rowtype;
  v_id uuid;
  v_ref text;
  v_related_id uuid;
  v_item_req jsonb;
  v_item public.resources%rowtype;
  v_qty integer;
  v_used integer;
  v_index integer:=0;
  v_end_date date;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_end_time<=p_start_time then raise exception 'INVALID_TIME_RANGE'; end if;
  if p_quantity<1 then raise exception 'INVALID_QUANTITY'; end if;
  if p_status not in ('pending','approved','rejected','completed','cancelled') then raise exception 'INVALID_STATUS'; end if;
  if nullif(trim(p_applicant_name),'') is null or nullif(trim(p_phone),'') is null or nullif(trim(p_purpose),'') is null then raise exception 'MISSING_REQUIRED_FIELDS'; end if;

  select r.* into v_resource from public.resources r where r.id=p_resource_id for update;
  if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;

  if v_resource.type='room' then
    p_loan_end_date:=null;
    p_quantity:=1;
  else
    p_loan_end_date:=coalesce(p_loan_end_date,p_booking_date);
    if p_loan_end_date<p_booking_date then raise exception 'INVALID_RETURN_DATE'; end if;
  end if;
  v_end_date:=coalesce(p_loan_end_date,p_booking_date);

  if p_booking_id is not null then
    select * into v_existing from public.bookings where id=p_booking_id for update;
    if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
    v_id:=v_existing.id;
    v_ref:=v_existing.reference_no;
    v_related_id:=v_existing.related_booking_id;
  else
    v_id:=gen_random_uuid();
    v_ref:='A'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
    v_related_id:=null;
  end if;

  -- Occupancy/stock guards apply to states that consume capacity.
  if p_status in ('approved','completed') then
    if v_resource.type='room' then
      if exists (
        select 1 from public.bookings b
        where b.resource_id=p_resource_id
          and b.id<>coalesce(p_booking_id,'00000000-0000-0000-0000-000000000000'::uuid)
          and b.booking_date=p_booking_date
          and b.status in ('approved','completed')
          and b.start_time<p_end_time and b.end_time>p_start_time
      ) then raise exception 'ROOM_ALREADY_BOOKED'; end if;
    else
      select coalesce(sum(b.quantity),0)::integer into v_used
      from public.bookings b
      where b.resource_id=p_resource_id
        and b.id<>coalesce(p_booking_id,'00000000-0000-0000-0000-000000000000'::uuid)
        and b.status in ('approved','completed')
        and b.booking_date<=v_end_date
        and coalesce(b.loan_end_date,b.booking_date)>=p_booking_date;
      if p_quantity>greatest(v_resource.stock_quantity-v_used,0) then raise exception 'ITEM_STOCK_EXCEEDED'; end if;
    end if;
  end if;

  if p_booking_id is null then
    insert into public.bookings(id,reference_no,user_id,resource_id,booking_date,loan_end_date,start_time,end_time,quantity,attendees,purpose,applicant_name,phone,applicant_note,related_booking_id,status,reviewed_by,reviewed_at)
    values(v_id,v_ref,null,p_resource_id,p_booking_date,p_loan_end_date,p_start_time,p_end_time,p_quantity,1,trim(p_purpose),trim(p_applicant_name),trim(p_phone),nullif(trim(coalesce(p_applicant_note,'')),''),v_related_id,p_status,auth.uid(),case when p_status<>'pending' then now() else null end);
  else
    update public.bookings
    set resource_id=p_resource_id,booking_date=p_booking_date,loan_end_date=p_loan_end_date,start_time=p_start_time,end_time=p_end_time,quantity=p_quantity,
        purpose=trim(p_purpose),applicant_name=trim(p_applicant_name),phone=trim(p_phone),applicant_note=nullif(trim(coalesce(p_applicant_note,'')),''),status=p_status,
        reviewed_by=auth.uid(),reviewed_at=case when p_status<>'pending' then now() else reviewed_at end,updated_at=now()
    where id=v_id;
  end if;

  -- Room related item rows are synchronized as one reservation group.
  if v_resource.type='room' then
    delete from public.bookings where related_booking_id=v_id;
    if p_items is not null and jsonb_typeof(p_items)='array' then
      for v_item_req in select * from jsonb_array_elements(p_items)
      loop
        v_qty:=greatest(1,coalesce((v_item_req->>'quantity')::integer,1));
        select r.* into v_item
        from public.resources r
        where r.id=(v_item_req->>'resource_id')::uuid
          and r.type='item' and r.active
          and r.organization_id=v_resource.organization_id
        for update;
        if not found then raise exception 'INVALID_RELATED_ROOM'; end if;

        if p_status in ('approved','completed') then
          select coalesce(sum(b.quantity),0)::integer into v_used
          from public.bookings b
          where b.resource_id=v_item.id
            and b.status in ('approved','completed')
            and b.booking_date=p_booking_date
            and b.start_time<p_end_time and b.end_time>p_start_time;
          if v_qty>greatest(v_item.stock_quantity-v_used,0) then raise exception 'ITEM_STOCK_EXCEEDED'; end if;
        end if;

        v_index:=v_index+1;
        insert into public.bookings(reference_no,user_id,resource_id,booking_date,loan_end_date,start_time,end_time,quantity,attendees,purpose,applicant_name,phone,applicant_note,related_booking_id,status,reviewed_by,reviewed_at)
        values(v_ref||'-I'||v_index::text,null,v_item.id,p_booking_date,null,p_start_time,p_end_time,v_qty,1,trim(p_purpose),trim(p_applicant_name),trim(p_phone),nullif(trim(coalesce(p_applicant_note,'')),''),v_id,p_status,auth.uid(),case when p_status<>'pending' then now() else null end);
      end loop;
    end if;
  end if;

  return v_id;
end;
$$;
revoke all on function public.admin_upsert_booking_record(uuid,uuid,date,date,time,time,integer,text,text,text,text,text,jsonb) from public;
grant execute on function public.admin_upsert_booking_record(uuid,uuid,date,date,time,time,integer,text,text,text,text,text,jsonb) to authenticated;

-- Deleting a room reservation also deletes its linked item rows.
create or replace function public.admin_delete_booking_record(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  delete from public.bookings where related_booking_id=p_booking_id;
  delete from public.bookings where id=p_booking_id;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
end;
$$;
revoke all on function public.admin_delete_booking_record(uuid) from public;
grant execute on function public.admin_delete_booking_record(uuid) to authenticated;

-- Keep booking changes live for admin/public availability refreshes.
do $$
begin
  begin
    alter publication supabase_realtime add table public.bookings;
  exception when duplicate_object then null;
  end;
end $$;

-- Review a room reservation and its related item rows as one atomic group.
drop function if exists public.update_booking_group_status(uuid,text,text);
create function public.update_booking_group_status(
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
  v_child record;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  perform public.update_booking_status(p_booking_id,p_status,p_admin_note);
  for v_child in select id from public.bookings where related_booking_id=p_booking_id order by created_at
  loop
    perform public.update_booking_status(v_child.id,p_status,p_admin_note);
  end loop;
end;
$$;
revoke all on function public.update_booking_group_status(uuid,text,text) from public;
grant execute on function public.update_booking_group_status(uuid,text,text) to authenticated;
