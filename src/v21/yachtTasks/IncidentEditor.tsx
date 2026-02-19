import React, { useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import { Modal } from "../ui/Modal"
import type { TaskIncidentRow, TaskIncidentStatus } from "./types"

type AssignmentOption = { id: string; name: string; archived_at: string | null }

export function IncidentEditor({
  yachtId,
  assignments,
  mode,
  initial,
  onClose,
  onSaved,
}: {
  yachtId: string
  assignments: AssignmentOption[]
  mode: "create" | "edit"
  initial?: TaskIncidentRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const { session } = useSession()

  const [assignmentId, setAssignmentId] = useState(initial?.assignment_id ?? assignments.find((a) => !a.archived_at)?.id ?? "")
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "")
  const [status, setStatus] = useState<TaskIncidentStatus>(initial?.status ?? "pending")

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = useMemo(() => {
    if (saving) return false
    if (!assignmentId) return false
    if (!dueDate) return false
    return true
  }, [saving, assignmentId, dueDate])

  const save = async () => {
    if (!session?.user?.id) return
    if (!assignmentId || !dueDate) return

    setSaving(true)
    setError(null)
    try {
      if (mode === "create") {
        const { error: rpcErr } = await supabase.rpc("create_task_incident", {
          p_assignment_id: assignmentId,
          p_yacht_id: yachtId,
          p_due_date: dueDate,
        })
        if (rpcErr) throw rpcErr
      } else {
        if (!initial?.id) throw new Error("Missing incident id.")
        const patch: any = { status }
        // Managers/admin can manage status; completion fields are set by completion action elsewhere.
        if (dueDate) patch.due_date = dueDate
        if (assignmentId) patch.assignment_id = assignmentId
        const { error: upErr } = await supabase.from("task_incidents").update(patch).eq("id", initial.id)
        if (upErr) throw upErr
      }

      onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.message || "Failed to save incident.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={mode === "create" ? "New incident" : "Edit incident"}
      onClose={() => {
        if (saving) return
        onClose()
      }}
      footer={
        <button type="button" className="cta-button" onClick={save} disabled={!canSave}>
          {saving ? "Saving…" : "Save"}
        </button>
      }
    >
      {error ? <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div> : null}

      <label>Assignment:</label>
      <select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} disabled={saving} style={{ marginBottom: 12 }}>
        <option value="">Select assignment…</option>
        {assignments.map((a) => (
          <option key={a.id} value={a.id} disabled={!!a.archived_at}>
            {a.name || a.id}{a.archived_at ? " (archived)" : ""}
          </option>
        ))}
      </select>

      <label>Due date:</label>
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={saving} style={{ marginBottom: 12 }} />

      {mode === "edit" ? (
        <>
          <label>Status:</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as TaskIncidentStatus)} disabled={saving} style={{ marginBottom: 0 }}>
            <option value="pending">pending</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </>
      ) : null}
    </Modal>
  )
}

