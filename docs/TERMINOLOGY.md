# ULTRA Terminology Map (updated 2026-02-11)

This file aligns conceptual terms with schema names.

**Canonical architecture note:** ULTRA’s canonical model for task inheritance is defined in:
- `docs/HIERARCHICAL_TASK_ASSIGNMENTS.md`

Some older documents reference legacy table names. This file includes a legacy mapping section so `/docs` remains internally consistent during stabilisation.

---

User ↔ Group membership  
Table: group_users

Yacht ↔ Group ownership  
Table: group_yachts  
Rule: yacht_id is UNIQUE (yachts belong to one group)

Categories  
Table: categories

Category ↔ Group binding  
Table: group_categories

Task Templates (canonical definitions)  
Table: task_templates

Task Instances (per-yacht execution/completion)  
Table: task_instances

Task Assignments (group binding + inheritance + sparse overrides)  
Table: task_assignments

Operational Tasks (reactive user-created work)  
Table: operational_tasks

Task Comments  
Table: task_comments

Task Photos  
Table: task_photos

Offline Queue  
Table: operations_queue

---

Deprecated / legacy mental models / names (do not use for new architecture):

- user_group_links → group_users
- yacht_group_links → group_yachts
- tasks → task_templates
- task_contexts → task_instances (and/or legacy assignment/instance tables in older snapshots)
- yacht_tasks → task_instances
- task_context_overrides → task_assignments.override_data (canonical sparse override storage)
