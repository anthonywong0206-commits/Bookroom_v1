-- v10.3: Fix organization portal password hashing on hosted Supabase.
-- pgcrypto is installed in the `extensions` schema, while these SECURITY DEFINER
-- functions intentionally use an empty search_path. Always schema-qualify pgcrypto.

create or replace function private.assert_organization_portal_password(
  p_organization_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  select o.access_password_hash
    into v_hash
  from public.organizations o
  where o.id = p_organization_id
    and o.active;

  if v_hash is null then
    raise exception 'ORGANIZATION_NOT_AVAILABLE';
  end if;

  if p_password is null
     or extensions.crypt(p_password, v_hash) <> v_hash then
    raise exception 'INVALID_ORGANIZATION_PASSWORD';
  end if;
end;
$$;

create or replace function public.admin_set_organization_portal_password(
  p_organization_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_password is null or char_length(p_password) < 4 then
    raise exception 'PASSWORD_TOO_SHORT';
  end if;

  if char_length(p_password) > 64 then
    raise exception 'PASSWORD_TOO_LONG';
  end if;

  update public.organizations
  set access_password_hash = extensions.crypt(
        p_password,
        extensions.gen_salt('bf', 10)
      ),
      updated_at = now()
  where id = p_organization_id;

  if not found then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;
end;
$$;

revoke all on function private.assert_organization_portal_password(uuid, text) from public;
revoke all on function public.admin_set_organization_portal_password(uuid, text) from public, anon;
grant execute on function public.admin_set_organization_portal_password(uuid, text) to authenticated;
