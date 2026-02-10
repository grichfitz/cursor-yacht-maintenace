import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"

const ARCHIVE_ID = "__archive__"

type CategoryRow = {
  id: string
  name: string
  parent_id: string | null
  is_archived: boolean | null
}

export function useCategoryTree() {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      // Only admins should see the Archive virtual category bucket.
      let isAdmin = false
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc("is_admin")
        if (!rpcErr && typeof rpcData === "boolean") {
          isAdmin = rpcData
        } else {
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (user) {
            const { data: rolesData, error: rolesError } = await supabase
              .from("user_role_links")
              .select("roles(name)")
              .eq("user_id", user.id)

            if (!rolesError) {
              isAdmin =
                (rolesData as any[])?.some(
                  (r: any) => r?.roles?.name?.toLowerCase() === "admin"
                ) ?? false
            }
          }
        }
      } catch {
        isAdmin = false
      }

      const { data, error: loadErr } = await supabase
        .from("task_categories")
        .select("id,name,parent_id,is_archived")
        .order("name")

      if (cancelled) return

      if (loadErr) {
        setError(loadErr.message)
        setNodes([])
        setLoading(false)
        return
      }

      const rows = (data as CategoryRow[] | null) ?? []

      const active: TreeNode[] = []
      const archived: TreeNode[] = []

      for (const c of rows) {
        const node: TreeNode = {
          id: c.id,
          label: c.name,
          parentId: c.parent_id,
          nodeType: "category",
          meta: c,
        }

        if (c.is_archived) archived.push(node)
        else active.push(node)
      }

      // Virtual Archive root (admin-only)
      if (isAdmin && archived.length) {
        active.push({
          id: ARCHIVE_ID,
          label: "Archive",
          parentId: null,
          nodeType: "category",
          meta: { isVirtual: true },
        })

        archived.forEach((a) => (a.parentId = ARCHIVE_ID))
        active.push(...archived)
      }

      setNodes(active)
      setLoading(false)
    }

    load()

    const sub = supabase.auth.onAuthStateChange(() => load())
    const onFocus = () => load()
    const onVisibility = () => {
      if (document.visibilityState === "visible") load()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      sub.data.subscription.unsubscribe()
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return { nodes, ARCHIVE_ID, loading, error }
}
