import React, { useMemo, useState } from "react"
import GroupTree from "../../../components/admin/GroupTree"
import GroupDetailPanel from "../../../components/admin/GroupDetailPanel"
import { useGroups } from "../../../hooks/admin/useGroups"

export default function AdminGroupsPage() {
  const { groups, loading, error, reload } = useGroups()
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null
    return groups.find((g) => g.id === selectedGroupId) ?? null
  }, [groups, selectedGroupId])

  return (
    <div className="admin-split">
      <div className="admin-left">
        <div className="admin-panel-header">
          <h2>Group Tree</h2>
          <button type="button" className="admin-button" onClick={reload}>
            Refresh
          </button>
        </div>
        <div className="admin-panel" style={{ padding: 0 }}>
          <GroupTree
            groups={groups}
            loading={loading}
            error={error}
            selectedGroupId={selectedGroupId ?? undefined}
            onSelectGroupId={(id) => setSelectedGroupId(id)}
          />
        </div>
      </div>

      <div className="admin-right">
        <GroupDetailPanel
          selectedGroup={selectedGroup}
          allGroups={groups}
          onSelectGroupId={(id) => setSelectedGroupId(id)}
        />
      </div>
    </div>
  )
}

