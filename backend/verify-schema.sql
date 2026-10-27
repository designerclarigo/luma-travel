-- Read-only installation metadata checks. These do NOT prove account isolation.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('waylo_rooms','waylo_members','waylo_invites','waylo_backups')
order by c.relname;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname='public' and tablename like 'waylo_%'
order by tablename, policyname;

select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema='public' and routine_name like 'waylo_%'
order by routine_name, grantee;

select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema='public' and table_name like 'waylo_%'
order by table_name, grantee, privilege_type;

select exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='waylo_rooms') as rooms_realtime_enabled;
