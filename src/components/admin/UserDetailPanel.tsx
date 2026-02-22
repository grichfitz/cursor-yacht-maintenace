import React, { useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"
import DetailTabs from "./DetailTabs"
import DataTable, { type DataTableColumn } from "./DataTable"
import ConfirmDialog from "./ConfirmDialog"
import RoleBadge from "./RoleBadge"
import { useAdminToast } from "./Toast"
import { useUserRoles } from "../../hooks/admin/useUserRoles"
import { useRoles } from "../../hooks/admin/useRoles"
import { useUserMemberships, type UserMembershipRow } from "../../hooks/admin/useUserMemberships"
import { useGroups } from "../../hooks/admin/useGroups"
import { useUserAccessibleGroups } from "../../hooks/admin/useUserAccessibleGroups"
import { useUserAssignedTasks } from "../../hooks/admin/useUserAssignedTasks"
import type { UserRowMinimal } from "../../hooks/admin/useUsers"

type TabId = "roles" | "memberships" | "accessible" | "tasks"

type UserDetailPanelProps = {
  selectedUser: UserRowMinimal | null
  onSelectUserId?: (id: string) => void
}

export default function UserDetailPanel({ selectedUser }: UserDetailPanelProps) {
  const toast = useAdminToast()
  const [tab, setTab] = useState<TabId>("roles")

  const userId = selectedUser?.id ?? null
  const { roles, loading: rolesLoading, error: rolesError, reload: reloadRoles } = useUserRoles(tab === "roles" ? userId : null)
  const roleCatalog = useRoles()

  const memberships = useUserMemberships(tab === "memberships" ? userId : null)
  const groupCatalog = useGroups()

  const accessible = useUserAccessibleGroups(tab === "accessible" ? userId : null)
  const assigned = useUserAssignedTasks(tab === "tasks" ? userId : null)

  const [assignOpen, setAssignOpen] = useState(false)
  const [roleId, setRoleId] = useState("")
  const [removeRoleConfirm, setRemoveRoleConfirm] = useState(false)

  const [addGroupOpen, setAddGroupOpen] = useState(false)
  const [addGroupId, setAddGroupId] = useState("")
  const [removeMembership, setRemoveMembership] = useState<UserMembershipRow | null>(null)

  const currentRoleName = useMemo(() => roles[0]?.roles?.name ?? null, [roles])

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>()
    groupCatalog.groups.forEach((g) => m.set(g.id, g.name))
    return m
  }, [groupCatalog.groups])

  const membershipColumns = useMemo<DataTableColumn<UserMembershipRow>[]>(() => {
    return [
      {
        key: "group",
        header: "Group",
        render: (r) => groupNameById.get(r.group_id) ?? r.group_id,
      },
      {
        key: "created",
        header: "Created",
        width: 220,
        render: (r) => (r.created_at ? new Date(r.created_at).toLocaleString() : "—"),
      },
      {
        key: "actions",
        header: "",
        width: 140,
        render: (r) => (
          <button type="button" className="admin-button danger" onClick={() => setRemoveMembership(r)}>
            Remove
          </button>
        ),
      },
    ]
  }, [groupNameById])

  if (!selectedUser) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
        <div className="admin-panel-header">
          <h2>User Detail</h2>
        </div>
        <div className="admin-empty">Select a user.</div>
      </div>
    )
  }

  const assignRole = async () => {
    if (!userId || !roleId) return
    const { error: err } = await supabase.from("user_roles").upsert({ user_id: userId, role_id: roleId } as any, {
      onConflict: "user_id",
    })
    if (err) {
      toast.error("RLS blocked role assign", err.message)
      return
    }
    toast.info("Role assigned")
    setAssignOpen(false)
    setRoleId("")
    await reloadRoles()
  }

  const removeRole = async () => {
    if (!userId) return
    const { error: err } = await supabase.from("user_roles").delete().eq("user_id", userId)
    if (err) {
      toast.error("RLS blocked role remove", err.message)
      return
    }
    toast.info("Role removed")
    await reloadRoles()
  }

  const addMembership = async () => {
    if (!userId || !addGroupId) return
    const { error: err } = await supabase.from("group_memberships").insert({ user_id: userId, group_id: addGroupId } as any)
    if (err) {
      toast.error("RLS blocked membership insert", err.message)
      return
    }
    toast.info("Membership added")
    setAddGroupOpen(false)
    setAddGroupId("")
    await memberships.reload()
  }

  const removeMembershipRow = async (groupId: string) => {
    if (!userId) return
    const { error: err } = await supabase.from("group_memberships").delete().eq("user_id", userId).eq("group_id", groupId)
    if (err) {
      toast.error("RLS blocked membership delete", err.message)
      return
    }
    toast.info("Membership removed")
    await memberships.reload()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div className="admin-panel-header">
        <h2>{selectedUser.email}</h2>
        <button type="button" className="admin-button" onClick={() => toast.info("RLS is authoritative", "No UI role checks. Actions may fail cleanly.")}>
          Access model
        </button>
      </div>

      <DetailTabs
        tabs={[
          { id: "roles", label: "Roles" },
          { id: "memberships", label: "Direct Group Memberships" },
          { id: "accessible", label: "Accessible Groups" },
          { id: "tasks", label: "Assigned Tasks" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div style={{ minHeight: 0, flex: 1, overflow: "auto" }}>
        {tab === "roles" ? (
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div className="admin-panel-header">
              <h2>Roles</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="admin-button" onClick={() => reloadRoles()}>
                  Refresh
                </button>
                <button type="button" className="admin-button primary" onClick={() => setAssignOpen(true)}>
                  Assign role
                </button>
                <button type="button" className="admin-button danger" onClick={() => setRemoveRoleConfirm(true)} disabled={!currentRoleName}>
                  Remove role
                </button>
              </div>
            </div>

            {rolesLoading ? <div className="admin-empty">Loading…</div> : null}
            {rolesError ? <div className="admin-empty">{rolesError}</div> : null}
            {!rolesLoading && !rolesError ? (
              <div className="admin-panel">
                <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>Current role</div>
                <div style={{ marginTop: 6 }}>
                  {currentRoleName ? <RoleBadge name={currentRoleName} /> : <span style={{ color: "var(--admin-muted)" }}>—</span>}
                </div>
              </div>
            ) : null}

            {assignOpen ? (
              <div className="admin-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Assign role">
                <div className="admin-dialog">
                  <div className="admin-dialog-header">Assign role</div>
                  <div className="admin-dialog-body">
                    {roleCatalog.loading ? <div className="admin-empty">Loading roles…</div> : null}
                    {roleCatalog.error ? <div className="admin-empty">{roleCatalog.error}</div> : null}
                    {!roleCatalog.loading && !roleCatalog.error ? (
                      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>Role</span>
                        <select className="admin-input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                          <option value="">Select role…</option>
                          {roleCatalog.roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--admin-muted)" }}>
                      UI does not block assignment. RLS decides.
                    </div>
                  </div>
                  <div className="admin-dialog-footer">
                    <button type="button" className="admin-button" onClick={() => setAssignOpen(false)}>
                      Cancel
                    </button>
                    <button type="button" className="admin-button primary" onClick={() => void assignRole()} disabled={!roleId}>
                      Assign
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <ConfirmDialog
              open={removeRoleConfirm}
              title="Remove role"
              message={`Remove role for ${selectedUser.email}?`}
              confirmLabel="Remove"
              confirmKind="danger"
              onClose={() => setRemoveRoleConfirm(false)}
              onConfirm={() => void removeRole()}
            />
          </div>
        ) : null}

        {tab === "memberships" ? (
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div className="admin-panel-header">
              <h2>Direct Group Memberships</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="admin-button" onClick={() => memberships.reload()}>
                  Refresh
                </button>
                <button type="button" className="admin-button primary" onClick={() => setAddGroupOpen(true)}>
                  Add group
                </button>
              </div>
            </div>

            {memberships.loading ? <div className="admin-empty">Loading…</div> : null}
            {memberships.error ? <div className="admin-empty">{memberships.error}</div> : null}
            {!memberships.loading && !memberships.error ? (
              <DataTable rows={memberships.memberships} columns={membershipColumns} rowKey={(r) => `${r.user_id}:${r.group_id}`} emptyLabel="No direct memberships returned by RLS." />
            ) : null}

            {addGroupOpen ? (
              <div className="admin-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Add group">
                <div className="admin-dialog">
                  <div className="admin-dialog-header">Add group</div>
                  <div className="admin-dialog-body">
                    {groupCatalog.loading ? <div className="admin-empty">Loading groups…</div> : null}
                    {groupCatalog.error ? <div className="admin-empty">{groupCatalog.error}</div> : null}
                    {!groupCatalog.loading && !groupCatalog.error ? (
                      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>Group</span>
                        <select className="admin-input" value={addGroupId} onChange={(e) => setAddGroupId(e.target.value)}>
                          <option value="">Select group…</option>
                          {groupCatalog.groups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--admin-muted)" }}>
                      Do not compute hierarchy here. This is direct membership only.
                    </div>
                  </div>
                  <div className="admin-dialog-footer">
                    <button type="button" className="admin-button" onClick={() => setAddGroupOpen(false)}>
                      Cancel
                    </button>
                    <button type="button" className="admin-button primary" onClick={() => void addMembership()} disabled={!addGroupId}>
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <ConfirmDialog
              open={!!removeMembership}
              title="Remove membership"
              message={`Remove membership in ${removeMembership ? (groupNameById.get(removeMembership.group_id) ?? removeMembership.group_id) : ""}?`}
              confirmLabel="Remove"
              confirmKind="danger"
              onClose={() => setRemoveMembership(null)}
              onConfirm={() => {
                if (!removeMembership) return
                void removeMembershipRow(removeMembership.group_id)
              }}
            />
          </div>
        ) : null}

        {tab === "accessible" ? (
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div className="admin-panel-header">
              <h2>Accessible Groups (Read-only)</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="admin-button" onClick={() => accessible.reload()}>
                  Refresh
                </button>
              </div>
            </div>

            {accessible.loading ? <div className="admin-empty">Loading…</div> : null}
            {accessible.error ? <div className="admin-empty">{accessible.error}</div> : null}
            {!accessible.loading && !accessible.error ? (
              <div className="admin-panel">
                {accessible.groups.length === 0 ? (
                  <div className="admin-empty">No accessible groups returned by RPC.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {accessible.groups.map((g) => (
                      <div key={g.group_id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="badge">{groupNameById.get(g.group_id) ?? g.group_id}</span>
                        <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>{g.group_id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "tasks" ? (
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div className="admin-panel-header">
              <h2>Assigned Tasks</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="admin-button" onClick={() => assigned.reload()}>
                  Refresh
                </button>
              </div>
            </div>

            {assigned.loading ? <div className="admin-empty">Loading…</div> : null}
            {assigned.error ? (
              <div className="admin-empty">
                {assigned.error}
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--admin-muted)" }}>
                  If this environment does not expose `assigned_user_id` on `task_assignments`, this tab will remain unavailable.
                </div>
              </div>
            ) : null}
            {!assigned.loading && !assigned.error ? (
              <div className="admin-panel">
                {assigned.tasks.length === 0 ? (
                  <div className="admin-empty">No tasks returned.</div>
                ) : (
                  <pre style={{ margin: 0, fontSize: 12, overflow: "auto" }}>
                    {JSON.stringify(assigned.tasks.slice(0, 50), null, 2)}
                  </pre>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

