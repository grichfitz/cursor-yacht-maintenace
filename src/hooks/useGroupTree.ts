import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"

const ARCHIVE_ID = "__archive__"

type GroupRow = {
  id: string
  name: string
  parent_group_id: string | null
  is_archived: boolean | null
}

export function useGroupTree() {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      // Only admins should see the Archive virtual group.
      let isAdmin = false
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc("is_admin")
        if (!rpcErr && typeof rpcData === "boolean") {
          isAdmin = rpcData
        }
      } catch {
        isAdmin = false
      }

      const { data, error } = await supabase
        .from("groups")
        .select("id, name, parent_group_id, is_archived")
        .order("name")

      if (cancelled) return

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const active: TreeNode[] = []
      const archived: TreeNode[] = []

      for (const g of data as GroupRow[]) {
        const node: TreeNode = {
          id: g.id,
          parentId: g.parent_group_id,
          label: g.name,
          nodeType: "group",
          meta: g,
        }

        if (g.is_archived) archived.push(node)
        else active.push(node)
      }

      // Virtual Archive root (bottom), same pattern as categories
      if (isAdmin && archived.length) {
        active.push({
          id: ARCHIVE_ID,
          label: "Archive",
          parentId: null,
          nodeType: "group",
          meta: { isVirtual: true },
        })

        archived.forEach((a) => (a.parentId = ARCHIVE_ID))
        active.push(...archived)
      }

      setNodes(active)
      setLoading(false)
    }

    load()

    // Refresh when the app regains focus (helps reflect recent edits like "Move Group").
    const onFocus = () => load()
    const onVisibility = () => {
      if (document.visibilityState === "visible") load()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return {
    nodes,
    ARCHIVE_ID,
    loading,
    error,
  }
}
