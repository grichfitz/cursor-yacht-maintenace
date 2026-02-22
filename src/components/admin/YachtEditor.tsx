import React, { useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAdminToast } from "./Toast"
import ConfirmDialog from "./ConfirmDialog"
import DataTable, { type DataTableColumn } from "./DataTable"
import { useYachts, type YachtRow } from "../../hooks/admin/useYachts"

type YachtEditorProps = {
  groupId: string
}

export default function YachtEditor({ groupId }: YachtEditorProps) {
  const toast = useAdminToast()
  const { yachts, loading, error, reload } = useYachts(groupId)

  const [edit, setEdit] = useState<YachtRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<YachtRow | null>(null)

  const columns = useMemo<DataTableColumn<YachtRow>[]>(() => {
    return [
      { key: "name", header: "Name", render: (y) => y.name },
      {
        key: "status",
        header: "Status",
        width: 120,
        render: (y) =>
          y.archived_at ? <span className="badge">Archived</span> : <span className="badge">Active</span>,
      },
      {
        key: "actions",
        header: "",
        width: 340,
        render: (y) => (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="admin-button"
              onClick={() => {
                setEdit(y)
                setName(y.name ?? "")
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="admin-button"
              onClick={() => {
                void toggleArchive(y)
              }}
            >
              {y.archived_at ? "Unarchive" : "Archive"}
            </button>
            <button type="button" className="admin-button danger" onClick={() => setConfirmDelete(y)}>
              Delete
            </button>
          </div>
        ),
      },
    ]
  }, [])

  const createYacht = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const { error: err } = await supabase.from("yachts").insert({ name: trimmed, group_id: groupId } as any)
    if (err) {
      toast.error("RLS blocked yacht create", err.message)
      return
    }
    toast.info("Yacht created")
    setName("")
    setCreateOpen(false)
    await reload()
  }

  const saveEdit = async () => {
    if (!edit) return
    const trimmed = name.trim()
    if (!trimmed) return
    const { error: err } = await supabase.from("yachts").update({ name: trimmed } as any).eq("id", edit.id)
    if (err) {
      toast.error("RLS blocked yacht update", err.message)
      return
    }
    toast.info("Yacht updated")
    setEdit(null)
    setName("")
    await reload()
  }

  const toggleArchive = async (y: YachtRow) => {
    const next = y.archived_at ? null : new Date().toISOString()
    const { error: err } = await supabase.from("yachts").update({ archived_at: next } as any).eq("id", y.id)
    if (err) {
      toast.error("RLS blocked yacht archive", err.message)
      return
    }
    toast.info(y.archived_at ? "Yacht unarchived" : "Yacht archived")
    await reload()
  }

  const deleteYacht = async (id: string) => {
    const { error: err } = await supabase.from("yachts").delete().eq("id", id)
    if (err) {
      toast.error("RLS blocked yacht delete", err.message)
      return
    }
    toast.info("Yacht deleted")
    await reload()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="admin-panel-header">
        <h2>Yachts</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="admin-button" onClick={() => reload()}>
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
            Create yacht
          </button>
        </div>
      </div>

      {loading ? <div className="admin-empty">Loading…</div> : null}
      {error ? <div className="admin-empty">{error}</div> : null}
      {!loading && !error ? (
        <DataTable rows={yachts} columns={columns} rowKey={(y) => y.id} emptyLabel="No yachts returned by RLS." />
      ) : null}

      {(createOpen || edit) ? (
        <div className="admin-dialog-backdrop" role="dialog" aria-modal="true" aria-label={edit ? "Edit yacht" : "Create yacht"}>
          <div className="admin-dialog">
            <div className="admin-dialog-header">{edit ? "Edit yacht" : "Create yacht"}</div>
            <div className="admin-dialog-body">
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>Name</span>
                <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Yacht name" />
              </label>
            </div>
            <div className="admin-dialog-footer">
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  setCreateOpen(false)
                  setEdit(null)
                  setName("")
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-button primary"
                onClick={() => {
                  if (edit) void saveEdit()
                  else void createYacht()
                }}
                disabled={!name.trim()}
              >
                {edit ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete yacht"
        message={`Delete "${confirmDelete?.name ?? ""}"? This is permanent if RLS allows it.`}
        confirmLabel="Delete"
        confirmKind="danger"
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return
          void deleteYacht(confirmDelete.id)
        }}
      />
    </div>
  )
}

