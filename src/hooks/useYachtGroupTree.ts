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
  is_archived: boolean | null
}

type YachtRow = {
  id: string
  name: string
  make_model: string | null
  location: string | null
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

      /* ---------- 0. Admin check (only admins can see "unassigned") ---------- */

      let isAdmin = false
      try {
        // Prefer authoritative helper function if present.
        const { data: rpcData, error: rpcErr } = await supabase.rpc("is_admin")
        if (!rpcErr && typeof rpcData === "boolean") {
          isAdmin = rpcData
        } else {
          // Fallback: role link lookup (in case RPC isn't deployed).
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
        // Non-fatal: default to non-admin view
        isAdmin = false
      }

      /* ---------- 1. Load groups ---------- */

      const { data: groups, error: groupError } = await supabase
        .from("groups")
        .select("id, name, parent_group_id, is_archived")
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
        .select("id, name, make_model, location")
        .order("name")

      if (cancelled) return

      if (yachtError) {
        setError(yachtError.message)
        setLoading(false)
        return
      }

      /* ---------- 4. Build lookup sets ---------- */

      // Ignore archived groups in the yacht tree (archive is an admin concern).
      const activeGroups = (groups as GroupRow[]).filter((g) => !g.is_archived)
      const activeGroupIds = new Set(activeGroups.map((g) => g.id))

      const activeLinks = (links as YachtGroupLinkRow[]).filter((l) =>
        activeGroupIds.has(l.group_id)
      )

      const assignedYachtIds = new Set(activeLinks.map((l) => l.yacht_id))

      const yachtMap = new Map<string, YachtRow>()
      ;(yachts as YachtRow[]).forEach((y) => {
        yachtMap.set(y.id, y)
      })

      /* ---------- 5. Only show groups that contain yachts ---------- */

      const groupById = new Map<string, GroupRow>()
      activeGroups.forEach((g) => groupById.set(g.id, g))

      const groupIdsWithYachts = new Set<string>(activeLinks.map((l) => l.group_id))

      // Include ancestors so nested divisions still appear.
      const relevantGroupIds = new Set<string>(groupIdsWithYachts)
      for (const gid of groupIdsWithYachts) {
        let current = groupById.get(gid)
        while (current?.parent_group_id) {
          relevantGroupIds.add(current.parent_group_id)
          current = groupById.get(current.parent_group_id)
        }
      }

      // For admins, show the full visible group tree even if empty (helps manage ownership).
      const relevantGroups = isAdmin
        ? activeGroups
        : activeGroups.filter((g) => relevantGroupIds.has(g.id))
      const relevantGroupIdSet = new Set(relevantGroups.map((g) => g.id))

      /* ---------- 6. Group nodes ---------- */

      const groupNodes: TreeNode[] =
        relevantGroups.map((g) => {
          // If the parent group isn't visible/relevant for this user,
          // promote this group to a root node to avoid a blank tree.
          const parentVisible =
            !!g.parent_group_id && relevantGroupIdSet.has(g.parent_group_id)

          return {
            id: g.id,
            parentId: parentVisible ? g.parent_group_id : null,
            label: g.name,
            nodeType: "group",
            meta: g,
          }
        })

      /* ---------- 7. Yacht nodes (assigned) ---------- */

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

      const unassignedYachts: TreeNode[] = isAdmin
        ? (yachts as YachtRow[])
            .filter((y) => !assignedYachtIds.has(y.id))
            .map((y) => ({
              id: y.id,
              parentId: UNASSIGNED_GROUP_ID,
              label: y.name,
              nodeType: "yacht",
              meta: y,
            }))
        : []

      const unassignedGroupNode: TreeNode | null =
        unassignedYachts.length > 0
          ? {
              id: UNASSIGNED_GROUP_ID,
              parentId: null,
              label: "Unassigned yachts",
              nodeType: "group",
              meta: { isVirtual: true },
            }
          : null

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

    load()

    // Reload whenever auth changes (switching personas) and when focus returns.
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
  }, [session])

  return {
    nodes,
    loading,
    error,
  }
}
