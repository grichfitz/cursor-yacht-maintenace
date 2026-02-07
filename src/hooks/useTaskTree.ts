import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"

/* ---------- Constants ---------- */

const UNCATEGORISED_TASKS_NAME = "Uncategorised Tasks"
const LEGACY_UNCATEGORISED_NAME = "Uncategorised"

/* ---------- DB Row Types ---------- */

type TaskCategoryRow = {
  id: string
  name: string
  parent_id: string | null
  group_id: string
  is_archived: boolean | null
}

type TaskRow = {
  id: string
  name: string
  description: string | null
}

type TaskCategoryMapRow = {
  task_id: string
  category_id: string
}

/* ---------- Hook ---------- */

export function useTaskTree() {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      /* ---------- 1. Load task categories ---------- */

      const { data: categories, error: categoryError } = await supabase
        .from("task_categories")
        .select("id, name, parent_id, group_id, is_archived")
        .order("name")

      if (categoryError) {
        setError(categoryError.message)
        setLoading(false)
        return
      }

      /* ---------- 2. Load task-category links ---------- */

      const { data: links, error: linkError } = await supabase
        .from("task_category_map")
        .select("task_id, category_id")

      if (linkError) {
        setError(linkError.message)
        setLoading(false)
        return
      }

      /* ---------- 3. Load all tasks ---------- */

      const { data: tasks, error: taskError } = await supabase
        .from("tasks")
        .select("id, name, description")
        .order("name")

      if (taskError) {
        setError(taskError.message)
        setLoading(false)
        return
      }

      const categoriesData = (categories as TaskCategoryRow[]) ?? []
      let linksData = ((links as TaskCategoryMapRow[]) ?? []).slice()

      /* ---------- 4. Build lookup maps ---------- */

      const taskMap = new Map<string, TaskRow>()
      ;(tasks as TaskRow[]).forEach((t) => {
        taskMap.set(t.id, t)
      })

      const categoryMap = new Map<string, TaskCategoryRow>()
      categoriesData.forEach((c) => {
        categoryMap.set(c.id, c)
      })

      /* ---------- 5. Assigned vs unassigned tasks ---------- */

      const assignedTaskIds = new Set(
        linksData.map((l) => l.task_id)
      )

      let unassignedTasks = (tasks as TaskRow[]).filter(
        (t) => !assignedTaskIds.has(t.id)
      )

      /* ---------- 5.5 Ensure a single Uncategorised Tasks category ---------- */

      const ensureUncategorisedTasksCategory = async (): Promise<string> => {
        const preferred = categoriesData.find(
          (c) => !c.is_archived && c.name === UNCATEGORISED_TASKS_NAME
        )
        if (preferred) return preferred.id

        const legacy = categoriesData.find(
          (c) => !c.is_archived && c.name === LEGACY_UNCATEGORISED_NAME
        )

        // If we have the legacy category, try to rename it (avoid duplicates).
        if (legacy) {
          const { error: renameErr } = await supabase
            .from("task_categories")
            .update({ name: UNCATEGORISED_TASKS_NAME })
            .eq("id", legacy.id)

          // Even if the rename fails (e.g. uniqueness conflict), we can still use it as the bucket.
          if (!renameErr) {
            legacy.name = UNCATEGORISED_TASKS_NAME
          }

          return legacy.id
        }

        // Need a group_id (schema: task_categories.group_id NOT NULL).
        let groupId = categoriesData[0]?.group_id
        if (!groupId) {
          const { data: groups, error: grpErr } = await supabase
            .from("groups")
            .select("id")
            .order("name")
            .limit(1)

          if (grpErr) throw new Error(grpErr.message)
          groupId = (groups as any[])?.[0]?.id as string | undefined
        }

        if (!groupId) {
          throw new Error("No groups exist. Create a group before categorising tasks.")
        }

        const { data: inserted, error: insertErr } = await supabase
          .from("task_categories")
          .insert({
            name: UNCATEGORISED_TASKS_NAME,
            parent_id: null,
            is_archived: false,
            group_id: groupId,
          })
          .select("id, name, parent_id, group_id, is_archived")
          .single()

        if (insertErr) throw new Error(insertErr.message)

        const newRow = inserted as TaskCategoryRow | null
        if (!newRow?.id) throw new Error("Failed to create Uncategorised Tasks category.")

        categoriesData.push(newRow)
        categoryMap.set(newRow.id, newRow)

        return newRow.id
      }

      // If any tasks are unassigned, move them into the Uncategorised Tasks bucket (real DB category).
      if (unassignedTasks.length > 0) {
        try {
          const bucketCategoryId = await ensureUncategorisedTasksCategory()

          const upsertRows: TaskCategoryMapRow[] = unassignedTasks.map((t) => ({
            task_id: t.id,
            category_id: bucketCategoryId,
          }))

          const { error: upsertErr } = await supabase
            .from("task_category_map")
            .upsert(upsertRows)

          if (upsertErr) {
            // Keep tasks visible by leaving them "unassigned" in-memory (but we won't show a virtual node anymore).
            setError(upsertErr.message)
          } else {
            linksData = [...linksData, ...upsertRows]
            unassignedTasks = []
          }
        } catch (e: any) {
          setError(e?.message || "Failed to categorise unassigned tasks.")
        }
      }

      /* ---------- 6. Determine relevant categories ---------- */

      const usedCategoryIds = new Set<string>(
        linksData.map((l) => l.category_id)
      )

      const allRelevantCategoryIds = new Set<string>(usedCategoryIds)

      usedCategoryIds.forEach((id) => {
        let current = categoryMap.get(id)
        while (current?.parent_id) {
          allRelevantCategoryIds.add(current.parent_id)
          current = categoryMap.get(current.parent_id)
        }
      })

      /* ---------- 7. Category nodes ---------- */

      const categoryNodes: TreeNode[] =
        categoriesData
          .filter((c) => allRelevantCategoryIds.has(c.id))
          .map((c) => ({
            id: c.id,
            parentId: c.parent_id,
            label: c.name,
            nodeType: "category",
            meta: c,
          }))

      /* ---------- 8. Task nodes (assigned) ---------- */

      const taskNodes: TreeNode[] =
        linksData
          .map((l) => {
            const task = taskMap.get(l.task_id)
            if (!task) return null

            return {
              id: task.id,
              parentId: l.category_id,
              label: task.name,
              nodeType: "task",
              meta: task,
            } as TreeNode
          })
          .filter(Boolean) as TreeNode[]

      /* ---------- 10. Combine & publish ---------- */

      const allNodes: TreeNode[] = [
        ...categoryNodes,
        ...taskNodes,
      ]

      setNodes(allNodes)
      setLoading(false)
    }

    load()
  }, [])

  return {
    nodes,
    loading,
    error,
  }
}
