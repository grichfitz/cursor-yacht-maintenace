-- ULTRA — Stabilisation Diagnostic
-- Diagnose group visibility + yacht visibility for a given user email.
--
-- Why:
-- - If Persona A (admin) can't see groups like Worthy Marine, `visible_group_ids()` is likely wrong/not applied.
-- - If Persona C (Worthy Marine member) sees no yachts, either:
--   - membership is missing, OR
--   - descendant traversal is broken, OR
--   - yacht_group_links are missing / pinned to unexpected groups.
--
-- How to use:
-- 1) Replace the email in the `target_email` CTE.
-- 2) Run the whole script in the Supabase SQL editor (as postgres/service).

WITH RECURSIVE
target_email AS (
  SELECT 'charlie.wattleworth@hotmail.co.uk'::text AS email
),
target_user AS (
  SELECT u.id, u.email, u.display_name
  FROM public.users u
  JOIN target_email te ON te.email = u.email
),
is_admin AS (
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_links url
    JOIN public.roles r ON r.id = url.role_id
    JOIN target_user tu ON tu.id = url.user_id
    WHERE lower(r.name) = 'admin'
  ) AS is_admin
),
direct_memberships AS (
  SELECT ugl.group_id
  FROM public.user_group_links ugl
  JOIN target_user tu ON tu.id = ugl.user_id
),
visible_groups AS (
  -- Admin: all groups
  SELECT g.id
  FROM public.groups g
  JOIN is_admin ia ON ia.is_admin = true

  UNION

  -- Non-admin: direct memberships + descendants
  SELECT g0.id
  FROM public.groups g0
  JOIN direct_memberships dm ON dm.group_id = g0.id
  JOIN is_admin ia ON ia.is_admin = false

  UNION ALL

  SELECT child.id
  FROM public.groups child
  JOIN visible_groups parent ON parent.id = child.parent_group_id
  JOIN is_admin ia ON ia.is_admin = false
),
visible_groups_dedup AS (
  SELECT DISTINCT id FROM visible_groups
),
visible_group_names AS (
  SELECT g.id, g.name, g.parent_group_id
  FROM public.groups g
  JOIN visible_groups_dedup vg ON vg.id = g.id
),
yacht_visibility AS (
  SELECT
    y.id AS yacht_id,
    y.name AS yacht_name,
    g.id AS group_id,
    g.name AS group_name
  FROM public.yachts y
  JOIN public.yacht_group_links ygl ON ygl.yacht_id = y.id
  JOIN public.groups g ON g.id = ygl.group_id
  JOIN visible_groups_dedup vg ON vg.id = g.id
)
SELECT
  'USER' AS section,
  tu.email,
  tu.display_name,
  ia.is_admin::text AS value
FROM target_user tu CROSS JOIN is_admin ia

UNION ALL

SELECT
  'DIRECT_MEMBERSHIP_GROUP' AS section,
  null::text AS email,
  null::text AS display_name,
  g.name AS value
FROM direct_memberships dm
JOIN public.groups g ON g.id = dm.group_id

UNION ALL

SELECT
  'VISIBLE_GROUP' AS section,
  null::text AS email,
  null::text AS display_name,
  vgn.name AS value
FROM visible_group_names vgn
ORDER BY section, value;

-- Summary: how many visible groups + visible yachts?
WITH RECURSIVE
target_email AS (SELECT 'charlie.wattleworth@hotmail.co.uk'::text AS email),
target_user AS (
  SELECT u.id FROM public.users u JOIN target_email te ON te.email = u.email
),
is_admin AS (
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_links url
    JOIN public.roles r ON r.id = url.role_id
    JOIN target_user tu ON tu.id = url.user_id
    WHERE lower(r.name) = 'admin'
  ) AS is_admin
),
direct_memberships AS (
  SELECT ugl.group_id
  FROM public.user_group_links ugl
  JOIN target_user tu ON tu.id = ugl.user_id
),
visible_groups AS (
  SELECT g.id FROM public.groups g JOIN is_admin ia ON ia.is_admin = true
  UNION
  SELECT g0.id
  FROM public.groups g0
  JOIN direct_memberships dm ON dm.group_id = g0.id
  JOIN is_admin ia ON ia.is_admin = false
  UNION ALL
  SELECT child.id
  FROM public.groups child
  JOIN visible_groups parent ON parent.id = child.parent_group_id
  JOIN is_admin ia ON ia.is_admin = false
),
visible_groups_dedup AS (SELECT DISTINCT id FROM visible_groups)
SELECT
  (SELECT COUNT(*) FROM visible_groups_dedup) AS visible_group_count,
  (SELECT COUNT(*) FROM public.yacht_group_links ygl JOIN visible_groups_dedup vg ON vg.id = ygl.group_id) AS visible_yacht_link_count,
  (SELECT COUNT(DISTINCT ygl.yacht_id) FROM public.yacht_group_links ygl JOIN visible_groups_dedup vg ON vg.id = ygl.group_id) AS visible_yacht_count;

-- List visible yachts (if any)
WITH RECURSIVE
target_email AS (SELECT 'charlie.wattleworth@hotmail.co.uk'::text AS email),
target_user AS (
  SELECT u.id FROM public.users u JOIN target_email te ON te.email = u.email
),
is_admin AS (
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_links url
    JOIN public.roles r ON r.id = url.role_id
    JOIN target_user tu ON tu.id = url.user_id
    WHERE lower(r.name) = 'admin'
  ) AS is_admin
),
direct_memberships AS (
  SELECT ugl.group_id
  FROM public.user_group_links ugl
  JOIN target_user tu ON tu.id = ugl.user_id
),
visible_groups AS (
  SELECT g.id FROM public.groups g JOIN is_admin ia ON ia.is_admin = true
  UNION
  SELECT g0.id
  FROM public.groups g0
  JOIN direct_memberships dm ON dm.group_id = g0.id
  JOIN is_admin ia ON ia.is_admin = false
  UNION ALL
  SELECT child.id
  FROM public.groups child
  JOIN visible_groups parent ON parent.id = child.parent_group_id
  JOIN is_admin ia ON ia.is_admin = false
),
visible_groups_dedup AS (SELECT DISTINCT id FROM visible_groups)
SELECT
  y.name AS yacht_name,
  g.name AS group_name
FROM public.yachts y
JOIN public.yacht_group_links ygl ON ygl.yacht_id = y.id
JOIN public.groups g ON g.id = ygl.group_id
JOIN visible_groups_dedup vg ON vg.id = g.id
ORDER BY g.name, y.name;

