-- v10.9 room day status controls
-- Whole-day unavailable may coexist with existing approved/completed bookings.
-- Existing bookings are preserved; the block only prevents new applications.

create or replace function private.enforce_block_empty_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;

revoke all on function private.enforce_block_empty_date() from public, anon, authenticated;

create or replace function public.admin_set_resource_day_status(
  p_resource_id uuid,
  p_date date,
  p_is_available boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_weekday smallint;
begin
  if not private.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_resource_id is null or p_date is null then
    raise exception 'INVALID_DATE';
  end if;
  if not exists(select 1 from public.resources r where r.id=p_resource_id) then
    raise exception 'RESOURCE_NOT_FOUND';
  end if;

  -- Whole-day action resets prior per-hour overrides for the same date.
  delete from public.resource_time_overrides
  where resource_id=p_resource_id and override_date=p_date;

  if p_is_available then
    delete from public.resource_blocks
    where resource_id=p_resource_id and block_date=p_date;

    v_weekday := extract(dow from p_date)::smallint;
    if not exists(
      select 1
      from public.resource_availability a
      where a.resource_id=p_resource_id
        and a.active
        and (
          a.specific_date=p_date
          or (
            a.specific_date is null
            and a.weekday=v_weekday
            and (a.date_from is null or p_date>=a.date_from)
            and (a.date_to is null or p_date<=a.date_to)
          )
        )
    ) then
      insert into public.resource_availability(
        resource_id,specific_date,weekday,date_from,date_to,start_time,end_time,active
      ) values (
        p_resource_id,p_date,null,null,null,'09:00','18:00',true
      );
    end if;
  else
    insert into public.resource_blocks(resource_id,block_date,note,created_by)
    values(p_resource_id,p_date,'管理員整日設為不可借用',auth.uid())
    on conflict(resource_id,block_date)
    do update set note=excluded.note,created_by=excluded.created_by;
  end if;

  return true;
end;
$$;

revoke all on function public.admin_set_resource_day_status(uuid,date,boolean) from public, anon;
grant execute on function public.admin_set_resource_day_status(uuid,date,boolean) to authenticated;
