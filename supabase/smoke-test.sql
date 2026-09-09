-- Read-only smoke checks after running schema.sql.
select 'profiles' as table_name, count(*) from public.profiles
union all select 'organizations', count(*) from public.organizations
union all select 'resources', count(*) from public.resources
union all select 'resource_availability', count(*) from public.resource_availability
union all select 'bookings', count(*) from public.bookings;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename in ('profiles','organizations','resources','resource_availability','bookings')
order by tablename;

select policyname, tablename, cmd
from pg_policies
where schemaname='public'
  and tablename in ('profiles','organizations','resources','resource_availability','bookings')
order by tablename, policyname;
