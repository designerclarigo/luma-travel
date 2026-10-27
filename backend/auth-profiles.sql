-- Additive migration after the existing Waylo cloud/admin schemas.
-- Registration creates a personal profile, never an administrator grant.
begin;
create table if not exists public.waylo_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name)<=100 and full_name !~ '[[:cntrl:]]'),
  home_city text not null default '' check (char_length(home_city)<=100 and home_city !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.waylo_profiles enable row level security;
revoke all on public.waylo_profiles from public,anon,authenticated;
grant select on public.waylo_profiles to authenticated;
grant update(full_name,home_city) on public.waylo_profiles to authenticated;
drop policy if exists waylo_profile_read_self on public.waylo_profiles;
create policy waylo_profile_read_self on public.waylo_profiles for select to authenticated using(user_id=auth.uid());
drop policy if exists waylo_profile_edit_self on public.waylo_profiles;
create policy waylo_profile_edit_self on public.waylo_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function public.waylo_new_user_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.waylo_profiles(user_id,full_name,home_city,created_at)
  values(new.id,
    left(regexp_replace(trim(case when jsonb_typeof(new.raw_user_meta_data->'full_name')='string' then new.raw_user_meta_data->>'full_name' when jsonb_typeof(new.raw_user_meta_data->'name')='string' then new.raw_user_meta_data->>'name' else '' end),'[[:cntrl:]]','','g'),100),
    left(regexp_replace(trim(case when jsonb_typeof(new.raw_user_meta_data->'home_city')='string' then new.raw_user_meta_data->>'home_city' else '' end),'[[:cntrl:]]','','g'),100),new.created_at)
  on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.waylo_new_user_profile() from public,anon,authenticated;
drop trigger if exists waylo_auth_profile_created on auth.users;
create trigger waylo_auth_profile_created after insert on auth.users for each row execute function public.waylo_new_user_profile();

create or replace function public.waylo_profile_timestamp() returns trigger
language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end;
$$;
revoke all on function public.waylo_profile_timestamp() from public,anon,authenticated;
drop trigger if exists waylo_profile_updated on public.waylo_profiles;
create trigger waylo_profile_updated before update on public.waylo_profiles for each row execute function public.waylo_profile_timestamp();

-- Existing accounts receive truthful metadata or an empty name; never a sample identity.
insert into public.waylo_profiles(user_id,full_name,home_city,created_at)
select id,
  left(regexp_replace(trim(case when jsonb_typeof(raw_user_meta_data->'full_name')='string' then raw_user_meta_data->>'full_name' when jsonb_typeof(raw_user_meta_data->'name')='string' then raw_user_meta_data->>'name' else '' end),'[[:cntrl:]]','','g'),100),
  left(regexp_replace(trim(case when jsonb_typeof(raw_user_meta_data->'home_city')='string' then raw_user_meta_data->>'home_city' else '' end),'[[:cntrl:]]','','g'),100),created_at
from auth.users on conflict(user_id) do nothing;

-- The same protected admin RPC now joins personal profiles to canonical Auth data.
-- Profile fields and editable Auth metadata do not determine permissions.
create or replace function public.waylo_admin_users(page_number integer default 1, search_text text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; total bigint;
begin
  perform public.waylo_require_admin();
  if page_number is null or page_number<1 or page_number>100000 or search_text is null or length(search_text)>100 then raise exception 'Invalid page or search' using errcode='22023'; end if;
  select count(*) into total from auth.users a left join public.waylo_profiles p on p.user_id=a.id
    where strpos(lower(coalesce(a.email,'')||' '||coalesce(p.full_name,'')),lower(search_text))>0;
  select coalesce(jsonb_agg(to_jsonb(u) order by u.created_at desc,u.id),'[]'::jsonb) into result from (
    select a.id,a.email,a.created_at,a.last_sign_in_at,a.email_confirmed_at,
      coalesce(p.full_name,'') as full_name,coalesce(p.home_city,'') as home_city,p.updated_at as profile_updated_at,
      exists(select 1 from public.waylo_admins where user_id=a.id and active) as is_admin,
      (select count(*) from public.waylo_rooms where owner=a.id) as shared_trips,
      (select count(*) from public.waylo_members where user_id=a.id) as memberships,
      exists(select 1 from public.waylo_backups where user_id=a.id) as has_backup
    from auth.users a left join public.waylo_profiles p on p.user_id=a.id
    where strpos(lower(coalesce(a.email,'')||' '||coalesce(p.full_name,'')),lower(search_text))>0
    order by a.created_at desc,a.id limit 20 offset (page_number-1)*20
  ) u;
  return jsonb_build_object('items',result,'total',total,'page',page_number,'page_size',20);
end;
$$;
revoke all on function public.waylo_admin_users(integer,text) from public,anon,authenticated;
grant execute on function public.waylo_admin_users(integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
