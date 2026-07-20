-- Campus Base Dashboard: authentication-backed storage and privacy rules.
-- Run this file once in the Supabase SQL Editor for a new project.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  company text not null default '',
  role text not null default '',
  city text not null default '',
  building text not null default '',
  address text not null default '',
  longitude double precision,
  latitude double precision,
  stage text not null default 'pending',
  location_preference text not null default 'unsure',
  priority text not null default 'medium',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.job_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  job_id text not null,
  type text not null,
  title text not null,
  event_date date not null,
  start_time text not null default '',
  end_time text not null default '',
  location text not null default '',
  completed boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, job_id) references public.jobs(user_id, id) on delete cascade
);

create table if not exists public.friend_shares (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  display_name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_share_code_format check (code ~ '^[A-Z0-9]{6,12}$')
);

create table if not exists public.shared_points (
  share_id uuid not null references public.friend_shares(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  point_id text not null,
  city text not null default '',
  longitude double precision not null,
  latitude double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (share_id, point_id)
);

create table if not exists public.friend_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_code text not null,
  alias text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, friend_code),
  constraint friend_subscription_code_format check (friend_code ~ '^[A-Z0-9]{6,12}$')
);

create index if not exists jobs_user_updated_idx on public.jobs(user_id, updated_at desc);
create index if not exists job_events_user_date_idx on public.job_events(user_id, event_date);
create index if not exists friend_shares_owner_idx on public.friend_shares(owner_id);
create unique index if not exists friend_shares_one_owner_idx on public.friend_shares(owner_id);
create index if not exists shared_points_owner_idx on public.shared_points(owner_id);
create index if not exists friend_subscriptions_user_idx on public.friend_subscriptions(user_id);

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_events enable row level security;
alter table public.friend_shares enable row level security;
alter table public.shared_points enable row level security;
alter table public.friend_subscriptions enable row level security;

grant select, insert, update, delete on table
  public.profiles,
  public.jobs,
  public.job_events,
  public.friend_shares,
  public.shared_points,
  public.friend_subscriptions
to authenticated;

drop policy if exists "profiles_own_rows" on public.profiles;
create policy "profiles_own_rows" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "jobs_own_rows" on public.jobs;
create policy "jobs_own_rows" on public.jobs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "job_events_own_rows" on public.job_events;
create policy "job_events_own_rows" on public.job_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "friend_shares_owner_only" on public.friend_shares;
create policy "friend_shares_owner_only" on public.friend_shares
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "shared_points_owner_only" on public.shared_points;
create policy "shared_points_owner_only" on public.shared_points
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "friend_subscriptions_own_rows" on public.friend_subscriptions;
create policy "friend_subscriptions_own_rows" on public.friend_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.replace_my_dashboard(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'array' then
    raise exception 'Dashboard payload must be a JSON array';
  end if;

  delete from public.jobs where user_id = current_user_id;

  insert into public.jobs (
    user_id, id, company, role, city, building, address,
    longitude, latitude, stage, location_preference, priority, data, updated_at
  )
  select
    current_user_id,
    item ->> 'id',
    coalesce(item ->> 'company', ''),
    coalesce(item ->> 'role', ''),
    coalesce(item ->> 'city', ''),
    coalesce(item ->> 'building', ''),
    coalesce(item ->> 'address', ''),
    nullif(item ->> 'lng', '')::double precision,
    nullif(item ->> 'lat', '')::double precision,
    coalesce(item ->> 'stage', 'pending'),
    coalesce(item ->> 'locationPreference', 'unsure'),
    coalesce(item ->> 'priority', 'medium'),
    item,
    coalesce(nullif(item ->> 'updatedAt', '')::timestamptz, now())
  from jsonb_array_elements(payload) as item
  where coalesce(item ->> 'id', '') <> '';

  insert into public.job_events (
    user_id, id, job_id, type, title, event_date,
    start_time, end_time, location, completed, data, updated_at
  )
  select
    current_user_id,
    event ->> 'id',
    item ->> 'id',
    coalesce(event ->> 'type', 'assessment'),
    coalesce(event ->> 'title', '日程'),
    (event ->> 'date')::date,
    coalesce(event ->> 'startTime', ''),
    coalesce(event ->> 'endTime', ''),
    coalesce(event ->> 'location', ''),
    coalesce((event ->> 'completed')::boolean, false),
    event,
    now()
  from jsonb_array_elements(payload) as item
  cross join lateral jsonb_array_elements(coalesce(item -> 'events', '[]'::jsonb)) as event
  where coalesce(item ->> 'id', '') <> ''
    and coalesce(event ->> 'id', '') <> ''
    and coalesce(event ->> 'date', '') <> '';
end;
$$;

create or replace function public.read_friend_space(p_code text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'code', share.code,
    'displayName', share.display_name,
    'updatedAt', floor(extract(epoch from share.updated_at))::bigint,
    'points', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', point.point_id,
          'city', point.city,
          'lng', point.longitude,
          'lat', point.latitude
        ) order by point.point_id
      ) filter (where point.point_id is not null),
      '[]'::jsonb
    )
  )
  from public.friend_shares as share
  left join public.shared_points as point on point.share_id = share.id
  where share.code = upper(trim(p_code)) and share.active = true
  group by share.id;
