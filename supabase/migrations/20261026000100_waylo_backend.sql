-- Deploy in your own Supabase project. No client may bypass these RPCs for writes.
-- Run the complete file in the SQL editor (or as one migration). Safe to rerun;
-- existing rooms, memberships and backups are preserved. Failures roll back.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.waylo_rooms(id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade, document jsonb not null, revision integer not null default 1, updated_at timestamptz not null default now());
create table if not exists public.waylo_members(room_id uuid references public.waylo_rooms(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, role text not null check(role in ('owner','editor','viewer')), primary key(room_id,user_id));
create table if not exists public.waylo_invites(token_hash text primary key, room_id uuid not null references public.waylo_rooms(id) on delete cascade, role text not null check(role in ('editor','viewer')), expires_at timestamptz not null);
create index if not exists waylo_rooms_owner_idx on public.waylo_rooms(owner);
create index if not exists waylo_members_user_idx on public.waylo_members(user_id);
create index if not exists waylo_invites_room_idx on public.waylo_invites(room_id);
alter table public.waylo_rooms enable row level security;
alter table public.waylo_members enable row level security;
alter table public.waylo_invites enable row level security;
create or replace function public.waylo_can_read(room uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.waylo_members where room_id=room and user_id=auth.uid()); $$;
revoke all on function public.waylo_can_read(uuid) from public,anon;
grant execute on function public.waylo_can_read(uuid) to authenticated;
drop policy if exists waylo_room_read on public.waylo_rooms;
create policy waylo_room_read on public.waylo_rooms for select to authenticated using (public.waylo_can_read(id));
drop policy if exists waylo_member_read on public.waylo_members;
create policy waylo_member_read on public.waylo_members for select to authenticated using (public.waylo_can_read(room_id));
revoke all on public.waylo_rooms,public.waylo_members,public.waylo_invites from anon,authenticated;
grant select on public.waylo_rooms,public.waylo_members to authenticated;
create or replace function public.waylo_validate(content jsonb) returns void language plpgsql set search_path='' as $$ begin
  if content is null or content->>'schema' is distinct from '1' or jsonb_typeof(content->'trip') is distinct from 'object' or jsonb_typeof(content->'bags') is distinct from 'array' or jsonb_typeof(content->'places') is distinct from 'array' or octet_length(content::text)>1000000 then raise exception 'Invalid or oversized trip document'; end if;
end; $$;
create or replace function public.waylo_create_room(content jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare r public.waylo_rooms; begin
  if auth.uid() is null then raise exception 'Sign in first'; end if; perform public.waylo_validate(content);
  if (select count(*) from public.waylo_rooms where owner=auth.uid())>=100 then raise exception 'Room limit reached'; end if;
  insert into public.waylo_rooms(owner,document) values(auth.uid(),content) returning * into r; insert into public.waylo_members values(r.id,auth.uid(),'owner'); return to_jsonb(r);
end; $$;
create or replace function public.waylo_publish(room uuid,expected_revision integer,content jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare r public.waylo_rooms; begin
  if not exists(select 1 from public.waylo_members where room_id=room and user_id=auth.uid() and role in ('owner','editor')) then raise exception 'Editing access required'; end if;
  perform public.waylo_validate(content); update public.waylo_rooms set document=content, revision=revision+1, updated_at=now() where id=room and revision=expected_revision returning * into r;
  if r.id is null then raise exception 'revision_conflict'; end if; return to_jsonb(r);
end; $$;
create or replace function public.waylo_invite(room uuid,access_role text) returns text language plpgsql security definer set search_path='' as $$ declare token text; begin
  if not exists(select 1 from public.waylo_rooms where id=room and owner=auth.uid()) or access_role is null or access_role not in ('editor','viewer') then raise exception 'Owner access required'; end if;
  token:=encode(extensions.gen_random_bytes(32),'hex'); insert into public.waylo_invites values(encode(extensions.digest(token,'sha256'),'hex'),room,access_role,now()+interval '7 days'); return token;
end; $$;
create or replace function public.waylo_join(invitation text) returns jsonb language plpgsql security definer set search_path='' as $$ declare i public.waylo_invites; r public.waylo_rooms; begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if invitation is null or trim(invitation) !~ '^[a-fA-F0-9]{64}$' then raise exception 'Invitation is invalid, revoked or expired'; end if;
  select * into i from public.waylo_invites where token_hash=encode(extensions.digest(lower(trim(invitation)),'sha256'),'hex') and expires_at>now(); if i.room_id is null then raise exception 'Invitation is invalid, revoked or expired'; end if;
  insert into public.waylo_members values(i.room_id,auth.uid(),i.role) on conflict do nothing; select * into r from public.waylo_rooms where id=i.room_id; return to_jsonb(r);
end; $$;
create or replace function public.waylo_revoke(room uuid,member uuid default null) returns void language plpgsql security definer set search_path='' as $$ begin
  if not exists(select 1 from public.waylo_rooms where id=room and owner=auth.uid()) then raise exception 'Owner access required'; end if;
  if member is null then delete from public.waylo_invites where room_id=room; else delete from public.waylo_members where room_id=room and user_id=member and role<>'owner'; end if;
end; $$;
create or replace function public.waylo_delete_room(room uuid) returns void language plpgsql security definer set search_path='' as $$ begin
  delete from public.waylo_rooms where id=room and owner=auth.uid(); if not found then raise exception 'Owner access required'; end if;
end; $$;
revoke all on function public.waylo_validate(jsonb),public.waylo_create_room(jsonb),public.waylo_publish(uuid,integer,jsonb),public.waylo_invite(uuid,text),public.waylo_join(text),public.waylo_revoke(uuid,uuid),public.waylo_delete_room(uuid) from public,anon;
grant execute on function public.waylo_create_room(jsonb),public.waylo_publish(uuid,integer,jsonb),public.waylo_invite(uuid,text),public.waylo_join(text),public.waylo_revoke(uuid,uuid),public.waylo_delete_room(uuid) to authenticated;
-- Enable row-change broadcasts (the RLS read policy controls delivery).
do $$ begin alter publication supabase_realtime add table public.waylo_rooms; exception when duplicate_object then null; end $$;
-- Optional manual account backup, separate from collaborative rooms.
create table if not exists public.waylo_backups(user_id uuid primary key references auth.users(id) on delete cascade, document text not null check(octet_length(document)<=5000000), updated_at timestamptz not null default now());
alter table public.waylo_backups enable row level security;
drop policy if exists waylo_backup_self on public.waylo_backups;
create policy waylo_backup_self on public.waylo_backups for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.waylo_backups from public,anon,authenticated;
grant select,insert,update,delete on public.waylo_backups to authenticated;
-- Authenticated readiness check: reports schema capability, never trip data.
create or replace function public.waylo_status() returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('schema',1,'collaboration',true,'backup',true);
$$;
revoke all on function public.waylo_status() from public,anon;
grant execute on function public.waylo_status() to authenticated;
notify pgrst, 'reload schema';
commit;
