import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useFocusReload } from "../hooks/useFocusReload"
import { useSession } from "../auth/SessionProvider"
import TreeDisplay, { type TreeNode } from "../components/TreeDisplay"
import { Folder, Ship } from "lucide-react"
import { pickBadgeVariant } from "../ui/badgeColors"
import { useMyRole } from "../hooks/useMyRole"
import { loadManagerScopeGroupIds } from "../utils/groupScope"

type YachtRow = {
  id: string
  name: string
  group_id: string
  archived_at: string | null
}

type GroupRow = {
  id: string
  name: string
}

export default function YachtsPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { role } = useMyRole()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [yachts, setYachts] = useState<YachtRow[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => {
      setLoading(false)
    }, 1500)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setYachts([])
        setGroups([])
        setLoading(false)
        return
      }

      const scopeGroupIds = role === "manager"
        ? await loadManagerScopeGroupIds(user.id)
        : null

      if (role === "manager" && scopeGroupIds && scopeGroupIds.length === 0) {
        setYachts([])
        setGroups([])
        setLoading(false)
        return
      }

      const loadGroups = async () => {
        let q = supabase.from("groups").select("id,name").order("name")
        if (role === "manager" && scopeGroupIds && scopeGroupIds.length > 0) {
          q = q.in("id", scopeGroupIds)
        }
        const { data: g, error: gErr } = await q
        if (gErr) throw gErr
        return (g as GroupRow[]) ?? []
      }

      let yachtsQuery = supabase
        .from("yachts")
        .select("id,name,group_id,archived_at")
        .order("name")
      if (role === "manager" && scopeGroupIds && scopeGroupIds.length > 0) {
        yachtsQuery = yachtsQuery.in("group_id", scopeGroupIds)
      }

      const [{ data, error: loadErr }, groupsList] = await Promise.all([
        yachtsQuery,
        loadGroups(),
      ])

      if (loadErr) {
        setError(loadErr.message)
        setYachts([])
        setGroups([])
        setLoading(false)
        return
      }

      setYachts((data as YachtRow[]) ?? [])
      setGroups(groupsList)
      setLoading(false)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }, [role])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await load()
    }

    run()
    const sub = supabase.auth.onAuthStateChange((event) => {
      // Avoid resume lag: token refresh fires on app resume; don't flip UI back to loading.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        run()
      }
    })

    return () => {
      cancelled = true
      sub.data.subscription.unsubscribe()
    }
  }, [session, role])

  useFocusReload(() => {
    void load()
  }, true)

  const treeNodes = useMemo(() => {
    const UNKNOWN_GROUP_ID = "__unknown_group__"

    const groupById = new Map<string, GroupRow>()
    groups.forEach((g) => groupById.set(g.id, g))

    const groupIdsWithYachts = new Set<string>()
    for (const y of yachts) {
      if (groupById.has(y.group_id)) groupIdsWithYachts.add(y.group_id)
    }

    // YM v2: groups are flat (no parent hierarchy).
    const relevantGroups = groups.filter((g) => groupIdsWithYachts.has(g.id))
    const relevantGroupIdSet = new Set(relevantGroups.map((g) => g.id))

    const yachtCountByGroupId = new Map<string, number>()
    for (const y of yachts) {
      const gid = relevantGroupIdSet.has(y.group_id) ? y.group_id : UNKNOWN_GROUP_ID
      yachtCountByGroupId.set(gid, (yachtCountByGroupId.get(gid) ?? 0) + 1)
    }

    // Build group nodes
    const groupNodes: TreeNode[] = relevantGroups.map((g) => {
      return {
        id: g.id,
        parentId: null,
        label: g.name,
        nodeType: "group",
        meta: g,
      }
    })

    // Unknown bucket if any yacht is in a group we can't see (or missing group)
    const hasUnknown = yachts.some((y) => !relevantGroupIdSet.has(y.group_id))
    const unknownGroupNode: TreeNode | null = hasUnknown
      ? {
          id: UNKNOWN_GROUP_ID,
          parentId: null,
          label: "Unknown group",
          nodeType: "group",
          meta: { isVirtual: true },
        }
      : null

    // Yacht nodes
    const yachtNodes: TreeNode[] = [...yachts]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((y) => {
        const parentId = relevantGroupIdSet.has(y.group_id) ? y.group_id : UNKNOWN_GROUP_ID
        return {
          id: `y:${y.id}`,
          parentId,
          label: y.name,
          nodeType: "yacht",
          meta: y,
        } as TreeNode
      })

    const out: TreeNode[] = [...groupNodes]
    if (unknownGroupNode) out.push(unknownGroupNode)
    out.push(...yachtNodes)

    // Attach counts to group meta for cheap renderActions
    for (const n of out) {
      if (n.nodeType !== "group") continue
      const count = yachtCountByGroupId.get(n.id) ?? 0
      n.meta = { ...(n.meta ?? {}), yachtCount: count }
    }

    return out
  }, [groups, yachts])

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <div className="screen-title">Yachts</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {yachts.length === 0 ? (
        <div className="card">
          <div style={{ padding: 2, fontSize: 13, opacity: 0.75 }}>
            No yachts visible for this account.
          </div>
        </div>
      ) : (
        <div className="card">
          <TreeDisplay
            nodes={treeNodes}
            selectedId={selectedId}
            onSelect={(node) => {
              setSelectedId(node.id)
              if (node.nodeType === "yacht") {
                const y = node.meta as YachtRow
                navigate(`/yachts/${y.id}`)
              }
            }}
            renderIcon={(node) => {
              if (node.nodeType === "group") {
                const isVirtual = !!node.meta?.isVirtual
                const variant = isVirtual ? "gray" : pickBadgeVariant(node.id)
                return (
                  <span className={`tree-icon-badge tree-icon-badge--${variant}`}>
                    <Folder size={16} />
                  </span>
                )
              }
              if (node.nodeType === "yacht") {
                const variant = pickBadgeVariant(node.parentId ?? node.id)
                return (
                  <span className={`tree-icon-badge tree-icon-badge--${variant} tree-icon-badge--solid`}>
                    <Ship size={16} />
                  </span>
                )
              }
              return null
            }}
            renderActions={(node) => {
              if (node.nodeType === "group") {
                const count = (node.meta as any)?.yachtCount as number | undefined
                return <div style={{ fontSize: 12, opacity: 0.7 }}>{count ?? 0}</div>
              }
              if (node.nodeType === "yacht") {
                return <div style={{ fontSize: 18, opacity: 0.35 }}>›</div>
              }
              return null
            }}
          />
        </div>
      )}
    </div>
  )
}

