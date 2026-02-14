import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useFocusReload } from "../hooks/useFocusReload"
import { useSession } from "../auth/SessionProvider"
import { useMyRole } from "../hooks/useMyRole"
import TreeDisplay, { type TreeNode } from "../components/TreeDisplay"
import { Folder, Ship } from "lucide-react"
import { pickBadgeVariant } from "../ui/badgeColors"

type YachtRow = {
  id: string
  name: string
  group_id: string
  make_model: string | null
  location: string | null
}

type GroupRow = {
  id: string
  name: string
  parent_group_id: string | null
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

      const loadGroups = async () => {
        const { data: g, error: gErr } = await supabase
          .from("groups")
          .select("id,name,parent_group_id")
          .order("name")
        if (gErr) throw gErr
        return (g as GroupRow[]) ?? []
      }

      // Admin can see all yachts; everyone else is restricted to their group memberships.
      if (role !== "admin") {
        const { data: links, error: linkErr } = await supabase
          .from("user_group_links")
          .select("group_id")
          .eq("user_id", user.id)

        if (linkErr) {
          setError(linkErr.message)
          setYachts([])
          setGroups([])
          setLoading(false)
          return
        }

        const groupIds = Array.from(
          new Set(((links as any[]) ?? []).map((l) => l.group_id).filter(Boolean))
        )

        if (groupIds.length === 0) {
          setYachts([])
          setGroups([])
          setLoading(false)
          return
        }

        const [{ data, error: loadErr }, groupsList] = await Promise.all([
          supabase
            .from("yachts")
            .select("id,name,group_id,make_model,location")
            .in("group_id", groupIds)
            .order("name"),
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
        return
      }

      const [{ data, error: loadErr }, groupsList] = await Promise.all([
        supabase
          .from("yachts")
          .select("id,name,group_id,make_model,location")
          .order("name"),
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
  }, [session])

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

    // Include ancestors so subgroup yachts show under the full path.
    const relevantGroupIds = new Set<string>(groupIdsWithYachts)
    for (const gid of groupIdsWithYachts) {
      let cur = groupById.get(gid) ?? null
      let guard = 0
      while (cur?.parent_group_id && guard < 20) {
        relevantGroupIds.add(cur.parent_group_id)
        cur = groupById.get(cur.parent_group_id) ?? null
        guard++
      }
    }

    const relevantGroups = groups.filter((g) => relevantGroupIds.has(g.id))
    const relevantGroupIdSet = new Set(relevantGroups.map((g) => g.id))

    const yachtCountByGroupId = new Map<string, number>()
    for (const y of yachts) {
      const gid = relevantGroupIdSet.has(y.group_id) ? y.group_id : UNKNOWN_GROUP_ID
      yachtCountByGroupId.set(gid, (yachtCountByGroupId.get(gid) ?? 0) + 1)
    }

    // Build group nodes
    const groupNodes: TreeNode[] = relevantGroups.map((g) => {
      const parentVisible = !!g.parent_group_id && relevantGroupIdSet.has(g.parent_group_id)
      return {
        id: g.id,
        parentId: parentVisible ? g.parent_group_id : null,
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

