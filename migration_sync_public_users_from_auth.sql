-- ULTRA: React renders. SQL scopes.
-- Ensure public.users is an app directory mirrored from Supabase Auth users.
--
-- What this does:
-- 1) Backfills public.users from auth.users (existing accounts)
-- 2) Installs a trigger so future auth user inserts/updates upsert into public.users
--
-- Safe to run multiple times (uses create/replace + drop trigger if exists).

begin;

-- 1) Trigger function: upsert into public.users whenever an auth user is created/updated.
create or replace function public.handle_auth_user_upsert()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', null)
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.users.display_name);

  return new;
end;
$$;

-- 2) Triggers on auth.users
drop trigger if exists on_auth_user_upsert_to_public_users_insert on auth.users;
create trigger on_auth_user_upsert_to_public_users_insert
after insert on auth.users
for each row execute function public.handle_auth_user_upsert();

drop trigger if exists on_auth_user_upsert_to_public_users_update on auth.users;
create trigger on_auth_user_upsert_to_public_users_update
after update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_auth_user_upsert();

-- 3) Backfill existing auth users into the public directory
insert into public.users (id, email, display_name)
select
  u.id,
  u.email,
  nullif(u.raw_user_meta_data->>'display_name', '')
from auth.users u
on conflict (id) do update
  set email = excluded.email,
      display_name = coalesce(excluded.display_name, public.users.display_name);

-- Optional: if RLS is enabled on public.users in your project, you likely want
-- authenticated users to be able to read the directory for assignment UI.
-- (If RLS is disabled, this policy is harmless.)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_select_authenticated'
  ) then
    create policy users_select_authenticated
      on public.users
      for select
      to authenticated
      using (true);
  end if;
end $$;

commit;

