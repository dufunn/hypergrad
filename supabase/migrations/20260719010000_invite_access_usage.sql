-- Invite-only registration, owner administration, and first-party API usage telemetry.
-- After applying this migration, enable `public.hook_enforce_invite_signup`
-- in Supabase Dashboard > Authentication > Hooks > Before User Created.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.platform_admins (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint platform_admin_email_normalized check (email = lower(trim(email)))
);

-- Add the initial administrator after applying this migration:
-- insert into public.platform_admins (email) values ('owner@example.com');

create table if not exists public.invite_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  code_hash text not null unique,
  code_hint text not null,
  label text not null default '',
  active boolean not null default true,
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invite_code_hash_format check (code_hash ~ '^[a-f0-9]{64}$'),
  constraint invite_code_max_uses check (max_uses is null or max_uses between 1 and 10000),
  constraint invite_code_use_count check (use_count >= 0)
);

create table if not exists public.invite_redemptions (
  id uuid primary key default extensions.gen_random_uuid(),
  invite_code_id uuid not null references public.invite_codes(id) on delete restrict,
  -- The Before User Created hook receives the future user id before auth.users
  -- is inserted, so an immediate foreign key to auth.users would reject every
  -- otherwise valid signup. The id remains unique and is auditable against
  -- auth.users after account creation.
  user_id uuid not null unique,
  email text not null,
  redeemed_at timestamptz not null default now()
);

-- Repair databases that applied an earlier draft with an auth.users FK.
alter table public.invite_redemptions
  drop constraint if exists invite_redemptions_user_id_fkey;

create table if not exists public.api_usage_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  operation text not null,
  status text not null default 'success',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint api_usage_provider_format check (provider ~ '^[a-z0-9_-]{2,32}$'),
  constraint api_usage_operation_format check (operation ~ '^[a-z0-9_-]{2,48}$'),
  constraint api_usage_status_format check (status in ('success', 'error')),
  constraint api_usage_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists invite_codes_active_idx
  on public.invite_codes(active, created_at desc);
create index if not exists invite_redemptions_code_idx
  on public.invite_redemptions(invite_code_id, redeemed_at desc);
create index if not exists api_usage_events_operation_created_idx
  on public.api_usage_events(operation, created_at desc);
create index if not exists api_usage_events_user_created_idx
  on public.api_usage_events(user_id, created_at desc);

alter table public.platform_admins enable row level security;
alter table public.invite_codes enable row level security;
alter table public.invite_redemptions enable row level security;
alter table public.api_usage_events enable row level security;

revoke all on table public.platform_admins from anon, authenticated, public;
revoke all on table public.invite_codes from anon, authenticated, public;
revoke all on table public.invite_redemptions from anon, authenticated, public;
revoke all on table public.api_usage_events from anon, authenticated, public;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins as admin
    where admin.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.admin_create_invite_code(
  p_code text default null,
  p_label text default '',
  p_max_uses integer default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_code text;
  normalized_code text;
  new_row public.invite_codes;
begin
  if not public.is_platform_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  raw_code := coalesce(nullif(trim(p_code), ''),
    upper(substr(encode(extensions.gen_random_bytes(9), 'hex'), 1, 12)));
  normalized_code := upper(raw_code);

  if normalized_code !~ '^[A-Z0-9-]{6,24}$' then
    raise exception 'Invite codes must contain 6–24 letters, numbers, or hyphens';
  end if;
  if p_max_uses is not null and (p_max_uses < 1 or p_max_uses > 10000) then
    raise exception 'Maximum uses must be between 1 and 10000';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Expiration must be in the future';
  end if;

  insert into public.invite_codes (
    code_hash, code_hint, label, max_uses, expires_at, created_by
  ) values (
    encode(extensions.digest(normalized_code, 'sha256'), 'hex'),
    left(normalized_code, 2) || '••••' || right(normalized_code, 2),
    left(coalesce(trim(p_label), ''), 60),
    p_max_uses,
    p_expires_at,
    auth.uid()
  )
  returning * into new_row;

  return jsonb_build_object(
    'id', new_row.id,
    'code', normalized_code,
    'hint', new_row.code_hint,
    'label', new_row.label,
    'active', new_row.active,
    'maxUses', new_row.max_uses,
    'useCount', new_row.use_count,
    'expiresAt', new_row.expires_at,
    'createdAt', new_row.created_at
  );
exception
  when unique_violation then
    raise exception 'This invite code already exists';
end;
$$;

revoke all on function public.admin_create_invite_code(text, text, integer, timestamptz) from public, anon;
grant execute on function public.admin_create_invite_code(text, text, integer, timestamptz) to authenticated;

create or replace function public.admin_set_invite_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  update public.invite_codes
  set active = coalesce(p_active, false), updated_at = now()
  where id = p_id;

  if not found then
    raise exception 'Invite code not found';
  end if;
end;
$$;

revoke all on function public.admin_set_invite_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_invite_active(uuid, boolean) to authenticated;

create or replace function public.track_api_usage(
  p_provider text,
  p_operation text,
  p_status text default 'success',
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_provider text := lower(trim(coalesce(p_provider, '')));
  normalized_operation text := lower(trim(coalesce(p_operation, '')));
  normalized_status text := lower(trim(coalesce(p_status, 'success')));
begin
  if current_user_id is null then
    return;
  end if;
  if normalized_provider !~ '^[a-z0-9_-]{2,32}$'
    or normalized_operation !~ '^[a-z0-9_-]{2,48}$'
    or normalized_status not in ('success', 'error') then
    raise exception 'Invalid API usage event';
  end if;

  insert into public.api_usage_events (user_id, provider, operation, status, metadata)
  values (
    current_user_id,
    normalized_provider,
    normalized_operation,
    normalized_status,
    case
      when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object'
        then coalesce(p_metadata, '{}'::jsonb)
      else '{}'::jsonb
    end
  );
end;
$$;

revoke all on function public.track_api_usage(text, text, text, jsonb) from public, anon;
grant execute on function public.track_api_usage(text, text, text, jsonb) to authenticated;

create or replace function public.admin_access_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generatedAt', now(),
    'summary', jsonb_build_object(
      'users', (select count(*) from auth.users),
      'activeInvites', (
        select count(*) from public.invite_codes
        where active = true
          and (expires_at is null or expires_at > now())
          and (max_uses is null or use_count < max_uses)
      ),
      'routePlanning', (
        select count(*) from public.api_usage_events
        where operation = 'route_planning'
      ),
      'routePlanning30d', (
        select count(*) from public.api_usage_events
        where operation = 'route_planning' and created_at >= now() - interval '30 days'
      ),
      'placeSearch30d', (
        select count(*) from public.api_usage_events
        where operation = 'place_search' and created_at >= now() - interval '30 days'
      )
    ),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', code.id,
        'hint', code.code_hint,
        'label', code.label,
        'active', code.active,
        'maxUses', code.max_uses,
        'useCount', code.use_count,
        'expiresAt', code.expires_at,
        'createdAt', code.created_at
      ) order by code.created_at desc)
      from public.invite_codes as code
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', usr.id,
        'email', usr.email,
        'displayName', coalesce(profile.display_name, ''),
        'createdAt', usr.created_at,
        'confirmedAt', usr.email_confirmed_at,
        'lastSignInAt', usr.last_sign_in_at
      ) order by usr.created_at desc)
      from auth.users as usr
      left join public.profiles as profile on profile.id = usr.id
    ), '[]'::jsonb),
    'usageDaily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', daily.day,
        'routePlanning', daily.route_planning,
        'routeErrors', daily.route_errors,
        'placeSearch', daily.place_search
      ) order by daily.day)
      from (
        select
          series.day::date as day,
          count(event.id) filter (where event.operation = 'route_planning') as route_planning,
          count(event.id) filter (where event.operation = 'route_planning' and event.status = 'error') as route_errors,
          count(event.id) filter (where event.operation = 'place_search') as place_search
        from generate_series(current_date - 13, current_date, interval '1 day') as series(day)
        left join public.api_usage_events as event
          on event.created_at >= series.day
         and event.created_at < series.day + interval '1 day'
        group by series.day
      ) as daily
    ), '[]'::jsonb),
    'recentUsage', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id,
        'provider', event.provider,
        'operation', event.operation,
        'status', event.status,
        'metadata', event.metadata,
        'createdAt', event.created_at,
        'email', usr.email
      ) order by event.created_at desc)
      from (
        select * from public.api_usage_events order by created_at desc limit 80
      ) as event
      left join auth.users as usr on usr.id = event.user_id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_access_snapshot() from public, anon;
