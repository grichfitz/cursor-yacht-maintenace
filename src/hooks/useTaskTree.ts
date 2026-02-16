import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"
import { useSession } from "../auth/SessionProvider"

type TaskRow = {
  id: string
  title: string
  status: string
  yacht_id: string
  category_id: string | null
  due_date: string | null
  template_id: string | null
}

type YachtRow = { id: string; name: string }
type CategoryRow = { id: string; name: string; parent_category_id: string | null }

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

      /* ---------- 1. Load categories (with backward compat) ---------- */

      const loadCategories = async (): Promise<CategoryRow[]> => {
        const { data, error: loadErr } = await supabase
          .from("categories")
          .select("id,name,parent_category_id")
          .order("name")

        if (!loadErr) return (data as CategoryRow[]) ?? []

        const msg = String(loadErr.message || "")
        const missingParentCol =
          msg.includes("parent_category_id") && msg.toLowerCase().includes("does not exist")
        if (!missingParentCol) throw loadErr

        const { data: flat, error: flatErr } = await supabase
          .from("categories")
          .select("id,name")
          .order("name")

        if (flatErr) throw flatErr

        return (((flat as any[]) ?? []) as Array<{ id: string; name: string }>).map((c) => ({
          id: c.id,
          name: c.name,
          parent_category_id: null,
        }))
      }

      /* ---------- 2. Load categories + yachts + tasks ---------- */

      const [{ data: yachts, error: yErr }, { data: tasks, error: tErr }, categories] = await Promise.all([
        supabase.from("yachts").select("id,name").order("name"),
        supabase
          .from("tasks")
          .select("id,title,status,yacht_id,category_id,due_date,template_id")
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(2000),
        loadCategories(),
      ])

      if (cancelled) return

      const firstErr = yErr || tErr
      if (firstErr) {
        setError(firstErr.message)
        setLoading(false)
        return
      }

      const yachtList = (yachts as YachtRow[]) ?? []
      const taskList = (tasks as TaskRow[]) ?? []

      const yachtNameById = new Map<string, string>()
      yachtList.forEach((y) => yachtNameById.set(y.id, y.name))

      const categoriesList = (categories as CategoryRow[]) ?? []
      const categoryById = new Map<string, CategoryRow>()
      categoriesList.forEach((c) => categoryById.set(c.id, c))

      const referencedCategoryIds = new Set<string>()
      let hasUnassigned = false
      let hasUnknownCategory = false

      for (const t of taskList) {
        if (!t.category_id) {
          hasUnassigned = true
          continue
        }
        if (!categoryById.has(t.category_id)) {
          hasUnknownCategory = true
          continue
        }
        referencedCategoryIds.add(t.category_id)
      }

      // Include category ancestors (display-only). Guard to avoid loops.
      const visibleCategoryIds = new Set<string>(referencedCategoryIds)
      for (const id of Array.from(referencedCategoryIds)) {
        let cur = categoryById.get(id) ?? null
        let guard = 0
        while (cur?.parent_category_id && categoryById.has(cur.parent_category_id) && guard < 20) {
          visibleCategoryIds.add(cur.parent_category_id)
          cur = categoryById.get(cur.parent_category_id) ?? null
          guard++
        }
      }

      const UNASSIGNED_CATEGORY_NODE_ID = "__unassigned_category__"
      const UNKNOWN_CATEGORY_NODE_ID = "__unknown_category__"

      const categoryNodes: TreeNode[] = categoriesList
        .filter((c) => visibleCategoryIds.has(c.id))
        .map((c) => ({
          id: `c:${c.id}`,
          parentId:
            c.parent_category_id && visibleCategoryIds.has(c.parent_category_id)
              ? `c:${c.parent_category_id}`
              : null,
          label: c.name,
          nodeType: "category",
          meta: c,
        }))
        .sort((a, b) => a.label.localeCompare(b.label))

      const virtualCategoryNodes: TreeNode[] = [
        ...(hasUnassigned
          ? [
              {
                id: UNASSIGNED_CATEGORY_NODE_ID,
                parentId: null,
                label: "Unassigned",
                nodeType: "category",
                meta: { isVirtual: true },
              } satisfies TreeNode,
            ]
          : []),
        ...(hasUnknownCategory
          ? [
              {
                id: UNKNOWN_CATEGORY_NODE_ID,
                parentId: null,
                label: "Unknown category",
                nodeType: "category",
                meta: { isVirtual: true },
              } satisfies TreeNode,
            ]
          : []),
      ]

      const taskNodes: TreeNode[] = taskList.map((t) => {
        const parentId = !t.category_id
          ? UNASSIGNED_CATEGORY_NODE_ID
          : categoryById.has(t.category_id)
            ? `c:${t.category_id}`
            : UNKNOWN_CATEGORY_NODE_ID

        return {
          id: t.id,
          parentId,
          label: t.title,
          nodeType: "task",
          meta: t,
        } as TreeNode
      })

      setNodes([...virtualCategoryNodes, ...categoryNodes, ...taskNodes])
      setLoading(false)
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    let lastReloadAt = Date.now()
    let resumeInFlight = false

    load()

    const sub = supabase.auth.onAuthStateChange((event) => {
      // Avoid resume lag: token refresh fires on app resume; don't flip UI back to loading.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load()
      }
    })
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
