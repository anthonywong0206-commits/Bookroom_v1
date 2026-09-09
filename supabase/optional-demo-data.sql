-- Optional starter data. Run AFTER schema.sql and after creating/promoting an admin.
-- This creates one organization, two rooms, three items, and Mon-Sat hourly slots.

do $$
declare
  v_org uuid;
  v_resource uuid;
  v_name text;
  v_type text;
  v_amount integer;
  v_dow integer;
  v_hour integer;
begin
  insert into public.organizations (name, active)
  values ('市民活動中心', true)
  on conflict (name) do update set active = excluded.active
  returning id into v_org;

  for v_name, v_type, v_amount in
    select * from (values
      ('會議室 A','room',20),
      ('多功能活動室','room',50),
      ('投影機','item',5),
      ('無線麥克風','item',10),
      ('活動桌','item',20)
    ) x(name,type,amount)
  loop
    insert into public.resources (
      organization_id,type,name,capacity,stock_quantity,active,requires_room
    ) values (
      v_org,v_type,v_name,
      case when v_type='room' then v_amount else 1 end,
      case when v_type='item' then v_amount else 1 end,
      true,false
    )
    on conflict (organization_id,type,name) do update
    set active=true,
        capacity=excluded.capacity,
        stock_quantity=excluded.stock_quantity
    returning id into v_resource;

    for v_dow in 1..6 loop
      for v_hour in 9..16 loop
        if v_hour <> 12 and not exists (
          select 1 from public.resource_availability a
          where a.resource_id=v_resource
            and a.weekday=v_dow
            and a.specific_date is null
            and a.start_time=make_time(v_hour,0,0)
            and a.end_time=make_time(v_hour+1,0,0)
        ) then
          insert into public.resource_availability(resource_id,weekday,start_time,end_time,active)
          values(v_resource,v_dow,make_time(v_hour,0,0),make_time(v_hour+1,0,0),true);
        end if;
      end loop;
    end loop;
  end loop;
end $$;