grant execute on function public.admin_access_snapshot() to authenticated;

create or replace function public.hook_enforce_invite_signup(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  signup_email text := lower(trim(coalesce(event -> 'user' ->> 'email', '')));
  invite_token text := lower(trim(coalesce(event -> 'user' -> 'user_metadata' ->> 'invite_token', '')));
  signup_user_id uuid := (event -> 'user' ->> 'id')::uuid;
  matched_code public.invite_codes;
  redemption_id uuid;
begin
  if exists (select 1 from public.platform_admins where email = signup_email) then
    return '{}'::jsonb;
  end if;

  if invite_token !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'A valid invite code is required to create an account.'
      )
    );
  end if;

  select * into matched_code
  from public.invite_codes
  where code_hash = invite_token
  for update;

  if matched_code.id is null
    or matched_code.active is not true
    or (matched_code.expires_at is not null and matched_code.expires_at <= now())
    or (matched_code.max_uses is not null and matched_code.use_count >= matched_code.max_uses) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'This invite code is invalid, inactive, expired, or fully used.'
      )
    );
  end if;

  insert into public.invite_redemptions (invite_code_id, user_id, email)
  values (matched_code.id, signup_user_id, signup_email)
  on conflict (user_id) do nothing
  returning id into redemption_id;

  if redemption_id is not null then
    update public.invite_codes
    set use_count = use_count + 1, updated_at = now()
    where id = matched_code.id;
  end if;

  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant select, update on table public.invite_codes to supabase_auth_admin;
grant select on table public.platform_admins to supabase_auth_admin;
grant insert, select on table public.invite_redemptions to supabase_auth_admin;

drop policy if exists "invite_hook_read_codes" on public.invite_codes;
create policy "invite_hook_read_codes" on public.invite_codes
  for select to supabase_auth_admin using (true);
drop policy if exists "invite_hook_update_codes" on public.invite_codes;
create policy "invite_hook_update_codes" on public.invite_codes
  for update to supabase_auth_admin using (true) with check (true);
drop policy if exists "invite_hook_read_admins" on public.platform_admins;
create policy "invite_hook_read_admins" on public.platform_admins
  for select to supabase_auth_admin using (true);
drop policy if exists "invite_hook_insert_redemptions" on public.invite_redemptions;
create policy "invite_hook_insert_redemptions" on public.invite_redemptions
  for insert to supabase_auth_admin with check (true);
drop policy if exists "invite_hook_read_redemptions" on public.invite_redemptions;
create policy "invite_hook_read_redemptions" on public.invite_redemptions
  for select to supabase_auth_admin using (true);

grant execute on function public.hook_enforce_invite_signup(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_enforce_invite_signup(jsonb) from authenticated, anon, public;
