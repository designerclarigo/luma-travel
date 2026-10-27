-- Additive, after auth-profiles.sql. No Auth identities/passwords or admin grants are changed here.
begin;
create or replace function public.waylo_admin_edit_profile(target_user uuid, profile_name text, profile_city text, expected_updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_profile public.waylo_profiles; result public.waylo_profiles;
begin
  perform public.waylo_require_admin();
  if target_user is null or expected_updated_at is null or profile_name is null or profile_city is null or length(profile_name)>100 or length(profile_city)>100 or (length(trim(profile_name))=1) or (profile_name||profile_city) ~ '[[:cntrl:]]' then raise exception 'Invalid profile' using errcode='22023'; end if;
  select * into current_profile from public.waylo_profiles where user_id=target_user for update;
  if not found then raise exception 'Account profile not found' using errcode='P0002'; end if;
  if current_profile.updated_at<>expected_updated_at then raise exception 'Profile changed' using errcode='40001'; end if;
  update public.waylo_profiles set full_name=trim(profile_name),home_city=trim(profile_city) where user_id=target_user returning * into result;
  insert into public.waylo_admin_audit(actor,action,target,details) values(auth.uid(),'user_profile_updated',target_user,jsonb_build_object('fields',jsonb_build_array('full_name','home_city')));
  return to_jsonb(result);
end;
$$;
create or replace function public.waylo_admin_prepare_user_invite(invitee_email text, invitee_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare request_id uuid;
begin
  perform public.waylo_require_admin();
  if invitee_email is null or invitee_name is null or length(invitee_email)>254 or invitee_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(invitee_name)>100 or length(trim(invitee_name))=1 or invitee_name ~ '[[:cntrl:]]' then raise exception 'Invalid invitation' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('waylo-user-invite:'||auth.uid()::text,0));
  if exists(select 1 from auth.users where lower(email)=lower(trim(invitee_email))) then raise exception 'Account already registered' using errcode='23505'; end if;
  if (select count(*) from public.waylo_admin_audit where actor=auth.uid() and action like 'user_invite_%' and created_at>now()-interval '1 hour')>=10 or exists(select 1 from public.waylo_admin_audit where actor=auth.uid() and action like 'user_invite_%' and created_at>now()-interval '60 seconds') then raise exception 'invite_rate_limit' using errcode='P0001'; end if;
  insert into public.waylo_admin_audit(actor,action,target,details) values(auth.uid(),'user_invite_requested',gen_random_uuid(),jsonb_build_object('email',lower(trim(invitee_email)),'name',trim(invitee_name),'outcome','requested')) returning id into request_id;
  return jsonb_build_object('request_id',request_id);
end;
$$;
create or replace function public.waylo_admin_finish_user_invite(request_id uuid, outcome text, invited_user_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare event public.waylo_admin_audit;
begin
  perform public.waylo_require_admin();
  if outcome not in ('accepted','failed','unknown') or outcome is null then raise exception 'Invalid outcome' using errcode='22023'; end if;
  select * into event from public.waylo_admin_audit where id=request_id and actor=auth.uid() and action='user_invite_requested' for update;
  if not found then raise exception 'Invitation request not found' using errcode='22023'; end if;
  if outcome='accepted' and (invited_user_id is null or not exists(select 1 from auth.users where id=invited_user_id)) then raise exception 'Invited account not found' using errcode='22023'; end if;
  update public.waylo_admin_audit set action='user_invite_'||outcome,target=coalesce(invited_user_id,target),details=details||jsonb_build_object('outcome',outcome) where id=request_id;
  return jsonb_build_object('recorded',true);
end;
$$;
revoke all on function public.waylo_admin_edit_profile(uuid,text,text,timestamptz),public.waylo_admin_prepare_user_invite(text,text),public.waylo_admin_finish_user_invite(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.waylo_admin_edit_profile(uuid,text,text,timestamptz),public.waylo_admin_prepare_user_invite(text,text),public.waylo_admin_finish_user_invite(uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
