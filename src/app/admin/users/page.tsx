import React, { useMemo, useState } from "react"
import UserList from "../../../components/admin/UserList"
import UserDetailPanel from "../../../components/admin/UserDetailPanel"
import { useUsers } from "../../../hooks/admin/useUsers"

export default function AdminUsersPage() {
  const { users, loading, error, reload } = useUsers()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null
    return users.find((u) => u.id === selectedUserId) ?? null
  }, [users, selectedUserId])

  return (
    <div className="admin-split">
      <div className="admin-left">
        <div className="admin-panel-header">
          <h2>Users</h2>
          <button type="button" className="admin-button" onClick={reload}>
            Refresh
          </button>
        </div>
        <div className="admin-panel" style={{ padding: 0 }}>
          <UserList
            users={users}
            loading={loading}
            error={error}
            selectedUserId={selectedUserId ?? undefined}
            onSelectUserId={(id) => setSelectedUserId(id)}
          />
        </div>
      </div>

      <div className="admin-right">
        <UserDetailPanel selectedUser={selectedUser} onSelectUserId={(id) => setSelectedUserId(id)} />
      </div>
    </div>
  )
}

