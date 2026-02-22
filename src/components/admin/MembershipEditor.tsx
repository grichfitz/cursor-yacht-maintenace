import React, { useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAdminToast } from "./Toast"
import ConfirmDialog from "./ConfirmDialog"
import DataTable, { type DataTableColumn } from "./DataTable"
import RoleBadge from "./RoleBadge"
import { useGroupMembers, type GroupMembershipRow } from "../../hooks/admin/useGroupMembers"
import { useUsers } from "../../hooks/admin/useUsers"

type MembershipEditorProps = {
  groupId: string
}

function roleFromMembershipRow(r: GroupMembershipRow) {
  const name = r.users?.user_roles?.roles?.name
  return typeof name === "string" && name.trim() ? name : null
}

export default function MembershipEditor({ groupId }: MembershipEditorProps) {
  const toast = useAdminToast()
  const { members, loading, error, reload } = useGroupMembers(groupId)
  const { users } = useUsers()

  const [addOpen, setAddOpen] = useState(false)
  const [addUserId, setAddUserId] = useState<string>("")
  const [remove, setRemove] = useState<{ user_id: string; email?: string } | null>(null)

  const selectableUsers = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.user_id))
    return users.filter((u) => !memberIds.has(u.id))
  }, [members, users])

  const columns = useMemo<DataTableColumn<GroupMembershipRow>[]>(() => {
    return [
      {
        key: "user",
        header: "User",
        render: (r) => r.users?.email ?? r.user_id,
      },
      {
        key: "role",
        header: "Role",
        width: 140,
        render: (r) => {
          const role = roleFromMembershipRow(r)
          return role ? <RoleBadge name={role} /> : <span style={{ color: "var(--admin-muted)" }}>—</span>
        },
      },
      {
        key: "actions",
        header: "",
        width: 120,
        render: (r) => (
          <button
            type="button"
            className="admin-button danger"
            onClick={() => setRemove({ user_id: r.user_id, email: r.users?.email ?? undefined })}
          >
            Remove
          </button>
        ),
      },
    ]
  }, [])

  const addMember = async () => {
    const uid = addUserId.trim()
    if (!uid) return
    const { error: err } = await supabase.from("group_memberships").insert({
      group_id: groupId,
      user_id: uid,
    } as any)
    if (err) {
      toast.error("RLS blocked member insert", err.message)
      return
    }
    toast.info("Member added")
    setAddUserId("")
    setAddOpen(false)
    await reload()
  }

  const removeMember = async (userId: string) => {
    const { error: err } = await supabase.from("group_memberships").delete().eq("group_id", groupId).eq("user_id", userId)
    if (err) {
      toast.error("RLS blocked member delete", err.message)
      return
    }
    toast.info("Member removed")
    await reload()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="admin-panel-header">
        <h2>Direct Members</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="admin-kbd">Enter to select · Esc to close</span>
          <button type="button" className="admin-button" onClick={() => reload()}>
            Refresh
          </button>
          <button type="button" className="admin-button primary" onClick={() => setAddOpen(true)}>
            Add member
          </button>
        </div>
      </div>

      {loading ? <div className="admin-empty">Loading…</div> : null}
      {error ? <div className="admin-empty">{error}</div> : null}
      {!loading && !error ? (
        <DataTable rows={members} columns={columns} rowKey={(r) => `${r.group_id}:${r.user_id}`} emptyLabel="No direct members returned by RLS." />
      ) : null}

      {addOpen ? (
        <div className="admin-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Add member">
          <div className="admin-dialog">
            <div className="admin-dialog-header">Add member</div>
            <div className="admin-dialog-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>User</span>
                  <select className="admin-input" value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
                    <option value="">Select user…</option>
                    {selectableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>
                  No client-side access checks. If RLS rejects, you’ll see a clean error.
                </div>
              </div>
            </div>
            <div className="admin-dialog-footer">
              <button type="button" className="admin-button" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="button" className="admin-button primary" onClick={() => void addMember()} disabled={!addUserId}>
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!remove}
        title="Remove member"
        message={`Remove ${remove?.email ?? remove?.user_id ?? ""} from this group?`}
        confirmLabel="Remove"
        confirmKind="danger"
        onClose={() => setRemove(null)}
        onConfirm={() => {
          if (!remove) return
          void removeMember(remove.user_id)
        }}
      />
    </div>
  )
}

