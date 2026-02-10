# Smoke Test C - Persona C (Worthy Marine Member) - Test Summary

## Test Objective
Verify that Worthy Marine members can see:
1. ✅ Global Library categories/tasks (visible to all users)
2. ✅ Worthy Marine categories/tasks (visible to Worthy Marine members)
3. ❌ Other groups' categories/tasks are NOT visible

## Frontend Query Analysis

### Tasks App (`useTaskTree.ts`)
The frontend queries rely entirely on RLS for filtering:

1. **Categories Query:**
   ```typescript
   supabase.from("task_categories")
     .select("id, name, parent_id, group_id, is_archived")
     .order("name")
   ```
   - ✅ No WHERE clause - relies on RLS policy `task_categories_select_visible_groups`
   - ✅ RLS filters by: `group_id IN (SELECT visible_group_ids())`

2. **Task-Category Map Query:**
   ```typescript
   supabase.from("task_category_map")
     .select("task_id, category_id")
   ```
   - ✅ No WHERE clause - relies on RLS policy `task_category_map_select_visible_categories`
   - ✅ RLS filters by: category_id must be in visible categories

3. **Tasks Query:**
   ```typescript
   supabase.from("tasks")
     .select("id, name, description, lineage_id, version, is_latest")
     .order("name")
   ```
   - ✅ No WHERE clause - relies on RLS policy `tasks_select_visible_groups`
   - ✅ RLS filters by: task_id must be linked to visible categories

## Expected RLS Behavior for Persona C

### Visible Groups
- ✅ Global Library (all users are members)
- ✅ Worthy Marine (Persona C is a member)
- ✅ Any descendant groups of Worthy Marine (if they exist)

### Hidden Groups
- ❌ Dockers (unless Persona C is also a member)
- ❌ Mallorca Batteries (unless Persona C is also a member)
- ❌ Test (unless Persona C is also a member)
- ❌ Other unrelated groups

## Test Steps

1. **Sign in as a Worthy Marine member** (not admin)
2. **Open Tasks App**
3. **Verify:**
   - Categories load without errors
   - Tasks load without errors
   - Global Library categories/tasks are visible
   - Worthy Marine categories/tasks are visible (if they exist)
   - Other groups' categories/tasks are NOT visible
   - No console errors

## Diagnostic Query

Run `docs/SMOKE_TEST_C_DIAGNOSTIC.sql` to check:
- Current user's visible groups
- Categories per group and their visibility status
- Tasks per group and their visibility status
- Summary counts of visible vs hidden categories/tasks
- Worthy Marine membership verification
- Whether Worthy Marine has any categories/tasks

## Potential Issues

1. **If Worthy Marine has no categories/tasks:**
   - Persona C should still see Global Library categories/tasks
   - This is expected behavior

2. **If categories/tasks from other groups appear:**
   - RLS policy may not be working correctly
   - Check `visible_group_ids()` function
   - Verify user's group membership

3. **If no categories/tasks appear:**
   - Check RLS policies are enabled
   - Verify user is authenticated
   - Check console for errors
