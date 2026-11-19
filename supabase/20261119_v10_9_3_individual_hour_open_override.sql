create or replace function private.resource_hour_is_open(
  p_resource_id uuid,
  p_date date,
  p_start time,
  p_end time
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_override boolean;
begin
  if p_resource_id is null or p_date is null or p_start is null or p_end is null or p_end<=p_start then return false; end if;
  if exists(select 1 from public.resource_blocks b where b.resource_id=p_resource_id and b.block_date=p_date) then return false; end if;
  select o.is_available into v_override
  from public.resource_time_overrides o
  where o.resource_id=p_resource_id and o.override_date=p_date and o.start_time<p_end and o.end_time>p_start
  order by o.updated_at desc,o.created_at desc limit 1;
  if found then return coalesce(v_override,false); end if;
  return exists(
    select 1 from public.resource_availability a
    where a.resource_id=p_resource_id and a.active and a.start_time<=p_start and a.end_time>=p_end
      and (a.specific_date=p_date or (a.specific_date is null and a.weekday=extract(dow from p_date)::smallint
        and (a.date_from is null or p_date>=a.date_from) and (a.date_to is null or p_date<=a.date_to)))
  );
end;
$$;
revoke all on function private.resource_hour_is_open(uuid,date,time,time) from public,anon,authenticated;

create or replace function public.submit_public_room_request(
  p_room_resource_id uuid,
  p_booking_date date,
  p_slots jsonb,
  p_items jsonb,
  p_purpose text,
  p_applicant_name text,
  p_phone text,
  p_applicant_note text default null::text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.resources%rowtype; v_slot jsonb; v_item_req jsonb; v_item public.resources%rowtype;
  v_start time; v_end time; v_min_start time := '23:59'; v_max_end time := '00:00';
  v_group_ref text; v_row_ref text; v_room_booking_id uuid; v_first_room_booking_id uuid;
  v_index integer := 0; v_qty integer; v_used integer;
begin
  if p_booking_date < current_date then raise exception 'PAST_DATE_NOT_ALLOWED'; end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots)=0 then raise exception 'SLOT_NOT_AVAILABLE'; end if;
  if nullif(trim(p_purpose),'') is null or nullif(trim(p_applicant_name),'') is null or nullif(trim(p_phone),'') is null then raise exception 'MISSING_REQUIRED_FIELDS'; end if;

  select r.* into v_room from public.resources r join public.organizations o on o.id=r.organization_id
  where r.id=p_room_resource_id and r.type='room' and r.active and o.active for update of r;
  if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;
  v_group_ref := 'R'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    v_index := v_index+1; v_start := (v_slot->>'start_time')::time; v_end := (v_slot->>'end_time')::time;
    if v_end<=v_start then raise exception 'INVALID_TIME_RANGE'; end if;
    if not private.resource_hour_is_open(p_room_resource_id,p_booking_date,v_start,v_end) then raise exception 'SLOT_NOT_AVAILABLE'; end if;
    if exists (
      select 1 from public.bookings b where b.resource_id=p_room_resource_id and b.booking_date=p_booking_date
        and b.status in ('approved','completed') and b.start_time<v_end and b.end_time>v_start
    ) then raise exception 'ROOM_ALREADY_BOOKED'; end if;

    v_row_ref := v_group_ref||'-'||v_index::text;
    insert into public.bookings(reference_no,user_id,resource_id,booking_date,start_time,end_time,quantity,attendees,purpose,applicant_name,phone,applicant_note,related_booking_id,status,loan_end_date)
    values(v_row_ref,null,p_room_resource_id,p_booking_date,v_start,v_end,1,1,trim(p_purpose),trim(p_applicant_name),trim(p_phone),nullif(trim(coalesce(p_applicant_note,'')),''),null,'pending',null)
    returning id into v_room_booking_id;
    if v_first_room_booking_id is null then v_first_room_booking_id:=v_room_booking_id; end if;
    if v_start<v_min_start then v_min_start:=v_start; end if; if v_end>v_max_end then v_max_end:=v_end; end if;
  end loop;

  if p_items is not null and jsonb_typeof(p_items)='array' then
    v_index:=0;
    for v_item_req in select * from jsonb_array_elements(p_items) loop
      v_index:=v_index+1; v_qty:=greatest(1,coalesce((v_item_req->>'quantity')::integer,1));
      select r.* into v_item from public.resources r join public.organizations o on o.id=r.organization_id
      where r.id=(v_item_req->>'resource_id')::uuid and r.type='item' and r.organization_id=v_room.organization_id and r.active and o.active for update of r;
      if not found then raise exception 'INVALID_RELATED_ROOM'; end if;
      select coalesce(sum(b.quantity),0)::integer into v_used from public.bookings b
      where b.resource_id=v_item.id and b.booking_date=p_booking_date and b.status in ('approved','completed') and b.start_time<v_max_end and b.end_time>v_min_start;
      if v_qty>greatest(v_item.stock_quantity-v_used,0) then raise exception 'ITEM_STOCK_EXCEEDED'; end if;
      insert into public.bookings(reference_no,user_id,resource_id,booking_date,start_time,end_time,quantity,attendees,purpose,applicant_name,phone,applicant_note,related_booking_id,status,loan_end_date)
      values(v_group_ref||'-I'||v_index::text,null,v_item.id,p_booking_date,v_min_start,v_max_end,v_qty,1,trim(p_purpose),trim(p_applicant_name),trim(p_phone),nullif(trim(coalesce(p_applicant_note,'')),''),v_first_room_booking_id,'pending',null);
    end loop;
  end if;
  return v_group_ref;
end;
$$;
