1️⃣ Core Schema Overview

Tables:

roles

user_roles

groups (hierarchical)

group_memberships

yachts

yacht_owners

template_categories

global_templates

category_templates

group_templates

yacht_tasks

2️⃣ Role Model

Admin

Global

Can create global_templates

Full visibility

Manager

Scoped to subtree

Can assign global_templates to groups

Can edit group_templates (fork layer)

Cannot create global_templates

Crew

Scoped to subtree

Can complete tasks

Cannot approve tasks

Owner

Scoped to yacht

Can view approved tasks only

3️⃣ Status Lifecycle
open → pending_review → approved


Completion:

complete_yacht_task()

Approval:

approve_yacht_task()

Recurrence:

New open instance created at completed_at + interval_days

4️⃣ Template Fork Model

Global → Group → Yacht Tasks

Global templates immutable except by Admin.

Assigning to group:

Creates group_template fork

Generates yacht_tasks for all yachts in group

Managers edit only group_template fields.

5️⃣ RLS Principles

Frontend does not filter by role.

RLS is sole authority for scope.

Helper functions are security definer.

Self-read policies required for tables used in helper functions.

6️⃣ Explicit Non-Goals

No direct template-based yacht_tasks insert

No legacy task engine

No frontend scope enforcement

No multiple status models
