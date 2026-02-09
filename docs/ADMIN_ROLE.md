# Admin Role — ULTRA

Date: 2026-02-09

This document records how **admin** access works in the current ULTRA database + backend.
It is intended as an operator/developer reference for adding/removing admins.

## What “admin” means (current implementation)

- **Storage**: Admin is a *role*, not a group.
  - Role catalog: `public.roles`
  - User↔role links: `public.user_role_links (user_id, role_id)`
- **Backend usage**: `api/invite-user.ts` currently requires:
  - Caller is authenticated (Bearer token)
  - Caller has role name `admin`
  - Caller is a member of the target group (via `group_users` if present, otherwise `user_group_links`)

## What admin does *not* mean

- Admin does **not** automatically bypass RLS.
- Admin does **not** grant client-side ability to write membership tables under RLS.
  - Membership/group structure changes remain **service/admin only** (per `docs/RLS_DESIGN.md`).
  - Today, membership changes are performed via:
    - SQL editor (manual), or
    - approved backend endpoints (e.g. invite flow), when implemented.

## Add an admin (SQL editor)

1) Get the user id for the email:

```sql
select id, email
from public.users
where lower(email) = lower('someone@example.com')
limit 1;
```

2) Get the `admin` role id:

```sql
select id, name
from public.roles
where lower(name) = lower('admin')
limit 1;
```

3) Link the user to the role:

```sql
insert into public.user_role_links (user_id, role_id)
values ('USER_ID_HERE', 'ROLE_ID_HERE')
on conflict do nothing;
```

## Remove an admin (SQL editor)

```sql
delete from public.user_role_links url
using public.users u, public.roles r
where url.user_id = u.id
  and url.role_id = r.id
  and lower(u.email) = lower('someone@example.com')
  and lower(r.name) = lower('admin');
```

## Notes

- If the `admin` role row does not exist, create it intentionally (one-time):

```sql
insert into public.roles (name)
values ('admin')
on conflict (name) do nothing;
```

- If/when the schema refactor renames role tables or removes them, this document must be explicitly revisited.

