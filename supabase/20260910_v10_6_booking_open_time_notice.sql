-- v10.6 Easier booking-window settings + opening time + public next-opening notice
-- All rule calculations use Asia/Hong_Kong time.

alter table public.booking_policy
  add column if not exists open_time time without time zone not null default '12:00:00';

-- Check whether a requested date has reached its server-side opening time.
create or replace function private.booking_date_is_open(p_target date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.booking_policy%rowtype;
  v_now timestamp without time zone := (now() at time zone 'Asia/Hong_Kong');
  v_today date := (now() at time zone 'Asia/Hong_Kong')::date;
  v_trigger timestamp without time zone;
  v_latest_trigger timestamp without time zone;
  v_period_start date;
  v_period_end date;
  v_open_at timestamp without time zone;
begin
  if p_target is null or p_target < v_today then return false; end if;
  select * into s from public.booking_policy where singleton=true;
  if not found or not s.active then return true; end if;

  if s.mode='fixed_month_day' then
    -- Latest monthly release. Example: Sep 20 12:00 opens Oct 1-31.
    v_trigger := make_timestamp(
      extract(year from v_now)::int,
      extract(month from v_now)::int,
      s.fixed_day,
      extract(hour from s.open_time)::int,
      extract(minute from s.open_time)::int,
      0
    );
    if v_now < v_trigger then
      v_trigger := v_trigger - interval '1 month';
    end if;
    v_latest_trigger := v_trigger;

    if s.scope='month' then
      v_period_start := date_trunc('month', v_latest_trigger + interval '1 month')::date;
      v_period_end := (v_period_start + interval '1 month - 1 day')::date;
    elsif s.scope='quarter' then
      -- Fixed monthly release + quarter means the next three calendar months.
      v_period_start := date_trunc('month', v_latest_trigger + interval '1 month')::date;
      v_period_end := (v_period_start + interval '3 months - 1 day')::date;
    else
      -- Fixed monthly release + week means the seven days immediately after release day.
      v_period_start := v_latest_trigger::date + 1;
      v_period_end := v_period_start + 6;
    end if;
    return p_target between v_period_start and v_period_end;
  end if;

  -- "N days before period" mode. The exact opening time is also enforced.
  if s.scope='week' then
    v_period_start := date_trunc('week',p_target::timestamp)::date;
  elsif s.scope='month' then
    v_period_start := date_trunc('month',p_target::timestamp)::date;
  else
    v_period_start := date_trunc('quarter',p_target::timestamp)::date;
  end if;
  v_open_at := (v_period_start - s.days_before)::timestamp + s.open_time;
  return v_now >= v_open_at;
end;
$$;
revoke all on function private.booking_date_is_open(date) from public, anon, authenticated;

-- Public-safe policy information, including the NEXT release time and its date range.
create or replace function public.get_booking_policy()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.booking_policy%rowtype;
  v_now timestamp without time zone := (now() at time zone 'Asia/Hong_Kong');
  v_next_open timestamp without time zone;
  v_period_start date;
  v_period_end date;
  v_candidate timestamp without time zone;
  v_anchor date;
begin
  select * into s from public.booking_policy where singleton=true;
  if not found then return '{}'::jsonb; end if;

  if s.active then
    if s.mode='fixed_month_day' then
      v_candidate := make_timestamp(
        extract(year from v_now)::int,
        extract(month from v_now)::int,
        s.fixed_day,
        extract(hour from s.open_time)::int,
        extract(minute from s.open_time)::int,
        0
      );
      if v_candidate <= v_now then v_candidate := v_candidate + interval '1 month'; end if;
      v_next_open := v_candidate;
      if s.scope='month' then
        v_period_start := date_trunc('month',v_next_open + interval '1 month')::date;
        v_period_end := (v_period_start + interval '1 month - 1 day')::date;
      elsif s.scope='quarter' then
        v_period_start := date_trunc('month',v_next_open + interval '1 month')::date;
        v_period_end := (v_period_start + interval '3 months - 1 day')::date;
      else
        v_period_start := v_next_open::date + 1;
        v_period_end := v_period_start + 6;
      end if;
    else
      if s.scope='week' then
        v_anchor := (date_trunc('week',v_now)::date + 7);
        v_candidate := (v_anchor - s.days_before)::timestamp + s.open_time;
        while v_candidate <= v_now loop
          v_anchor := v_anchor + 7;
          v_candidate := (v_anchor - s.days_before)::timestamp + s.open_time;
        end loop;
        v_period_start := v_anchor;
        v_period_end := v_anchor + 6;
      elsif s.scope='quarter' then
        v_anchor := (date_trunc('quarter',v_now)::date + interval '3 months')::date;
        v_candidate := (v_anchor - s.days_before)::timestamp + s.open_time;
        while v_candidate <= v_now loop
          v_anchor := (v_anchor + interval '3 months')::date;
          v_candidate := (v_anchor - s.days_before)::timestamp + s.open_time;
        end loop;
        v_period_start := v_anchor;
        v_period_end := (v_anchor + interval '3 months - 1 day')::date;
      else
        v_anchor := (date_trunc('month',v_now)::date + interval '1 month')::date;
        v_candidate := (v_anchor - s.days_before)::timestamp + s.open_time;
        while v_candidate <= v_now loop
          v_anchor := (v_anchor + interval '1 month')::date;
          v_candidate := (v_anchor - s.days_before)::timestamp + s.open_time;
        end loop;
        v_period_start := v_anchor;
        v_period_end := (v_anchor + interval '1 month - 1 day')::date;
      end if;
      v_next_open := v_candidate;
    end if;
  end if;

  return jsonb_build_object(
    'active',s.active,
    'mode',s.mode,
    'scope',s.scope,
    'fixed_day',s.fixed_day,
    'days_before',s.days_before,
    'open_time',to_char(s.open_time,'HH24:MI'),
    'now_hk',to_char(v_now,'YYYY-MM-DD"T"HH24:MI:SS') || '+08:00',
    'next_open_at',case when v_next_open is null then null else to_char(v_next_open,'YYYY-MM-DD"T"HH24:MI:SS') || '+08:00' end,
    'next_period_start',v_period_start,
    'next_period_end',v_period_end
  );
end;
$$;
revoke all on function public.get_booking_policy() from public;
grant execute on function public.get_booking_policy() to anon, authenticated;
