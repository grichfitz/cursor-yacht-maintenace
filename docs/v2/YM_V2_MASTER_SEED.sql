-- ============================================================
-- YM V2 MASTER SEED
-- Hierarchical Groups, Yachts, Categories, Templates
-- Canonical v2 only (no legacy tables)
-- ============================================================


-- ============================================================
-- 1. ROOT GROUPS (Companies)
-- ============================================================

insert into groups (name, parent_group_id)
values
('39North', null),
('Dockers', null),
('Mallorca Batteries', null),
('Worthy Marine', null)
on conflict do nothing;


-- ============================================================
-- 2. SUBGROUPS UNDER 39North
-- ============================================================

insert into groups (name, parent_group_id)
select '39North - Engineering', g.id
from groups g
where g.name = '39North'
on conflict do nothing;

insert into groups (name, parent_group_id)
select '39North - Carpenters', g.id
from groups g
where g.name = '39North'
on conflict do nothing;


-- ============================================================
-- 3. YACHTS (Direct Group Assignment)
-- ============================================================

-- 39North Engineering Yachts
insert into yachts (name, group_id)
select 'SY Aurora', g.id
from groups g
where g.name = '39North - Engineering'
on conflict do nothing;

insert into yachts (name, group_id)
select 'MY Neptune', g.id
from groups g
where g.name = '39North - Engineering'
on conflict do nothing;

-- Dockers Yachts
insert into yachts (name, group_id)
select 'MY Titan', g.id
from groups g
where g.name = 'Dockers'
on conflict do nothing;

-- Worthy Marine Yachts
insert into yachts (name, group_id)
select 'MY Prestige', g.id
from groups g
where g.name = 'Worthy Marine'
on conflict do nothing;


-- ============================================================
-- 4. TEMPLATE CATEGORIES
-- ============================================================

insert into template_categories (name, description)
values
('Engineering - Generators', 'Generator maintenance tasks'),
('Engineering - Main Engine', 'Main engine service tasks'),
('Deck - Safety', 'Safety equipment inspections')
on conflict do nothing;


-- ============================================================
-- 5. GLOBAL TEMPLATES
-- ============================================================

insert into global_templates (title, description, interval_days)
values
('Check oil level - Port Gen', 'Inspect and log oil level', 30),
('Replace oil filter - Port Gen', 'Replace and log oil filter', 180),
('Replace raw water impeller', 'Replace impeller and test flow', 365),
('Inspect fire extinguishers', 'Check pressure and expiry', 180),
('Test emergency lights', 'Verify operation and battery', 90)
on conflict do nothing;


-- ============================================================
-- 6. LINK TEMPLATES TO CATEGORIES
-- ============================================================

-- Link generator templates
insert into category_templates (category_id, global_template_id)
select c.id, t.id
from template_categories c
join global_templates t
  on t.title in (
    'Check oil level - Port Gen',
    'Replace oil filter - Port Gen'
  )
where c.name = 'Engineering - Generators'
on conflict do nothing;

-- Link safety templates
insert into category_templates (category_id, global_template_id)
select c.id, t.id
from template_categories c
join global_templates t
  on t.title in (
    'Inspect fire extinguishers',
    'Test emergency lights'
  )
where c.name = 'Deck - Safety'
on conflict do nothing;


-- ============================================================
-- 7. ASSIGN CATEGORIES TO GROUPS (ENGINE GENERATES TASKS)
-- ============================================================

-- Assign Engineering category to 39North root
select public.assign_category_to_group(
  (select id from template_categories where name = 'Engineering - Generators'),
  (select id from groups where name = '39North')
);

-- Assign Safety category to Worthy Marine
select public.assign_category_to_group(
  (select id from template_categories where name = 'Deck - Safety'),
  (select id from groups where name = 'Worthy Marine')
);

-- ============================================================
-- END OF SEED
-- ============================================================
