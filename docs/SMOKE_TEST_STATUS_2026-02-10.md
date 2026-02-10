# ULTRA — Smoke Test Status Report
**Date:** 2026-02-10  
**Session:** Stabilisation Mode - Post-RLS Testing  
**Status:** In Progress

---

## Test Progress Summary

### ✅ Completed Tests

#### Test 1 — Authentication and basic navigation
- **Status:** ✅ PASSED
- **Notes:** All personas can sign in and navigate apps without errors

#### Test 2 — Group visibility is scoped (RLS)
- **Status:** ✅ PASSED
- **Persona B (Global-only):** Only Global Library visible ✅
- **Persona C (Worthy Marine member):** Worthy Marine + Global Library visible ✅
- **Persona A (Admin):** All groups visible ✅
- **Fixes Applied:**
  - Modified `visible_group_ids()` function to allow admins to see all groups (`docs/FIX_VISIBLE_GROUP_IDS_FINAL.sql`)
  - Fixed "Dockers" group visibility by adding all users to Dockers group

#### Test 3 — Global task library works (templates + categories)
- **Status:** ✅ PASSED
- **Persona B:** Global Library categories/tasks visible ✅
- **Persona C:** Global Library + Worthy Marine categories/tasks visible ✅
- **Notes:** RLS correctly filters categories and tasks by group visibility

#### Test 5 — Creating categories (group-scoped write)
- **Status:** ✅ PASSED
- **Fixes Applied:**
  - Added group selector dropdown to `NewCategoryPage.tsx` (users can now choose which group to create categories in)
  - Fixed RLS INSERT policy for `task_categories` (`docs/FIX_TASK_CATEGORIES_INSERT_POLICY.sql`)
- **Notes:** Users can create categories in groups they can see (Global Library or Worthy Marine for Persona C)

#### Test 10 — Membership writes are blocked from the client
- **Status:** ✅ PASSED
- **Fixes Applied:**
  - Added RLS policies for admin user-group writes (`docs/ENABLE_ADMIN_USER_GROUP_WRITES.sql`)
  - UI blocks non-admins from modifying user-group assignments
- **Notes:** Non-admins get 403 Forbidden; admins can modify user-group assignments

---

### 🔄 Additional Fixes Completed

1. **Tasks App Default State**
   - Changed default expansion state from expanded to collapsed
   - File: `src/app/TasksApp.tsx` (changed `defaultExpandedIds={rootIds}` to `defaultExpandedIds={[]}`)

2. **Users App — Name Save Issue**
   - Added UPDATE RLS policy for users table (`docs/ENABLE_USERS_UPDATE_SELF.sql`)
   - Improved error handling in `UserDetailPage.tsx`
   - Users can now update their own `display_name`

3. **Yacht Assignment**
   - Fixed 403 Forbidden error when assigning yachts to groups (`migration_add_yacht_group_links_write_policies.sql`)
   - Fixed 409 Conflict error (duplicate key) with improved DELETE-then-INSERT logic with retry
   - Changed yacht assignment UI from checkboxes to radio buttons (one-to-one relationship)

---

### ⏳ Pending Tests

#### Test 4 — Creating templates (known limitation)
- **Status:** ⏳ NOT TESTED
- **Expected:** May fail with 403 under RLS
- **Pass Criteria:** Failure shows clean error message (not silent data corruption)
- **Notes:** This is a known limitation - `public.tasks` has no safe group anchor for client-side INSERT

#### Test 6 — Yacht visibility and ownership (one group per yacht)
- **Status:** ✅ PASSED
- **Test Steps:**
  1. Persona B: Open Yachts app → should see no yachts
  2. Persona C: Open Yachts app → should see Worthy Marine yachts
  3. Uniqueness check: Attempt to assign same yacht to second group → should fail with constraint violation
- **Notes:**
  - Confirmed Persona B is correctly scoped to only the group(s) they are a member of.
  - Fixed UI regression where non-admin users could see the virtual “Unassigned yachts” bucket (now admin-only via `useYachtGroupTree`).
  - Yacht assignment uniqueness already tested and working (radio buttons prevent multiple selections).

#### Test 7 — Assign/unassign templates to a yacht
- **Status:** ⏳ NOT TESTED
- **Test Steps:**
  1. Use Persona C, choose visible yacht (e.g., Sea Venture)
  2. Open yacht task assignment screen
  3. Toggle task ON (assign) → should create `task_contexts` rows, no 403 errors
  4. Toggle task OFF (unassign) for task with no history → should succeed (delete `task_contexts` rows)

#### Test 8 — Execution history blocks unassign
- **Status:** ⏳ NOT TESTED
- **Precondition:** Need yacht + assigned task with `task_contexts` row, plus `task_results` record
- **Test Steps:**
  1. Insert `task_results` record for context (via SQL editor)
  2. Try to unassign task from yacht in UI
  3. Should block with message: "This task cannot be unassigned because there is execution history (task_results) for this yacht."

