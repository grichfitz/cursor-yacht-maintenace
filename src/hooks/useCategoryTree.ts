import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"
import { useSession } from "../auth/SessionProvider"

const ARCHIVE_ID = "__archive__"

type CategoryRow = {
  id: string
  name: string
  parent_id: string | null
  is_archived: boolean | null
}

export function useCategoryTree() {
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

  return { nodes, ARCHIVE_ID, loading, error }
}
