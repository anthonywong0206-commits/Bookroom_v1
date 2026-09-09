-- v10.4 Telegram notifications
-- Stores Telegram credentials in Supabase Vault and exposes admin-only RPCs.
-- A deferred constraint trigger runs at transaction end so grouped room/item
-- applications are complete before the Telegram message is assembled.

create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;
create schema if not exists private;

create table if not exists private.telegram_notification_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into private.telegram_notification_settings(id,enabled)
values(1,false)
on conflict (id) do nothing;

create or replace function private.upsert_vault_secret(
  p_name text,
  p_value text,
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select d.id into v_id
  from vault.decrypted_secrets d
  where d.name = p_name
  order by d.created_at desc
  limit 1;

  if v_id is null then
    v_id := vault.create_secret(p_value,p_name,p_description,null);
  else
    perform vault.update_secret(v_id,p_value,p_name,p_description,null);
  end if;
  return v_id;
end;
$$;

revoke all on function private.upsert_vault_secret(text,text,text) from public, anon, authenticated;

create or replace function public.admin_get_telegram_settings()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean := false;
  v_chat_id text;
  v_token text;
  v_updated_at timestamptz;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select s.enabled,s.updated_at into v_enabled,v_updated_at
  from private.telegram_notification_settings s
  where s.id=1;

  select d.decrypted_secret into v_token
  from vault.decrypted_secrets d
  where d.name='rrbs_telegram_bot_token'
  order by d.created_at desc limit 1;

  select d.decrypted_secret into v_chat_id
  from vault.decrypted_secrets d
  where d.name='rrbs_telegram_chat_id'
  order by d.created_at desc limit 1;

  return jsonb_build_object(
    'enabled',coalesce(v_enabled,false),
    'bot_token_configured',v_token is not null and length(v_token)>0,
    'chat_id',coalesce(v_chat_id,''),
    'updated_at',v_updated_at
  );
end;
$$;

create or replace function public.admin_set_telegram_settings(
  p_bot_token text default null,
  p_chat_id text default null,
  p_enabled boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_chat text;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  if nullif(trim(coalesce(p_bot_token,'')),'') is not null then
    v_token := trim(p_bot_token);
    if v_token !~ '^[0-9]+:[A-Za-z0-9_-]{20,}$' then
      raise exception 'INVALID_TELEGRAM_BOT_TOKEN';
    end if;
    perform private.upsert_vault_secret('rrbs_telegram_bot_token',v_token,'RRBS Telegram Bot Token');
  end if;

  if nullif(trim(coalesce(p_chat_id,'')),'') is not null then
    v_chat := trim(p_chat_id);
    if v_chat !~ '^-?[0-9]+$' then raise exception 'INVALID_TELEGRAM_CHAT_ID'; end if;
    perform private.upsert_vault_secret('rrbs_telegram_chat_id',v_chat,'RRBS Telegram Chat ID');
  end if;

  if p_enabled then
    if not exists(
      select 1 from vault.decrypted_secrets d
      where d.name='rrbs_telegram_bot_token' and nullif(d.decrypted_secret,'') is not null
    ) or not exists(
      select 1 from vault.decrypted_secrets d
      where d.name='rrbs_telegram_chat_id' and nullif(d.decrypted_secret,'') is not null
    ) then
      raise exception 'TELEGRAM_CONFIG_INCOMPLETE';
    end if;
  end if;

  update private.telegram_notification_settings
  set enabled=coalesce(p_enabled,false),updated_by=auth.uid(),updated_at=now()
  where id=1;

  return public.admin_get_telegram_settings();
end;
$$;

create or replace function public.admin_test_telegram_notification()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_chat_id text;
  v_request_id bigint;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select d.decrypted_secret into v_token
  from vault.decrypted_secrets d
  where d.name='rrbs_telegram_bot_token'
  order by d.created_at desc limit 1;

  select d.decrypted_secret into v_chat_id
  from vault.decrypted_secrets d
  where d.name='rrbs_telegram_chat_id'
  order by d.created_at desc limit 1;

  if nullif(v_token,'') is null or nullif(v_chat_id,'') is null then
    raise exception 'TELEGRAM_CONFIG_INCOMPLETE';
  end if;

  select net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body := jsonb_build_object(
      'chat_id',v_chat_id,
      'text','✅ 房間及物品預約系統 Telegram 通知測試成功。' || E'\n' ||
             '時間：' || to_char(clock_timestamp() at time zone 'Asia/Hong_Kong','YYYY-MM-DD HH24:MI'),
      'disable_web_page_preview',true
    ),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 8000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.admin_get_telegram_settings() from public, anon;
revoke all on function public.admin_set_telegram_settings(text,text,boolean) from public, anon;
revoke all on function public.admin_test_telegram_notification() from public, anon;
grant execute on function public.admin_get_telegram_settings() to authenticated;
grant execute on function public.admin_set_telegram_settings(text,text,boolean) to authenticated;
grant execute on function public.admin_test_telegram_notification() to authenticated;

create or replace function private.queue_telegram_application_notification(p_group_ref text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean := false;
  v_token text;
  v_chat_id text;
  v_org_name text;
  v_applicant_name text;
  v_phone text;
  v_purpose text;
  v_note text;
  v_created_at timestamptz;
  v_type text;
  v_lines text;
  v_message text;
  v_request_id bigint;
begin
  select s.enabled into v_enabled
  from private.telegram_notification_settings s
  where s.id=1;
  if not coalesce(v_enabled,false) then return null; end if;

  select d.decrypted_secret into v_token
  from vault.decrypted_secrets d
  where d.name='rrbs_telegram_bot_token'
  order by d.created_at desc limit 1;

  select d.decrypted_secret into v_chat_id
  from vault.decrypted_secrets d
  where d.name='rrbs_telegram_chat_id'
  order by d.created_at desc limit 1;

  if nullif(v_token,'') is null or nullif(v_chat_id,'') is null then return null; end if;

  select o.name,b.applicant_name,b.phone,b.purpose,b.applicant_note,
         min(b.created_at),
         case when bool_or(r.type='room') then '房間預約' else '物品外借' end
  into v_org_name,v_applicant_name,v_phone,v_purpose,v_note,v_created_at,v_type
  from public.bookings b
  join public.resources r on r.id=b.resource_id
  join public.organizations o on o.id=r.organization_id
  where b.reference_no like p_group_ref || '-%'
  group by o.name,b.applicant_name,b.phone,b.purpose,b.applicant_note
  order by min(b.created_at)
  limit 1;

  if v_org_name is null then return null; end if;

  select string_agg(
    case
      when r.type='room' then
        '🏠 ' || r.name || '｜' || to_char(b.booking_date,'YYYY-MM-DD') || '｜' ||
        to_char(b.start_time,'HH24:MI') || '–' || to_char(b.end_time,'HH24:MI')
      when coalesce(b.loan_end_date,b.booking_date)>b.booking_date then
        '📦 ' || r.name || ' × ' || b.quantity::text || '｜' ||
        to_char(b.booking_date,'YYYY-MM-DD') || ' 至 ' || to_char(coalesce(b.loan_end_date,b.booking_date),'YYYY-MM-DD')
      else
        '📦 ' || r.name || ' × ' || b.quantity::text || '｜' || to_char(b.booking_date,'YYYY-MM-DD') || '｜' ||
        to_char(b.start_time,'HH24:MI') || '–' || to_char(b.end_time,'HH24:MI')
    end,
    E'\n' order by case when r.type='room' then 0 else 1 end,b.created_at,r.name
  ) into v_lines
  from public.bookings b
  join public.resources r on r.id=b.resource_id
  where b.reference_no like p_group_ref || '-%';

  v_message :=
    '🔔 新借用申請' || E'\n\n' ||
    '申請編號：' || p_group_ref || E'\n' ||
    '機構：' || coalesce(v_org_name,'—') || E'\n' ||
    '類型：' || coalesce(v_type,'—') || E'\n' ||
    '申請人：' || coalesce(v_applicant_name,'—') || E'\n' ||
    '電話：' || coalesce(v_phone,'—') || E'\n' ||
    '用途：' || coalesce(v_purpose,'—') || E'\n' ||
    '備註：' || coalesce(nullif(v_note,''),'—') || E'\n\n' ||
    '申請內容：' || E'\n' || coalesce(v_lines,'—') || E'\n\n' ||
    '狀態：待審批' || E'\n' ||
    '提交時間：' || to_char(v_created_at at time zone 'Asia/Hong_Kong','YYYY-MM-DD HH24:MI');

  select net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body := jsonb_build_object(
      'chat_id',v_chat_id,
      'text',left(v_message,4000),
      'disable_web_page_preview',true
    ),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 8000
  ) into v_request_id;

  return v_request_id;
exception
  when others then
    raise warning 'Telegram notification failed to queue for %: %',p_group_ref,sqlerrm;
    return null;
end;
$$;

revoke all on function private.queue_telegram_application_notification(text) from public, anon, authenticated;

create or replace function private.notify_telegram_application_at_commit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_ref text;
begin
  if new.status='pending' and right(new.reference_no,2)='-1' then
    v_group_ref := left(new.reference_no,char_length(new.reference_no)-2);
    perform private.queue_telegram_application_notification(v_group_ref);
  end if;
  return new;
exception
  when others then
    raise warning 'Telegram deferred notification failed for %: %',new.reference_no,sqlerrm;
    return new;
end;
$$;

revoke all on function private.notify_telegram_application_at_commit() from public, anon, authenticated;

-- Clean up the v10.4 preview Edge-Function trigger if it was installed.
drop trigger if exists trg_booking_telegram_notification on public.bookings;
drop function if exists private.enqueue_telegram_booking_notification();
drop table if exists public.telegram_notification_log;

drop trigger if exists trg_booking_telegram_notification_deferred on public.bookings;
create constraint trigger trg_booking_telegram_notification_deferred
after insert on public.bookings
deferrable initially deferred
for each row
execute function private.notify_telegram_application_at_commit();
