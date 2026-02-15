import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"
import { useSession } from "../auth/SessionProvider"

type GroupRow = {
  id: string
  name: string
  parent_group_id: string | null
}

export function useGroupTree() {
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

      const { data, error } = await supabase
        .from("groups")
        .select("id, name, parent_group_id")
        .order("name")

      if (cancelled) return

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // Display hierarchy (parent_group_id) as a tree.
      // Note: access control remains flat; this is only UI presentation.
      const rows = (data as GroupRow[]) ?? []
      const idSet = new Set(rows.map((g) => g.id))
      const tree: TreeNode[] = rows.map((g) => ({
        id: g.id,
        parentId: g.parent_group_id && idSet.has(g.parent_group_id) ? g.parent_group_id : null,
        label: g.name,
        nodeType: "group",
        meta: g,
      }))

      setNodes(tree)
      setLoading(false)
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    let lastReloadAt = Date.now()
    let resumeInFlight = false

    load()

    // Refresh when the app regains focus (helps reflect recent edits like "Move Group").
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
