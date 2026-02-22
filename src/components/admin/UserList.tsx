import React, { useMemo, useState } from "react"
import SideTree, { type SideTreeNode } from "./SideTree"
import type { UserRowMinimal } from "../../hooks/admin/useUsers"

type UserListProps = {
  users: UserRowMinimal[]
  loading: boolean
  error: string | null
  selectedUserId?: string
  onSelectUserId?: (id: string) => void
}

export default function UserList({ users, loading, error, selectedUserId, onSelectUserId }: UserListProps) {
  const [q, setQ] = useState("")

  const nodes = useMemo<SideTreeNode[]>(() => {
    const s = q.trim().toLowerCase()
    const list = s ? users.filter((u) => u.email.toLowerCase().includes(s)) : users
    return list.map((u) => ({ id: u.id, parentId: null, label: u.email }))
  }, [users, q])

  if (loading) return <div className="admin-empty">Loading…</div>
  if (error) return <div className="admin-empty">{error}</div>

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div style={{ padding: 10, borderBottom: "1px solid var(--admin-border-subtle)" }}>
        <input
          className="admin-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search users…"
          aria-label="Search users"
        />
      </div>
      <div style={{ minHeight: 0, flex: 1 }}>
        <SideTree
          nodes={nodes}
          selectedId={selectedUserId}
          onSelectId={onSelectUserId}
          emptyLabel="No users returned by RLS."
        />
      </div>
    </div>
  )
}

