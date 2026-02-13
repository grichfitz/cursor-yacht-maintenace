# PHASE 1 — Roles, Editor, Operations (Cursor Build Spec)

## Objective

Refactor the app to implement:

- Role-based system (`admin`, `manager`, `crew`)
- Multi-group membership per user
- Admin-only **Editor**
- Clean operational workflow:
  Template → Instance → Assignment → Completion → Verification

Explicitly excluded for this phase:

- Scheduler
- Audit logging
- Soft deletes
- Offline queue

---

## 1. Database Structure (Supabase)

### Users

Add:

```sql
role text not null default 'crew'
Allowed values:

admin
manager
crew
Groups
groups
id
name
created_at
Group Members (many-to-many)
group_members
id
user_id (FK users.id)
group_id (FK groups.id)
Users may belong to multiple groups.

Yachts
yachts
id
name
group_id (FK groups.id)
created_at
Each yacht belongs to ONE group.

Categories
categories
id
name
Task Templates (Editor Only)
task_templates
id
name
description
category_id
interval_days
default_group_id
created_at
Task Instances (Operational)
task_instances
id
template_id
yacht_id
status
due_at
created_at
Status enum:

pending
assigned
completed
verified
Task Assignments
task_assignments
id
task_instance_id
assigned_to
assigned_by
assigned_at
Task Completions
task_completions
id
task_instance_id
user_id
notes
completed_at
Task Verifications
task_verifications
id
task_instance_id
verified_by
verified_at
2. Role Rules
Role controls capability.
Group controls visibility.

Admin
Full Editor access

Assign tasks

Verify tasks

See everything

Manager
No Editor

Can assign tasks

Can verify tasks

Can see yachts in their groups

Crew
No Editor

Cannot assign

Cannot verify

Can only see:

Yachts in their groups

Tasks assigned to them

3. Sidebar Logic
Crew:

Dashboard
Tasks
Yachts
Manager:

Dashboard
Tasks
Yachts
Reports
Admin:

Dashboard
Tasks
Yachts
Editor
Reports
Editor renders ONLY when:

role === 'admin'
4. Pages to Build
Dashboard
Assigned tasks

Overdue tasks

Task counts by status

Tasks (Personal)
Only tasks assigned to current user

Complete task

Add notes

No template editing.

Yachts
List yachts visible via group membership.

Yacht detail:

Managers/Admin see all tasks

Crew only sees assigned tasks

Editor (Admin Only)
Route:

/editor
Subpages:

/editor/yachts
/editor/groups
/editor/categories
/editor/task-templates
Each supports:

Create

Edit

Delete

Guard:

If role !== admin → redirect to Dashboard.

5. Task Flow
Assignment
Manager/Admin:

Creates task_assignments

Updates:

task_instances.status = 'assigned'
Completion
Crew:

Insert into task_completions

Then:

task_instances.status = 'completed'
Verification
Manager/Admin:

Insert into task_verifications

Then:

task_instances.status = 'verified'
Crew never verifies.

6. Supabase RLS
Use:

auth.jwt() ->> 'role'
task_templates
ALL:

role = 'admin'
groups / categories / yachts
INSERT / UPDATE / DELETE:

role = 'admin'
Yacht SELECT:

User must belong to yacht.group_id
OR role = 'admin'

task_instances SELECT
Crew:

Must be assigned_to = auth.uid()

Manager/Admin:

Full access

task_assignments INSERT
role IN ('admin','manager')
task_completions INSERT
user_id = auth.uid()
task_verifications INSERT
role IN ('admin','manager')
7. UI Rules
Never expose Editor to non-admin

Hide verify button for crew

Hide assign button for crew

Use consistent status badges

No structural editing outside Editor

8. Success Criteria
Multi-group users work

Crew only see assigned tasks

Manager assigns + verifies

Admin sees Editor

No permission leaks

No template editing outside Editor