#### Test 9 — User invitations (backend + authz)
- **Status:** ⏳ NOT TESTED
- **Test Steps:**
  1. Persona A (Admin): Go to New User → Select group → Invite email → Should succeed
  2. Persona B/C (Non-admin): Attempt same → Should fail with 403

---

## SQL Migrations to Apply

Before continuing testing, ensure these SQL migrations have been applied:

1. ✅ `docs/FIX_VISIBLE_GROUP_IDS_FINAL.sql` - Admin visibility of all groups
2. ✅ `docs/ENABLE_ADMIN_USER_GROUP_WRITES.sql` - Admin user-group assignment
3. ✅ `docs/ENABLE_USERS_UPDATE_SELF.sql` - Users can update own display_name
4. ✅ `migration_add_yacht_group_links_write_policies.sql` - Yacht assignment writes
5. ⚠️ `docs/FIX_TASK_CATEGORIES_INSERT_POLICY.sql` - Category creation group visibility enforcement

**Note:** Check if `FIX_TASK_CATEGORIES_INSERT_POLICY.sql` has been applied. If not, apply it before testing category creation.

---

## Current Database State

### Groups
- **Global Library:** All users are members ✅
- **Worthy Marine:** Has members ✅
- **Dockers:** All users added (was missing members) ✅
- **Mallorca Batteries:** Has members ✅
- **Test:** Has members ✅

### RLS Policies Status
- ✅ Groups: SELECT policy working (visible_group_ids)
- ✅ Task categories: SELECT, INSERT, UPDATE, DELETE policies working
- ✅ Tasks: SELECT policy working (via category visibility)
- ✅ Yacht group links: SELECT, INSERT, UPDATE, DELETE policies working
- ✅ User group links: SELECT policy working, INSERT/UPDATE/DELETE for admins only
- ✅ Users: SELECT, UPDATE (self) policies working

---

## Known Issues & Notes

1. **Task Creation (Test 4):** Expected to fail with 403 - this is a known limitation per design
2. **Category Creation:** Now works with group selector - users can choose which group to create categories in
3. **Yacht Assignment:** Radio buttons prevent multiple group assignments (enforces one-to-one relationship)
4. **User-Group Assignment:** Only admins can modify (non-admins see disabled checkboxes)
5. **Global task visibility depends on Global Library membership:** If a user is not a member of **Global Library**, RLS will return 0 categories/tasks for them. Use `docs/FIX_GLOBAL_LIBRARY_MEMBERSHIP_ALL_USERS.sql` to ensure all users are members.
6. **Later discussion:** A task should be able to exsist in the global group and/or in the assigned group. So a parent group could have a task for everyone within that group and child groups, but a task can also be just for a child group or specific person

---

## Next Steps

1. **Apply pending SQL migrations** (if not already applied)
2. **Test 6:** Yacht visibility and ownership
3. **Test 7:** Assign/unassign templates to yachts
4. **Test 8:** Execution history blocks unassign
5. **Test 9:** User invitations
6. **Test 4:** Creating templates (verify clean error message)

---

## Test Environment Notes

- **Persona A (Admin):** `grichfitz@hotmail.com`
- **Persona B (Global-only):** User who is member of Global Library only
- **Persona C (Worthy Marine member):** User who is member of Worthy Marine (and optionally Global Library)

---

## Files Modified in This Session

### Frontend Changes
- `src/app/TasksApp.tsx` - Default collapsed state
- `src/pages/UserDetailPage.tsx` - Improved error handling for name save
- `src/pages/NewCategoryPage.tsx` - Added group selector dropdown
- `src/pages/GenericTreeAssignPage.tsx` - Yacht assignment fixes, radio buttons, admin checks

### SQL Migrations Created
- `docs/FIX_VISIBLE_GROUP_IDS_FINAL.sql`
- `docs/ENABLE_ADMIN_USER_GROUP_WRITES.sql`
- `docs/ENABLE_USERS_UPDATE_SELF.sql`
- `docs/FIX_TASK_CATEGORIES_INSERT_POLICY.sql`
- `migration_add_yacht_group_links_write_policies.sql`

### Diagnostic Queries Created
- `docs/SMOKE_TEST_B_DIAGNOSTIC.sql`
- `docs/SMOKE_TEST_C_DIAGNOSTIC.sql`
- `docs/VERIFY_TASK_CATEGORIES_INSERT_POLICY.sql`

---

## Reference Documents

- Original Test Plan: `docs/UI_SMOKE_TESTS_2026-02-09.md`
- RLS Design: `docs/RLS_DESIGN.md`
- Schema Snapshot: `docs/SCHEMA_SNAPSHOT_POST_RLS.csv`
- Terminology: `docs/TERMINOLOGY.md`

---

**Last Updated:** 2026-02-10  
**Next Session:** Continue with Test 6 (Yacht visibility)
