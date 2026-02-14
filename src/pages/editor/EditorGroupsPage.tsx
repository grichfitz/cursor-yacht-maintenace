import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import EditorNav from "./EditorNav"
import { useSession } from "../../auth/SessionProvider"
import TreeDisplay, { type TreeNode } from "../../components/TreeDisplay"

type GroupRow = { id: string; name: string; parent_group_id: string | null }

export default function EditorGroupsPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<GroupRow[]>([])
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

  const treeNodes = useMemo(() => {
    return orderedGroups.map(({ g }) => {
      const parentId =
        g.parent_group_id && groupById.has(g.parent_group_id)
          ? g.parent_group_id
          : null
      const node: TreeNode = {
        id: g.id,
        parentId,
        label: g.name,
        nodeType: "group",
        meta: g,
      }
      return node
    })
  }, [orderedGroups, groupById])

  const load = async () => {
    setLoading(true)
    setError(null)

    const { data, error: loadErr } = await supabase
      .from("groups")
      .select("id,name,parent_group_id")
      .order("name")

    if (loadErr) {
      setError(loadErr.message)
      setGroups([])
      setLoading(false)
      return
    }

    setGroups((data as GroupRow[]) ?? [])
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
      <div className="screen-title">Editor · Groups</div>
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
          onClick={() => navigate("/editor/groups/new")}
        >
          New group
        </button>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>Groups</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{groups.length}</div>
        </div>

        <TreeDisplay
          nodes={treeNodes}
          selectedId={selectedId}
          onSelect={(n) => setSelectedId(n.id)}
          renderActions={(node) => {
            const g = (node.meta as GroupRow) ?? null
            if (!g) return null
            return (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="secondary" onClick={() => navigate(`/editor/groups/${g.id}`)}>
                  Edit
                </button>
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}

