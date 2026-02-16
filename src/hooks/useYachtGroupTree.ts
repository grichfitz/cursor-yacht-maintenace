import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"
import { useSession } from "../auth/SessionProvider"
import { useMyRole } from "./useMyRole"
import { loadManagerScopeGroupIds } from "../utils/groupScope"

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

/* ---------- Hook ---------- */

export function useYachtGroupTree() {
  const { session } = useSession()
  const { role } = useMyRole()
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

      const scopeGroupIds = role === "manager"
        ? await loadManagerScopeGroupIds(session.user.id)
        : null

      if (role === "manager" && scopeGroupIds && scopeGroupIds.length === 0) {
        if (!cancelled) {
          setNodes([])
          setLoading(false)
        }
        return
      }

      /* ---------- 1. Load groups ---------- */

      let gq = supabase.from("groups").select("id, name, parent_group_id").order("name")
      if (role === "manager" && scopeGroupIds && scopeGroupIds.length > 0) {
        gq = gq.in("id", scopeGroupIds)
      }

      const { data: groups, error: groupError } = await gq

      if (cancelled) return

      if (groupError) {
        setError(groupError.message)
        setLoading(false)
        return
      }

      /* ---------- 2. Load all yachts ---------- */

      let yq = supabase.from("yachts").select("id, name, group_id, archived_at").order("name")
      if (role === "manager" && scopeGroupIds && scopeGroupIds.length > 0) {
        yq = yq.in("group_id", scopeGroupIds)
      }

      const { data: yachts, error: yachtError } = await yq

      if (cancelled) return

      if (yachtError) {
        setError(yachtError.message)
        setLoading(false)
        return
      }

      /* ---------- 3. Build lookup sets ---------- */

      const groupList = (groups as GroupRow[]) ?? []
      const groupIdSet = new Set(groupList.map((g) => g.id))

      const yachtMap = new Map<string, YachtRow>()
      ;(yachts as YachtRow[]).forEach((y) => {
        yachtMap.set(y.id, y)
      })

      /* ---------- 4. Only show groups that contain yachts ---------- */

      const yachtList = (yachts as YachtRow[]) ?? []
      const groupIdsWithYachts = new Set<string>(
        yachtList.map((y) => y.group_id).filter((gid) => gid && groupIdSet.has(gid))
      )

      // Canonical access is flat; we only render groups that contain yachts.
      const relevantGroups = groupList.filter((g) => groupIdsWithYachts.has(g.id))

      /* ---------- 5. Group nodes ---------- */

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

      /* ---------- 6. Yacht nodes ---------- */

      const yachtNodes: TreeNode[] = yachtList
        .filter((y) => !!y.group_id && groupIdSet.has(y.group_id))
        .map((y) => ({
          id: y.id,
          parentId: y.group_id,
          label: y.name,
          nodeType: "yacht",
          meta: y,
        }))

      /* ---------- 8. Unassigned yachts ---------- */

      const unassignedYachts: TreeNode[] = []
      const unassignedGroupNode: TreeNode | null = null

      /* ---------- 7. Combine & publish ---------- */

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
  }, [session, role])

  return {
    nodes,
    loading,
    error,
  }
}
