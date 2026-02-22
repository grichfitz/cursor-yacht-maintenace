import React, { useMemo, useState } from "react"
import SideTree, { type SideTreeNode } from "./SideTree"
import type { GroupRowMinimal } from "../../hooks/admin/useGroups"

type GroupTreeProps = {
  groups: GroupRowMinimal[]
  loading: boolean
  error: string | null
  selectedGroupId?: string
  onSelectGroupId?: (id: string) => void
}

export default function GroupTree({
  groups,
  loading,
  error,
  selectedGroupId,
  onSelectGroupId,
}: GroupTreeProps) {
  const [q, setQ] = useState("")

  const nodes = useMemo<SideTreeNode[]>(() => {
    const s = q.trim().toLowerCase()
    const list = s ? groups.filter((g) => g.name.toLowerCase().includes(s)) : groups
    return list.map((g) => ({
      id: g.id,
      parentId: g.parent_group_id,
      label: g.name,
    }))
  }, [groups, q])

  if (loading) return <div className="admin-empty">Loading…</div>
  if (error) return <div className="admin-empty">{error}</div>

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div style={{ padding: 10, borderBottom: "1px solid var(--admin-border-subtle)" }}>
        <input
          className="admin-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search groups…"
          aria-label="Search groups"
        />
      </div>
      <div style={{ minHeight: 0, flex: 1 }}>
        <SideTree
          nodes={nodes}
          selectedId={selectedGroupId}
          onSelectId={onSelectGroupId}
          emptyLabel="No groups returned by RLS."
        />
      </div>
    </div>
  )
}

