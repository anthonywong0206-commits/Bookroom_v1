-- ============================================================
-- v5: item borrowing rules, 3-day loan flow, purpose options,
-- resource images and applicant notes.
-- Run after schema.sql + previous sync/admin migrations.
-- ============================================================

alter table public.resources add column if not exists image_url text;
alter table public.bookings add column if not exists applicant_note text;

create table if not exists public.purpose_options (
  id uuid primary key default gen_random_uuid(),
  label text not null unique check (char_length(trim(label)) > 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists purpose_options_set_updated_at on public.purpose_options;
create trigger purpose_options_set_updated_at before update on public.purpose_options
for each row execute function private.set_updated_at();

insert into public.purpose_options(label,sort_order,active)
values ('個案',1,true),('小組',2,true),('外出活動',3,true)
on conflict (label) do nothing;

alter table public.purpose_options enable row level security;

drop policy if exists purpose_options_public_select on public.purpose_options;
create policy purpose_options_public_select on public.purpose_options
for select to anon, authenticated
using (active or private.is_admin());

drop policy if exists purpose_options_admin_insert on public.purpose_options;
create policy purpose_options_admin_insert on public.purpose_options
for insert to authenticated with check (private.is_admin());

drop policy if exists purpose_options_admin_update on public.purpose_options;
create policy purpose_options_admin_update on public.purpose_options
for update to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists purpose_options_admin_delete on public.purpose_options;
create policy purpose_options_admin_delete on public.purpose_options
for delete to authenticated using (private.is_admin());

grant select on public.purpose_options to anon, authenticated;
grant insert, update, delete on public.purpose_options to authenticated;

-- Public bucket for resource photos. Write access remains admin-only.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('resource-images','resource-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists resource_images_admin_insert on storage.objects;
create policy resource_images_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id='resource-images' and private.is_admin());

drop policy if exists resource_images_admin_update on storage.objects;
create policy resource_images_admin_update on storage.objects
for update to authenticated
using (bucket_id='resource-images' and private.is_admin())
with check (bucket_id='resource-images' and private.is_admin());

drop policy if exists resource_images_admin_delete on storage.objects;
create policy resource_images_admin_delete on storage.objects
for delete to authenticated
using (bucket_id='resource-images' and private.is_admin());

-- Public availability feed: only resource/date/quantity, never applicant data.
drop function if exists public.get_public_resource_bookings();
create function public.get_public_resource_bookings()
returns table (
  resource_id uuid,
  resource_name text,
  resource_type text,
  booking_date date,
  loan_end_date date,
  status text,
  quantity integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.name,
    r.type,
    b.booking_date,
    coalesce(b.loan_end_date,b.booking_date),
    b.status,
    sum(b.quantity)::integer
  from public.bookings b
  join public.resources r on r.id=b.resource_id
  join public.organizations o on o.id=r.organization_id
  where b.status in ('approved','completed')
    and r.active and o.active
  group by r.id,r.name,r.type,b.booking_date,coalesce(b.loan_end_date,b.booking_date),b.status
  order by b.booking_date,r.name;
$$;
revoke all on function public.get_public_resource_bookings() from public;
grant execute on function public.get_public_resource_bookings() to anon, authenticated;

-- Room request. ALL active items in the same organization may be added to a
-- room request. requires_room=true only prevents standalone borrowing.
drop function if exists public.submit_public_room_request(uuid,date,jsonb,jsonb,text,text,text);
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

    if not exists (
      select 1 from public.resource_availability a
      where a.resource_id=p_room_resource_id and a.active
        and a.start_time=v_start and a.end_time=v_end
        and (a.specific_date=p_booking_date or (a.specific_date is null and a.weekday=extract(dow from p_booking_date)::smallint and (a.date_from is null or p_booking_date>=a.date_from) and (a.date_to is null or p_booking_date<=a.date_to)))
    ) then raise exception 'SLOT_NOT_AVAILABLE'; end if;

    if exists (
      select 1 from public.bookings b where b.resource_id=p_room_resource_id and b.booking_date=p_booking_date and b.status='approved' and b.start_time<v_end and b.end_time>v_start
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
      where b.resource_id=v_item.id and b.booking_date=p_booking_date and b.status='approved'
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

-- Standalone item loan: only items with requires_room=false.
drop function if exists public.submit_public_loan_request(date,date,jsonb,text,text,text);
drop function if exists public.submit_public_loan_request(date,date,jsonb,text,text,text,text);
create function public.submit_public_loan_request(
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
declare
  v_item_req jsonb;
  v_item public.resources%rowtype;
  v_group_ref text;
  v_index integer:=0;
  v_qty integer;
  v_used integer;
  v_weekday smallint;
begin
  if p_start_date<current_date then raise exception 'PAST_DATE_NOT_ALLOWED'; end if;
  if p_return_date<p_start_date then raise exception 'INVALID_RETURN_DATE'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'INVALID_QUANTITY'; end if;
  if nullif(trim(p_purpose),'') is null or nullif(trim(p_applicant_name),'') is null or nullif(trim(p_phone),'') is null then raise exception 'MISSING_REQUIRED_FIELDS'; end if;

  v_group_ref := 'B'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
  v_weekday := extract(dow from p_start_date)::smallint;

  for v_item_req in select * from jsonb_array_elements(p_items)
  loop
    v_index:=v_index+1;
    v_qty:=greatest(1,coalesce((v_item_req->>'quantity')::integer,1));
    select r.* into v_item
    from public.resources r join public.organizations o on o.id=r.organization_id
    where r.id=(v_item_req->>'resource_id')::uuid and r.type='item' and not r.requires_room and r.active and o.active
    for update of r;
    if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;

    if exists(select 1 from public.resource_availability a where a.resource_id=v_item.id and a.active)
       and not exists(
         select 1 from public.resource_availability a
         where a.resource_id=v_item.id and a.active
           and (a.specific_date=p_start_date or (a.specific_date is null and a.weekday=v_weekday and (a.date_from is null or p_start_date>=a.date_from) and (a.date_to is null or p_start_date<=a.date_to)))
       ) then raise exception 'SLOT_NOT_AVAILABLE'; end if;

    select coalesce(sum(b.quantity),0)::integer into v_used
    from public.bookings b
    where b.resource_id=v_item.id and b.status='approved'
      and b.booking_date<=p_return_date and coalesce(b.loan_end_date,b.booking_date)>=p_start_date;
    if v_qty>greatest(v_item.stock_quantity-v_used,0) then raise exception 'ITEM_STOCK_EXCEEDED'; end if;

    insert into public.bookings(reference_no,user_id,resource_id,booking_date,loan_end_date,start_time,end_time,quantity,attendees,purpose,applicant_name,phone,applicant_note,related_booking_id,status)
    values(v_group_ref||'-'||v_index::text,null,v_item.id,p_start_date,p_return_date,'09:00','18:00',v_qty,1,trim(p_purpose),trim(p_applicant_name),trim(p_phone),nullif(trim(coalesce(p_applicant_note,'')),''),null,'pending');
  end loop;
  return v_group_ref;
end;
$$;
revoke all on function public.submit_public_loan_request(date,date,jsonb,text,text,text,text) from public;
grant execute on function public.submit_public_loan_request(date,date,jsonb,text,text,text,text) to anon, authenticated;

-- Realtime publication, safe if already present.
do $$
begin
  begin alter publication supabase_realtime add table public.purpose_options; exception when duplicate_object then null; end;
end $$;
