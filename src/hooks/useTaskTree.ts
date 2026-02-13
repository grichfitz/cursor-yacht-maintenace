import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"
import { useSession } from "../auth/SessionProvider"

/* ---------- Constants ---------- */

const UNCATEGORISED_TASKS_NAME = "Uncategorised Tasks"
const UNASSIGNED_CATEGORY_ID = "__uncategorised_tasks__"

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
  lineage_id?: string | null
  version?: number | null
  is_latest?: boolean | null
}

type TaskCategoryMapRow = {
  task_id: string
  category_id: string
}

/* ---------- Hook ---------- */

export function useTaskTree() {
  const { session } = useSession()
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      const timeoutId = window.setTimeout(() => {
        if (!cancelled) setLoading(false)
      }, 1500)

      try {

      /* ---------- 1. Load task categories ---------- */

      const { data: categories, error: categoryError } = await supabase
        .from("task_categories")
        .select("id, name, parent_id, group_id, is_archived")
        .order("name")

      if (cancelled) return

      if (categoryError) {
        setError(categoryError.message)
        setLoading(false)
        return
      }

      /* ---------- 2. Load task-category links ---------- */

      const { data: links, error: linkError } = await supabase
        .from("task_category_map")
        .select("task_id, category_id")

      if (cancelled) return

      if (linkError) {
        setError(linkError.message)
        setLoading(false)
        return
      }

      /* ---------- 3. Load all tasks ---------- */

      const { data: tasks, error: taskError } = await supabase
        .from("tasks")
        .select("id, name, description, lineage_id, version, is_latest")
        .order("name")

      if (cancelled) return

      if (taskError) {
        setError(taskError.message)
        setLoading(false)
        return
      }

      const categoriesData = (categories as TaskCategoryRow[]) ?? []
      const linksData = ((links as TaskCategoryMapRow[]) ?? []).slice()

      /* ---------- 4. Build lookup maps ---------- */

      const taskMap = new Map<string, TaskRow>()
      ;(tasks as TaskRow[]).forEach((t) => {
        taskMap.set(t.id, t)
      })

      const categoryMap = new Map<string, TaskCategoryRow>()
      categoriesData.forEach((c) => {
        categoryMap.set(c.id, c)
      })

      /* ---------- 5. Assigned vs unassigned tasks (READ-ONLY) ---------- */

      const assignedTaskIds = new Set(
        linksData.map((l) => l.task_id)
      )

      const unassignedTasks = (tasks as TaskRow[]).filter(
        (t) => !assignedTaskIds.has(t.id)
      )

      /* ---------- 6. Determine relevant categories ---------- */

      const usedCategoryIds = new Set<string>(
        linksData.map((l) => l.category_id)
      )

      // If we have no links (or links are filtered by RLS), still render visible categories
      // so the Tasks screen isn't blank.
      const allRelevantCategoryIds = new Set<string>(
        usedCategoryIds.size > 0
          ? usedCategoryIds
          : categoriesData.filter((c) => !c.is_archived).map((c) => c.id)
      )

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
          .map((c) => {
            // If a category's parent isn't included (archived, hidden by RLS, or missing),
            // promote it to a root node so the tree isn't blank.
            const parentIncluded =
              !!c.parent_id && allRelevantCategoryIds.has(c.parent_id)

            return {
              id: c.id,
              parentId: parentIncluded ? c.parent_id : null,
              label: c.name,
              nodeType: "category",
              meta: c,
            }
          })

      /* ---------- 8. Task nodes (assigned) ---------- */

      const renderedCategoryIds = new Set(categoryNodes.map((n) => n.id))

      const taskNodesRaw: TreeNode[] =
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

      /* ---------- 9. Uncategorised Tasks (virtual, read-only) ---------- */

      const hasRealUncategorisedCategory = categoriesData.some(
        (c) => !c.is_archived && c.name === UNCATEGORISED_TASKS_NAME
      )

      // If any linked tasks point to a category that isn't rendered, fall back to the virtual bucket.
      const orphanedLinkedTaskNodes = taskNodesRaw.filter(
        (t) => !!t.parentId && !renderedCategoryIds.has(t.parentId)
      )

      const virtualUncategorisedNode: TreeNode | null =
        (unassignedTasks.length > 0 || orphanedLinkedTaskNodes.length > 0) && !hasRealUncategorisedCategory
          ? {
              id: UNASSIGNED_CATEGORY_ID,
              parentId: null,
              label: UNCATEGORISED_TASKS_NAME,
              nodeType: "category",
              meta: { isVirtual: true },
            }
          : null

      const taskNodes: TreeNode[] =
        virtualUncategorisedNode
          ? taskNodesRaw.map((t) =>
              t.parentId && !renderedCategoryIds.has(t.parentId)
                ? { ...t, parentId: UNASSIGNED_CATEGORY_ID }
                : t
            )
          : taskNodesRaw

      const unassignedTaskNodes: TreeNode[] =
        virtualUncategorisedNode
          ? unassignedTasks.map((t) => ({
              id: t.id,
              parentId: UNASSIGNED_CATEGORY_ID,
              label: t.name,
              nodeType: "task",
              meta: t,
            }))
          : []

      /* ---------- 10. Combine & publish ---------- */

      const allNodes: TreeNode[] = [
        ...categoryNodes,
        ...(virtualUncategorisedNode ? [virtualUncategorisedNode] : []),
        ...taskNodes,
        ...unassignedTaskNodes,
      ]

      setNodes(allNodes)
      setLoading(false)
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    let lastReloadAt = Date.now()
    let resumeInFlight = false

    load()

    const sub = supabase.auth.onAuthStateChange(() => load())
    const maybeReloadOnResume = () => {
      const now = Date.now()
      if (resumeInFlight) return
      if (now - lastReloadAt < 60_000) return
      lastReloadAt = now
      resumeInFlight = true
      Promise.resolve(load()).finally(() => {
        resumeInFlight = false
      })
    }
    const onFocus = () => maybeReloadOnResume()
    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeReloadOnResume()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      sub.data.subscription.unsubscribe()
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [session])

  return {
    nodes,
    loading,
    error,
  }
}
