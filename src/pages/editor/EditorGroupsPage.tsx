import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import EditorNav from "./EditorNav"
import { useSession } from "../../auth/SessionProvider"
import TreeDisplay, { type TreeNode } from "../../components/TreeDisplay"
import { useMyRole } from "../../hooks/useMyRole"
import { loadManagerScopeGroupIds } from "../../utils/groupScope"

type GroupRow = { id: string; name: string; parent_group_id: string | null }

export default function EditorGroupsPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const { role, loading: roleLoading } = useMyRole()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  const treeNodes = useMemo(() => {
    const idSet = new Set(groups.map((g) => g.id))

    // If a parent is missing (hidden by RLS or deleted), promote to root.
    return [...groups]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((g) => ({
        id: g.id,
        parentId: g.parent_group_id && idSet.has(g.parent_group_id) ? g.parent_group_id : null,
        label: g.name,
        nodeType: "group",
        meta: g,
      }) as TreeNode)
  }, [groups])

  const load = async () => {
    setLoading(true)
    setError(null)

    try {
      let scopeIds: string[] | null = null
      if (role === "manager") {
        scopeIds = await loadManagerScopeGroupIds(session!.user.id)
      }

      let q = supabase.from("groups").select("id,name,parent_group_id").order("name")
      if (scopeIds && scopeIds.length > 0) q = q.in("id", scopeIds)
      if (scopeIds && scopeIds.length === 0) {
        setGroups([])
        setLoading(false)
        return
      }

      const { data, error: loadErr } = await q
      if (loadErr) throw loadErr

      setGroups((data as GroupRow[]) ?? [])
      setLoading(false)
    } catch (e: any) {
      setError(e?.message || "Failed to load groups.")
      setGroups([])
      setLoading(false)
    }
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
  }, [session, role])

  if (loading || roleLoading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Editor · Groups</div>
      <div className="screen-subtitle">Admin or manager.</div>

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

