import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"
import { useSession } from "../auth/SessionProvider"

const ARCHIVE_ID = "__archive__"

type GroupRow = {
  id: string
  name: string
  archived_at: string | null
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
        .select("id, name, archived_at")
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
          parentId: null,
          label: g.name,
          nodeType: "group",
          meta: g,
        }

        if (g.archived_at) archived.push(node)
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
    ARCHIVE_ID,
    loading,
    error,
  }
}
