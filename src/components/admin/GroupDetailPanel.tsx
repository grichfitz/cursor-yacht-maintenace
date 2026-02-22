import React, { useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"
import DetailTabs from "./DetailTabs"
import MembershipEditor from "./MembershipEditor"
import YachtEditor from "./YachtEditor"
import DataTable, { type DataTableColumn } from "./DataTable"
import { useAdminToast } from "./Toast"
import { useGroupRow } from "../../hooks/admin/useGroupRow"
import { useGroupChildGroupCount, useGroupDirectMemberCount, useGroupDirectYachtCount } from "../../hooks/admin/useGroupCounts"
import { useSubgroups, type GroupRowFull } from "../../hooks/admin/useSubgroups"
import type { GroupRowMinimal } from "../../hooks/admin/useGroups"

type TabId = "overview" | "members" | "yachts" | "subgroups"

type GroupDetailPanelProps = {
  selectedGroup: GroupRowMinimal | null
  allGroups: GroupRowMinimal[]
  onSelectGroupId?: (id: string) => void
}

export default function GroupDetailPanel({ selectedGroup, allGroups }: GroupDetailPanelProps) {
  const toast = useAdminToast()
  const [tab, setTab] = useState<TabId>("overview")

  const groupId = selectedGroup?.id ?? null
  const { group, loading: groupLoading, error: groupError } = useGroupRow(tab === "overview" ? groupId : null)

  const parentName = useMemo(() => {
    const pid = group?.parent_group_id ?? selectedGroup?.parent_group_id ?? null
    if (!pid) return null
    return allGroups.find((g) => g.id === pid)?.name ?? pid
  }, [allGroups, group?.parent_group_id, selectedGroup?.parent_group_id])

  const memberCount = useGroupDirectMemberCount(tab === "overview" ? groupId : null)
  const yachtCount = useGroupDirectYachtCount(tab === "overview" ? groupId : null)
  const childCount = useGroupChildGroupCount(tab === "overview" ? groupId : null)

  const subgroups = useSubgroups(tab === "subgroups" ? groupId : null)
  const [createOpen, setCreateOpen] = useState(false)
  const [rename, setRename] = useState<GroupRowFull | null>(null)
  const [name, setName] = useState("")

  const subgroupColumns = useMemo<DataTableColumn<GroupRowFull>[]>(() => {
    return [
      { key: "name", header: "Name", render: (g) => g.name },
      {
        key: "actions",
        header: "",
        width: 140,
        render: (g) => (
          <button
            type="button"
            className="admin-button"
            onClick={() => {
              setRename(g)
              setName(g.name ?? "")
            }}
          >
            Rename
          </button>
        ),
      },
    ]
  }, [])

  const createSubgroup = async () => {
    const trimmed = name.trim()
    if (!trimmed || !groupId) return
    const { error: err } = await supabase.from("groups").insert({ name: trimmed, parent_group_id: groupId } as any)
    if (err) {
      toast.error("RLS blocked subgroup create", err.message)
      return
    }
    toast.info("Subgroup created")
    setName("")
    setCreateOpen(false)
    await subgroups.reload()
  }

  const renameSubgroup = async () => {
    if (!rename) return
    const trimmed = name.trim()
    if (!trimmed) return
    const { error: err } = await supabase.from("groups").update({ name: trimmed } as any).eq("id", rename.id)
    if (err) {
      toast.error("RLS blocked subgroup rename", err.message)
      return
    }
    toast.info("Subgroup renamed")
    setRename(null)
    setName("")
    await subgroups.reload()
  }

  if (!selectedGroup) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
        <div className="admin-panel-header">
          <h2>Group Detail</h2>
        </div>
        <div className="admin-empty">Select a group.</div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div className="admin-panel-header">
        <h2>{selectedGroup.name}</h2>
        <button type="button" className="admin-button" onClick={() => toast.info("RLS is authoritative", "If an action fails, it’s an RLS block.")}>
          Access model
        </button>
      </div>

      <DetailTabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "members", label: "Members" },
          { id: "yachts", label: "Yachts" },
          { id: "subgroups", label: "Subgroups" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div style={{ minHeight: 0, flex: 1, overflow: "auto" }}>
        {tab === "overview" ? (
          <div className="admin-panel">
            {groupLoading ? <div className="admin-empty">Loading…</div> : null}
            {groupError ? <div className="admin-empty">{groupError}</div> : null}
            {!groupLoading && !groupError ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ border: "1px solid var(--admin-border-subtle)", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>Group</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{group?.name ?? selectedGroup.name}</div>
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--admin-muted)" }}>Parent group</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{parentName ?? "—"}</div>
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--admin-muted)" }}>Created</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>
                    {group?.created_at ? new Date(group.created_at).toLocaleString() : "—"}
                  </div>
                </div>

                <div style={{ border: "1px solid var(--admin-border-subtle)", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>Counts (Direct)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>Members</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{memberCount.count ?? "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>Yachts</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{yachtCount.count ?? "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>Child groups</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{childCount.count ?? "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "members" ? <MembershipEditor groupId={selectedGroup.id} /> : null}
        {tab === "yachts" ? <YachtEditor groupId={selectedGroup.id} /> : null}

        {tab === "subgroups" ? (
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div className="admin-panel-header">
              <h2>Subgroups</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="admin-button" onClick={() => subgroups.reload()}>
                  Refresh
                </button>
                <button
                  type="button"
                  className="admin-button primary"
                  onClick={() => {
                    setName("")
                    setCreateOpen(true)
                  }}
                >
                  Create subgroup
                </button>
              </div>
            </div>

            {subgroups.loading ? <div className="admin-empty">Loading…</div> : null}
            {subgroups.error ? <div className="admin-empty">{subgroups.error}</div> : null}
            {!subgroups.loading && !subgroups.error ? (
              <DataTable
                rows={subgroups.subgroups}
                columns={subgroupColumns}
                rowKey={(r) => r.id}
                emptyLabel="No subgroups returned by RLS."
              />
            ) : null}

            {(createOpen || rename) ? (
              <div className="admin-dialog-backdrop" role="dialog" aria-modal="true" aria-label={rename ? "Rename subgroup" : "Create subgroup"}>
                <div className="admin-dialog">
                  <div className="admin-dialog-header">{rename ? "Rename subgroup" : "Create subgroup"}</div>
                  <div className="admin-dialog-body">
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>Name</span>
                      <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" />
                    </label>
                  </div>
                  <div className="admin-dialog-footer">
                    <button
                      type="button"
                      className="admin-button"
                      onClick={() => {
                        setCreateOpen(false)
                        setRename(null)
                        setName("")
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="admin-button primary"
                      onClick={() => {
                        if (rename) void renameSubgroup()
                        else void createSubgroup()
                      }}
                      disabled={!name.trim()}
                    >
                      {rename ? "Save" : "Create"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