$$;

create or replace function public.upsert_my_friend_space(
  p_display_name text,
  p_points jsonb,
  p_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  current_user_id uuid := auth.uid();
  target_share_id uuid;
  share_code text;
  changed_at timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_points is null or jsonb_typeof(p_points) <> 'array' then
    raise exception 'Points payload must be a JSON array';
  end if;

  if nullif(trim(p_code), '') is not null then
    select id, code into target_share_id, share_code
    from public.friend_shares
    where owner_id = current_user_id and code = upper(trim(p_code));
    if target_share_id is null then
      raise exception 'Share code not found';
    end if;
    update public.friend_shares
    set display_name = left(coalesce(p_display_name, ''), 24), active = true, updated_at = changed_at
    where id = target_share_id;
  else
    select id, code into target_share_id, share_code
    from public.friend_shares
    where owner_id = current_user_id;
    if target_share_id is not null then
      update public.friend_shares
      set display_name = left(coalesce(p_display_name, ''), 24), active = true, updated_at = changed_at
      where id = target_share_id;
    else
      loop
        share_code := upper(substr(encode(extensions.gen_random_bytes(12), 'hex'), 1, 12));
        begin
          insert into public.friend_shares (owner_id, code, display_name, updated_at)
          values (current_user_id, share_code, left(coalesce(p_display_name, ''), 24), changed_at)
          returning id into target_share_id;
          exit;
        exception when unique_violation then
          -- Generate another opaque code.
        end;
      end loop;
    end if;
  end if;

  delete from public.shared_points where share_id = target_share_id;
  insert into public.shared_points (
    share_id, owner_id, point_id, city, longitude, latitude, updated_at
  )
  select
    target_share_id,
    current_user_id,
    point ->> 'id',
    left(coalesce(point ->> 'city', ''), 40),
    (point ->> 'lng')::double precision,
    (point ->> 'lat')::double precision,
    changed_at
  from jsonb_array_elements(p_points) as point
  where coalesce(point ->> 'id', '') <> ''
    and (point ->> 'lng')::double precision between -180 and 180
    and (point ->> 'lat')::double precision between -90 and 90;

  return jsonb_build_object(
    'code', share_code,
    'displayName', left(coalesce(p_display_name, ''), 24),
    'updatedAt', floor(extract(epoch from changed_at))::bigint
  );
end;
$$;

create or replace function public.revoke_my_friend_space(p_code text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  delete from public.friend_shares
  where owner_id = auth.uid() and code = upper(trim(p_code));
end;
$$;

revoke all on function public.replace_my_dashboard(jsonb) from public;
grant execute on function public.replace_my_dashboard(jsonb) to authenticated;
revoke all on function public.read_friend_space(text) from public;
grant execute on function public.read_friend_space(text) to authenticated;
revoke all on function public.upsert_my_friend_space(text, jsonb, text) from public;
grant execute on function public.upsert_my_friend_space(text, jsonb, text) to authenticated;
revoke all on function public.revoke_my_friend_space(text) from public;
grant execute on function public.revoke_my_friend_space(text) to authenticated;
