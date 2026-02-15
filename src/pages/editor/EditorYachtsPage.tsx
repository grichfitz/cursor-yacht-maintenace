import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import EditorNav from "./EditorNav"
import { useSession } from "../../auth/SessionProvider"
import TreeDisplay, { type TreeNode } from "../../components/TreeDisplay"

type GroupRow = { id: string; name: string }
type YachtRow = { id: string; name: string; group_id: string }

export default function EditorYachtsPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [groups, setGroups] = useState<GroupRow[]>([])
  const [yachts, setYachts] = useState<YachtRow[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  const treeNodes = useMemo(() => {
    const UNKNOWN_GROUP_ID = "__unknown_group__"

    const knownGroupIds = new Set(groups.map((g) => g.id))

    const yachtCountByGroupId = new Map<string, number>()
    for (const y of yachts) {
      const gid = knownGroupIds.has(y.group_id) ? y.group_id : UNKNOWN_GROUP_ID
      yachtCountByGroupId.set(gid, (yachtCountByGroupId.get(gid) ?? 0) + 1)
    }

    const groupNodes: TreeNode[] = [...groups]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((g) => ({
        id: g.id,
        parentId: null,
        label: g.name,
        nodeType: "group",
        meta: g,
      }))

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
  }, [groups, yachts])

  const load = async () => {
    setLoading(true)
    setError(null)

    const { data: g, error: gErr } = await supabase
      .from("groups")
      .select("id,name")
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

