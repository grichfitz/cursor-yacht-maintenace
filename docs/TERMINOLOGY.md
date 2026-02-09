# ULTRA Terminology Map

This file aligns conceptual terms with actual schema names.

These names are authoritative.

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

Task Templates (standards)  
Table: task_templates

Yacht Task Instances (planned work)  
Table: yacht_tasks

Operational Tasks (reactive user-created work)  
Table: operational_tasks

Task Comments  
Table: task_comments

Task Photos  
Table: task_photos

Offline Queue  
Table: operations_queue

---

Deprecated / legacy mental models:

- user_group_links → group_users
- yacht_group_links → group_yachts
- tasks → task_templates
- task_contexts → yacht_tasks / operational_tasks
