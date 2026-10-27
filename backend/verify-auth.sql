-- Read-only installation metadata. The transaction below rolls all permission probes back.
select jsonb_build_object(
  'profile_count',(select count(*) from public.waylo_profiles),
  'auth_user_count',(select count(*) from auth.users),
  'active_admins',(select count(*) from public.waylo_admins where active),
  'published_trips',(select count(*) from public.waylo_rooms),
  'profile_rls',(select relrowsecurity from pg_class where oid='public.waylo_profiles'::regclass),
  'signup_trigger',exists(select 1 from pg_trigger where tgname='waylo_auth_profile_created' and tgrelid='auth.users'::regclass and not tgisinternal),
  'profile_names_match_registration_metadata',not exists(select 1 from auth.users a join public.waylo_profiles p on p.user_id=a.id where jsonb_typeof(a.raw_user_meta_data->'full_name')='string' and p.full_name<>left(regexp_replace(trim(a.raw_user_meta_data->>'full_name'),'[[:cntrl:]]','','g'),100)),
  'ordinary_confirmed_accounts',(select count(*) from auth.users a where a.email_confirmed_at is not null and not exists(select 1 from public.waylo_admins g where g.user_id=a.id and g.active)),
  'anonymous_profile_select',has_table_privilege('anon','public.waylo_profiles','select'),
  'client_profile_insert',has_table_privilege('authenticated','public.waylo_profiles','insert'),
  'client_user_id_update',has_column_privilege('authenticated','public.waylo_profiles','user_id','update'),
  'client_name_update',has_column_privilege('authenticated','public.waylo_profiles','full_name','update')
) as verification;

begin;
select set_config('request.jwt.claim.sub',coalesce((select a.id::text from auth.users a where a.email_confirmed_at is not null and not exists(select 1 from public.waylo_admins g where g.user_id=a.id and g.active) order by a.created_at desc limit 1),''),true);
set local role authenticated;
do $$
declare n integer; denied boolean=false;
begin
  if auth.uid() is null then raise exception 'A confirmed ordinary test account is required'; end if;
  select count(*) into n from public.waylo_profiles;
  if n<>1 or exists(select 1 from public.waylo_profiles where user_id<>auth.uid()) then raise exception 'Profile read isolation failed'; end if;
  update public.waylo_profiles set full_name=full_name where user_id=auth.uid();
  get diagnostics n=row_count;
  if n<>1 then raise exception 'Own profile update failed'; end if;
  update public.waylo_profiles set full_name=full_name where user_id<>auth.uid();
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Other profile update isolation failed'; end if;
  if has_table_privilege('authenticated','public.waylo_admins','insert') or has_column_privilege('authenticated','public.waylo_profiles','user_id','update') then raise exception 'Unexpected identity/admin write privilege'; end if;
  begin perform public.waylo_admin_users(1,''); exception when insufficient_privilege then denied=true; end;
  if not denied then raise exception 'Ordinary user reached the admin Users RPC'; end if;
end;
$$;
select jsonb_build_object('tested_user_id',auth.uid(),'ordinary_role_assertions',true,'own_profile_read_and_update',true,'other_profile_read_and_update_denied',true,'admin_users_rpc_denied',true,'self_promotion_privilege',false,'password_login_test',false,'writes_rolled_back',true) as permission_verification;
rollback;
