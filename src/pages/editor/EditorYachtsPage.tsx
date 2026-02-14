import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import EditorNav from "./EditorNav"
import { useSession } from "../../auth/SessionProvider"
import TreeDisplay, { type TreeNode } from "../../components/TreeDisplay"

type GroupRow = { id: string; name: string; parent_group_id: string | null }
type YachtRow = { id: string; name: string; group_id: string }

export default function EditorYachtsPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [groups, setGroups] = useState<GroupRow[]>([])
  const [yachts, setYachts] = useState<YachtRow[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  const groupById = useMemo(() => {
    const m = new Map<string, GroupRow>()
    groups.forEach((g) => m.set(g.id, g))
    return m
  }, [groups])

  const childrenMap = useMemo(() => {
    const m = new Map<string | null, GroupRow[]>()
    for (const g of groups) {
      const key =
        g.parent_group_id && groupById.has(g.parent_group_id)
          ? g.parent_group_id
          : null
      const arr = m.get(key) ?? []
      arr.push(g)
      m.set(key, arr)
    }

    // Keep deterministic: sort siblings by name
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => a.name.localeCompare(b.name))
      m.set(k, arr)
    }

    return m
  }, [groups, groupById])

  const orderedGroups = useMemo(() => {
    const out: Array<{ g: GroupRow; depth: number }> = []
    const visited = new Set<string>()

    const walk = (parentId: string | null, depth: number) => {
      const kids = childrenMap.get(parentId) ?? []
      for (const g of kids) {
        if (visited.has(g.id)) continue
        visited.add(g.id)
        out.push({ g, depth })
        walk(g.id, depth + 1)
      }
    }

    walk(null, 0)

    // Defensive: if any nodes were skipped (bad data), append them at root.
    for (const g of groups) {
      if (!visited.has(g.id)) out.push({ g, depth: 0 })
    }

    return out
  }, [childrenMap, groups])

  const formatTreeLabel = (g: GroupRow) => {
    // Compact "path-ish" label for selects: Parent › Child
    const parts: string[] = [g.name]
    let cur = g
    let guard = 0
    while (cur.parent_group_id && groupById.has(cur.parent_group_id) && guard < 10) {
      const p = groupById.get(cur.parent_group_id)!
      parts.unshift(p.name)
      cur = p
      guard++
    }
    return parts.join(" › ")
  }

  const treeNodes = useMemo(() => {
    const UNKNOWN_GROUP_ID = "__unknown_group__"

    const knownGroupIds = new Set(groups.map((g) => g.id))

    const yachtCountByGroupId = new Map<string, number>()
    for (const y of yachts) {
      const gid = knownGroupIds.has(y.group_id) ? y.group_id : UNKNOWN_GROUP_ID
      yachtCountByGroupId.set(gid, (yachtCountByGroupId.get(gid) ?? 0) + 1)
    }

    const groupNodes: TreeNode[] = orderedGroups.map(({ g }) => {
      const parentId =
        g.parent_group_id && groupById.has(g.parent_group_id)
          ? g.parent_group_id
          : null
      return {
        id: g.id,
        parentId,
        label: g.name,
        nodeType: "group",
        meta: g,
      }
    })

    const unknownYachts = yachts.filter((y) => !knownGroupIds.has(y.group_id))
    const unknownGroupNode: TreeNode | null = unknownYachts.length
      ? {
          id: UNKNOWN_GROUP_ID,
          parentId: null,
          label: "Unknown group",
          nodeType: "group",
          meta: { isVirtual: true },
        }
      : null

    const yachtNodes: TreeNode[] = [...yachts]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((y) => {
        const parentId = knownGroupIds.has(y.group_id) ? y.group_id : UNKNOWN_GROUP_ID
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
  }, [groups, yachts, orderedGroups, groupById])

  const load = async () => {
    setLoading(true)
    setError(null)

    const { data: g, error: gErr } = await supabase
      .from("groups")
      .select("id,name,parent_group_id")
      .order("name")
    if (gErr) {
      setError(gErr.message)
      setLoading(false)
      return
    }

    const { data: y, error: yErr } = await supabase
      .from("yachts")
      .select("id,name,group_id")
      .order("name")
    if (yErr) {
      setError(yErr.message)
      setLoading(false)
      return
    }

    setGroups((g as GroupRow[]) ?? [])
    setYachts((y as YachtRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await load()
    }
    run()
    return () => {
      cancelled = true
    }
  }, [session])

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Editor · Yachts</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="card">
        <button
          type="button"
          className="secondary"
          style={{ width: "100%" }}
          onClick={() => navigate("/editor/yachts/new")}
        >
          New yacht
        </button>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>Yachts</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{yachts.length}</div>
        </div>

        <TreeDisplay
          nodes={treeNodes}
          selectedId={selectedId}
          onSelect={(n) => setSelectedId(n.id)}
          renderActions={(node) => {
            if (node.nodeType === "group") {
              const count = (node.meta as any)?.yachtCount as number | undefined
              return <div style={{ fontSize: 12, opacity: 0.7 }}>{count ?? 0}</div>
            }

            if (node.nodeType === "yacht") {
              const y = node.meta as YachtRow
              return (
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="secondary" onClick={() => navigate(`/editor/yachts/${y.id}`)}>
                    Edit
                  </button>
                </div>
              )
            }

            return null
          }}
        />
      </div>
    </div>
  )
}

