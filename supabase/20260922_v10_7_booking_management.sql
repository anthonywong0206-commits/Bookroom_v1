-- v10.7 Booking management redesign
-- Adds per-date hourly overrides for rooms/items and exposes them through the scoped organization portal RPC.

create table if not exists public.resource_time_overrides (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  override_date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  is_available boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resource_time_overrides_valid_time check (end_time > start_time),
  constraint resource_time_overrides_unique unique(resource_id,override_date,start_time,end_time)
);
create index if not exists idx_resource_time_overrides_lookup
  on public.resource_time_overrides(resource_id,override_date,start_time,end_time);

alter table public.resource_time_overrides enable row level security;
revoke all on table public.resource_time_overrides from public, anon;
grant select,insert,update,delete on table public.resource_time_overrides to authenticated;

drop policy if exists resource_time_overrides_admin_select on public.resource_time_overrides;
create policy resource_time_overrides_admin_select on public.resource_time_overrides
for select to authenticated using (private.is_admin());
drop policy if exists resource_time_overrides_admin_insert on public.resource_time_overrides;
create policy resource_time_overrides_admin_insert on public.resource_time_overrides
for insert to authenticated with check (private.is_admin());
drop policy if exists resource_time_overrides_admin_update on public.resource_time_overrides;
create policy resource_time_overrides_admin_update on public.resource_time_overrides
for update to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists resource_time_overrides_admin_delete on public.resource_time_overrides;
create policy resource_time_overrides_admin_delete on public.resource_time_overrides
for delete to authenticated using (private.is_admin());

create or replace function public.admin_set_resource_time_override(
  p_resource_id uuid,
  p_override_date date,
  p_start_time time,
  p_end_time time,
  p_is_available boolean
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_resource_id is null or p_override_date is null or p_start_time is null or p_end_time is null or p_end_time<=p_start_time then
    raise exception 'INVALID_TIME_RANGE';
  end if;
  if not exists(select 1 from public.resources r where r.id=p_resource_id) then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if not p_is_available and exists(
    select 1 from public.bookings b
    where b.resource_id=p_resource_id
      and p_override_date between b.booking_date and coalesce(b.loan_end_date,b.booking_date)
      and b.status in ('approved','completed')
      and coalesce(b.start_time,'00:00'::time)<p_end_time
      and coalesce(b.end_time,'23:59'::time)>p_start_time
  ) then raise exception 'TIME_HAS_BOOKING'; end if;

  insert into public.resource_time_overrides(resource_id,override_date,start_time,end_time,is_available,note,updated_at)
  values(p_resource_id,p_override_date,p_start_time,p_end_time,p_is_available,
         case when p_is_available then '管理員設為可借用' else '管理員設為不可借用' end,now())
  on conflict(resource_id,override_date,start_time,end_time)
  do update set is_available=excluded.is_available,note=excluded.note,updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_set_resource_time_override(uuid,date,time,time,boolean) from public,anon;
grant execute on function public.admin_set_resource_time_override(uuid,date,time,time,boolean) to authenticated;

-- Block public submissions that overlap an explicit unavailable override.
create or replace function private.enforce_resource_time_override()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_day date; v_start time; v_end time;
begin
  if private.is_admin() then return new; end if;
  if new.status not in ('pending','approved','completed') then return new; end if;
  v_start:=coalesce(new.start_time,'00:00'::time);
  v_end:=coalesce(new.end_time,'23:59'::time);
  v_day:=new.booking_date;
  while v_day<=coalesce(new.loan_end_date,new.booking_date) loop
    if exists(
      select 1 from public.resource_time_overrides o
      where o.resource_id=new.resource_id and o.override_date=v_day and not o.is_available
        and o.start_time<v_end and o.end_time>v_start
    ) then raise exception 'RESOURCE_TIME_BLOCKED'; end if;
    v_day:=v_day+1;
  end loop;
  return new;
end;
$$;
revoke all on function private.enforce_resource_time_override() from public,anon,authenticated;

drop trigger if exists trg_enforce_resource_time_override on public.bookings;
create trigger trg_enforce_resource_time_override
before insert or update of resource_id,booking_date,loan_end_date,start_time,end_time,status on public.bookings
for each row execute function private.enforce_resource_time_override();

-- Scoped portal data now includes hourly overrides without exposing the table directly to anon.
create or replace function public.get_organization_portal_data(p_organization_id uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_result jsonb;
begin
  perform private.assert_organization_portal_password(p_organization_id,p_password);
  select jsonb_build_object(
    'organization',jsonb_build_object('id',o.id,'name',o.name),
    'resources',coalesce((select jsonb_agg(to_jsonb(r) order by r.type,r.name) from public.resources r where r.organization_id=o.id and r.active),'[]'::jsonb),
    'availability',coalesce((select jsonb_agg(to_jsonb(a) order by a.resource_id,a.specific_date nulls last,a.weekday,a.start_time) from public.resource_availability a join public.resources r on r.id=a.resource_id where r.organization_id=o.id and r.active and a.active),'[]'::jsonb),
    'time_overrides',coalesce((select jsonb_agg(jsonb_build_object('resource_id',t.resource_id,'override_date',t.override_date,'start_time',t.start_time,'end_time',t.end_time,'is_available',t.is_available,'created_at',t.created_at) order by t.override_date,t.start_time) from public.resource_time_overrides t join public.resources r on r.id=t.resource_id where r.organization_id=o.id and r.active),'[]'::jsonb),
    'resource_blocks',coalesce((select jsonb_agg(jsonb_build_object('resource_id',b.resource_id,'block_date',b.block_date) order by b.block_date) from public.resource_blocks b join public.resources r on r.id=b.resource_id where r.organization_id=o.id and r.active),'[]'::jsonb),
    'purpose_options',coalesce((select jsonb_agg(to_jsonb(p) order by p.sort_order,p.label) from public.purpose_options p where p.active),'[]'::jsonb),
    'public_bookings',coalesce((select jsonb_agg(jsonb_build_object('resource_id',r.id,'resource_name',r.name,'resource_type',r.type,'booking_date',b.booking_date,'loan_end_date',coalesce(b.loan_end_date,b.booking_date),'status',b.status,'quantity',b.quantity) order by b.booking_date,r.name) from public.bookings b join public.resources r on r.id=b.resource_id where r.organization_id=o.id and r.active and b.status in ('approved','completed')),'[]'::jsonb),
    'busy_periods',coalesce((select jsonb_agg(jsonb_build_object('resource_id',r.id,'booking_date',b.booking_date,'loan_end_date',coalesce(b.loan_end_date,b.booking_date),'start_time',b.start_time,'end_time',b.end_time,'quantity',b.quantity) order by b.booking_date,b.start_time) from public.bookings b join public.resources r on r.id=b.resource_id where r.organization_id=o.id and r.active and b.status in ('approved','completed')),'[]'::jsonb)
  ) into v_result from public.organizations o where o.id=p_organization_id and o.active;
  if v_result is null then raise exception 'ORGANIZATION_NOT_AVAILABLE'; end if;
  return v_result;
end;
$$;
revoke all on function public.get_organization_portal_data(uuid,text) from public;
grant execute on function public.get_organization_portal_data(uuid,text) to anon,authenticated;

-- Realtime publication is useful for authenticated admin pages; anon front-end still uses scoped RPC/polling.
do $$ begin
  if not exists(
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='resource_time_overrides'
  ) then alter publication supabase_realtime add table public.resource_time_overrides; end if;
exception when undefined_object then null; end $$;
