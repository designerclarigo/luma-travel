-- Apply AFTER backend/supabase.sql. Additive: existing mobile policies are unchanged.
-- No user may grant themselves admin access. Bootstrap/revoke only in trusted SQL.
begin;
create table if not exists public.waylo_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.waylo_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor uuid references auth.users(id) on delete set null,
  action text not null,
  target uuid not null,
  details jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.waylo_admins enable row level security;
alter table public.waylo_admin_audit enable row level security;
revoke all on public.waylo_admins, public.waylo_admin_audit from public, anon, authenticated;
create index if not exists waylo_admin_audit_created_idx on public.waylo_admin_audit(created_at desc);

create or replace function public.waylo_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from public.waylo_admins where user_id=auth.uid() and active
  );
$$;
revoke all on function public.waylo_is_admin() from public, anon, authenticated;
grant execute on function public.waylo_is_admin() to authenticated;

create or replace function public.waylo_require_admin() returns void
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.waylo_is_admin() then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
end;
$$;
revoke all on function public.waylo_require_admin() from public, anon, authenticated;

create or replace function public.waylo_admin_room_summary(r public.waylo_rooms) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'id',r.id, 'owner',r.owner, 'owner_email',(select email from auth.users where id=r.owner),
    'revision',r.revision, 'updated_at',r.updated_at,
    'title',coalesce(nullif(r.document#>>'{trip,title}',''),'Untitled journey'),
    'departure',r.document#>>'{trip,departure}', 'end_date',r.document#>>'{trip,endDate}',
    'travelers',r.document#>'{trip,travelers}',
    'destinations',jsonb_path_query_array(r.document,'$.trip.stops[*].place.name'),
    'status',case
      when r.document#>>'{trip,completedAt}' is not null then 'completed'
      when r.document#>>'{trip,endDate}' < to_char(current_date,'YYYY-MM-DD') then 'past'
      when r.document#>>'{trip,departure}' <= to_char(current_date,'YYYY-MM-DD') then 'ongoing'
      when r.document#>>'{trip,departure}' > to_char(current_date,'YYYY-MM-DD') then 'upcoming'
      else 'unscheduled' end,
    'packing_rows',jsonb_array_length(case when jsonb_typeof(r.document#>'{trip,packing}')='array' then r.document#>'{trip,packing}' else '[]'::jsonb end),
    'members',(select count(*) from public.waylo_members where room_id=r.id)
  );
$$;
revoke all on function public.waylo_admin_room_summary(public.waylo_rooms) from public, anon, authenticated;

create or replace function public.waylo_admin_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.waylo_require_admin();
  return jsonb_build_object('schema',1,'admin',true);
end;
$$;

create or replace function public.waylo_admin_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.waylo_require_admin();
  return jsonb_build_object(
    'users',(select count(*) from auth.users),
    'verified_users',(select count(*) from auth.users where email_confirmed_at is not null),
    'new_users_7d',(select count(*) from auth.users where created_at>=now()-interval '7 days'),
    'shared_trips',(select count(*) from public.waylo_rooms),
    'memberships',(select count(*) from public.waylo_members),
    'account_backups',(select count(*) from public.waylo_backups),
    'packing_rows',(select coalesce(sum(jsonb_array_length(case when jsonb_typeof(document#>'{trip,packing}')='array' then document#>'{trip,packing}' else '[]'::jsonb end)),0) from public.waylo_rooms),
    'recent_trips',(select coalesce(jsonb_agg(public.waylo_admin_room_summary(r) order by r.updated_at desc),'[]'::jsonb) from public.waylo_rooms r where r.id in (select id from public.waylo_rooms order by updated_at desc,id limit 5)),
    'signups',(select jsonb_agg(jsonb_build_object('month',to_char(m,'Mon YYYY'),'count',(select count(*) from auth.users u where u.created_at>=m and u.created_at<m+interval '1 month')) order by m)
      from generate_series(date_trunc('month',now())-interval '5 months',date_trunc('month',now()),interval '1 month') m),
    'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb) from
      (select action,target,details,created_at from public.waylo_admin_audit order by created_at desc limit 8) a),
    'as_of',now()
  );
end;
$$;

create or replace function public.waylo_admin_users(page_number integer default 1, search_text text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; total bigint;
begin
  perform public.waylo_require_admin();
  if page_number is null or page_number<1 or page_number>100000 or search_text is null or length(search_text)>100 then raise exception 'Invalid page or search' using errcode='22023'; end if;
  select count(*) into total from auth.users where strpos(lower(coalesce(email,'')),lower(search_text))>0;
  select coalesce(jsonb_agg(to_jsonb(u) order by u.created_at desc,u.id),'[]'::jsonb) into result from (
    select a.id,a.email,a.created_at,a.last_sign_in_at,a.email_confirmed_at,
      exists(select 1 from public.waylo_admins where user_id=a.id and active) as is_admin,
      (select count(*) from public.waylo_rooms where owner=a.id) as shared_trips,
      (select count(*) from public.waylo_members where user_id=a.id) as memberships,
      exists(select 1 from public.waylo_backups where user_id=a.id) as has_backup
    from auth.users a where strpos(lower(coalesce(a.email,'')),lower(search_text))>0
    order by a.created_at desc,a.id limit 20 offset (page_number-1)*20
  ) u;
  return jsonb_build_object('items',result,'total',total,'page',page_number,'page_size',20);
end;
$$;

create or replace function public.waylo_admin_trips(page_number integer default 1, search_text text default '', status_filter text default 'all') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; total bigint;
begin
  perform public.waylo_require_admin();
  if page_number is null or page_number<1 or page_number>100000 or search_text is null or length(search_text)>100 or status_filter is null or status_filter not in ('all','upcoming','ongoing','past','completed','unscheduled') then raise exception 'Invalid filters' using errcode='22023'; end if;
  with records as (select public.waylo_admin_room_summary(r) as item from public.waylo_rooms r)
    select count(*) into total from records where strpos(lower(item->>'title'),lower(search_text))>0 and (status_filter='all' or item->>'status'=status_filter);
  with records as (select public.waylo_admin_room_summary(r) as item,r.updated_at,r.id from public.waylo_rooms r)
    select coalesce(jsonb_agg(t.item order by t.updated_at desc,t.id),'[]'::jsonb) into result from (
      select * from records where strpos(lower(item->>'title'),lower(search_text))>0 and (status_filter='all' or item->>'status'=status_filter)
      order by updated_at desc,id limit 20 offset (page_number-1)*20
    ) t;
  return jsonb_build_object('items',result,'total',total,'page',page_number,'page_size',20);
end;
$$;

create or replace function public.waylo_admin_trip(room uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.waylo_rooms; members jsonb;
begin
  perform public.waylo_require_admin();
  select * into r from public.waylo_rooms where id=room;
  if not found then raise exception 'Trip no longer exists' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',a.email,'role',m.role) order by m.role,m.user_id),'[]'::jsonb)
    into members from public.waylo_members m join auth.users a on a.id=m.user_id where m.room_id=room;
  return jsonb_build_object('summary',public.waylo_admin_room_summary(r),'document',r.document,'members',members);
end;
$$;

create or replace function public.waylo_admin_delete_trip(room uuid, expected_revision integer, confirmation text, reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.waylo_rooms;
begin
  perform public.waylo_require_admin();
  if confirmation is distinct from 'DELETE' or reason is null or length(trim(reason))<6 or length(reason)>500 then
    raise exception 'Type DELETE and provide a reason of 6-500 characters' using errcode='22023';
  end if;
  select * into r from public.waylo_rooms where id=room for update;
  if not found then raise exception 'Trip no longer exists' using errcode='P0002'; end if;
  if expected_revision is null or r.revision<>expected_revision then raise exception 'revision_conflict' using errcode='40001'; end if;
  insert into public.waylo_admin_audit(actor,action,target,details) values(auth.uid(),'shared_trip_deleted',room,
    jsonb_build_object('title',r.document#>>'{trip,title}','revision',r.revision,'reason',trim(reason)));
  delete from public.waylo_rooms where id=room;
  return jsonb_build_object('deleted',true);
end;
$$;

revoke all on function public.waylo_admin_status(),public.waylo_admin_overview(),public.waylo_admin_users(integer,text),public.waylo_admin_trips(integer,text,text),public.waylo_admin_trip(uuid),public.waylo_admin_delete_trip(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.waylo_admin_status(),public.waylo_admin_overview(),public.waylo_admin_users(integer,text),public.waylo_admin_trips(integer,text,text),public.waylo_admin_trip(uuid),public.waylo_admin_delete_trip(uuid,integer,text,text) to authenticated;
notify pgrst,'reload schema';
commit;

-- Bootstrap ONLY through the trusted Supabase SQL editor, using the user's UUID:
-- insert into public.waylo_admins(user_id) values ('YOUR-CONFIRMED-USER-UUID');
-- Revoke immediately: update public.waylo_admins set active=false where user_id='UUID';
