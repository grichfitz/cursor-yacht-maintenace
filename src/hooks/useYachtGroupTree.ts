import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"
import { useSession } from "../auth/SessionProvider"

/* ---------- Constants ---------- */

const UNASSIGNED_GROUP_ID = "__unassigned_yachts__"

/* ---------- DB Row Types ---------- */

type GroupRow = {
  id: string
  name: string
  parent_group_id: string | null
}

type YachtRow = {
  id: string
  name: string
  group_id: string
  archived_at: string | null
}

type YachtGroupLinkRow = {
  yacht_id: string
  group_id: string
}

/* ---------- Hook ---------- */

export function useYachtGroupTree() {
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

      /* ---------- 1. Load groups ---------- */

      const { data: groups, error: groupError } = await supabase
        .from("groups")
        .select("id, name, parent_group_id")
        .order("name")

      if (cancelled) return

      if (groupError) {
        setError(groupError.message)
        setLoading(false)
        return
      }

      /* ---------- 2. Load yacht-group links ---------- */

      const { data: links, error: linkError } = await supabase
        .from("yacht_group_links")
        .select("yacht_id, group_id")

      if (cancelled) return

      if (linkError) {
        setError(linkError.message)
        setLoading(false)
        return
      }

      /* ---------- 3. Load all yachts ---------- */

      const { data: yachts, error: yachtError } = await supabase
        .from("yachts")
        .select("id, name, group_id, archived_at")
        .order("name")

      if (cancelled) return

      if (yachtError) {
        setError(yachtError.message)
        setLoading(false)
        return
      }

      /* ---------- 4. Build lookup sets ---------- */

      const groupList = (groups as GroupRow[]) ?? []
      const groupIdSet = new Set(groupList.map((g) => g.id))

      const activeLinks = ((links as YachtGroupLinkRow[]) ?? []).filter((l) => groupIdSet.has(l.group_id))

      const yachtMap = new Map<string, YachtRow>()
      ;(yachts as YachtRow[]).forEach((y) => {
        yachtMap.set(y.id, y)
      })

      /* ---------- 5. Only show groups that contain yachts ---------- */

      const groupIdsWithYachts = new Set<string>(activeLinks.map((l) => l.group_id))

      // Canonical access is flat; we only render groups that contain yachts.
      const relevantGroups = groupList.filter((g) => groupIdsWithYachts.has(g.id))

      /* ---------- 6. Group nodes ---------- */

      const groupNodes: TreeNode[] =
        relevantGroups.map((g) => {
          return {
            id: g.id,
            parentId: null,
            label: g.name,
            nodeType: "group",
            meta: g,
          }
        })

      /* ---------- 7. Yacht nodes ---------- */

      const yachtNodes: TreeNode[] =
        activeLinks
          .map((l) => {
            const yacht = yachtMap.get(l.yacht_id)
            if (!yacht) return null

            return {
              id: yacht.id,
              parentId: l.group_id,
              label: yacht.name,
              nodeType: "yacht",
              meta: yacht,
            } as TreeNode
          })
          .filter(Boolean) as TreeNode[]

      /* ---------- 8. Unassigned yachts ---------- */

      const unassignedYachts: TreeNode[] = []
      const unassignedGroupNode: TreeNode | null = null

      /* ---------- 9. Combine & publish ---------- */

      const allNodes: TreeNode[] = [
        ...groupNodes,
        ...(unassignedGroupNode ? [unassignedGroupNode] : []),
        ...yachtNodes,
        ...unassignedYachts,
      ]

      if (!cancelled) {
        setNodes(allNodes)
        setLoading(false)
      }
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    let lastReloadAt = Date.now()
    let resumeInFlight = false

    load()

    // Reload whenever auth changes (switching personas) and when focus returns.
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
