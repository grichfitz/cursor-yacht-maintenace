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

      /* ---------- 1. Load yachts + tasks ---------- */

      const [{ data: yachts, error: yErr }, { data: tasks, error: tErr }] = await Promise.all([
        supabase.from("yachts").select("id,name").order("name"),
        supabase.from("tasks").select("id,title,status,yacht_id,category_id,due_date,template_id").limit(2000),
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

      const UNKNOWN_YACHT_NODE_ID = "__unknown_yacht__"

      const yachtNodes: TreeNode[] = yachtList.map((y) => ({
        id: `y:${y.id}`,
        parentId: null,
        label: y.name,
        nodeType: "yacht",
        meta: y,
      }))

      const hasUnknown = taskList.some((t) => !yachtNameById.has(t.yacht_id))
      const unknownNode: TreeNode | null = hasUnknown
        ? {
            id: UNKNOWN_YACHT_NODE_ID,
            parentId: null,
            label: "Unknown yacht",
            nodeType: "yacht",
            meta: { isVirtual: true },
          }
        : null

      const taskNodes: TreeNode[] = taskList.map((t) => {
        const parentId = yachtNameById.has(t.yacht_id) ? `y:${t.yacht_id}` : UNKNOWN_YACHT_NODE_ID
        return {
          id: t.id,
          parentId,
          label: t.title,
          nodeType: "task",
          meta: t,
        } as TreeNode
      })

      setNodes([...(unknownNode ? [unknownNode] : []), ...yachtNodes, ...taskNodes])
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
