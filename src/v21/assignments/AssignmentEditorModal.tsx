import React, { useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"
import { Modal } from "../ui/Modal"
import { parseOptionalJson, stringifyJsonForEdit } from "../utils/jsonText"
import type { TaskAssignmentRow } from "./types"

export function AssignmentEditorModal({
  assignment,
  onClose,
  onSaved,
}: {
  assignment: TaskAssignmentRow
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(assignment.name ?? "")
  const [description, setDescription] = useState(assignment.description ?? "")
  const [period, setPeriod] = useState(assignment.period ?? "")
  const [configText, setConfigText] = useState(() => stringifyJsonForEdit(assignment.config ?? null))

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inherited = !!assignment.yacht_id && !!assignment.parent_assignment_id && !assignment.is_override
  const overridden = !!assignment.yacht_id && !!assignment.parent_assignment_id && assignment.is_override
  const detached = !!assignment.yacht_id && !assignment.parent_assignment_id

  const lineageLabel = inherited ? "Inherited" : overridden ? "Overridden" : detached ? "Detached" : ""

  const canSave = useMemo(() => !!name.trim() && !saving, [name, saving])

  const save = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Name is required.")
      return
    }

    const parsed = parseOptionalJson(configText)
    if (!parsed.ok) {
      setError(`Config JSON error: ${parsed.error}`)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const { error: upErr } = await supabase
        .from("task_assignments")
        .update({
          name: trimmedName,
          description: description.trim() ? description.trim() : null,
          period: period.trim() ? period.trim() : null,
          config: parsed.value,
        })
        .eq("id", assignment.id)

      if (upErr) throw upErr
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.message || "Failed to save assignment.")
    } finally {
      setSaving(false)
    }
  }

  const toggleArchive = async () => {
    const nextArchivedAt = assignment.archived_at ? null : new Date().toISOString()
    const ok = window.confirm(assignment.archived_at ? "Unarchive this assignment?" : "Archive this assignment?\n\nArchived assignments are inactive.")
    if (!ok) return

    setSaving(true)
    setError(null)
    try {
      const { error: upErr } = await supabase.from("task_assignments").update({ archived_at: nextArchivedAt }).eq("id", assignment.id)
      if (upErr) throw upErr
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.message || "Failed to archive assignment.")
    } finally {
      setSaving(false)
    }
  }

  const createOverrideFork = async () => {
    if (!inherited) return
    const ok = window.confirm("Create an override fork for this yacht assignment?\n\nThis makes future propagation stop overwriting this assignment.")
    if (!ok) return

    setSaving(true)
    setError(null)
    try {
      const parentId = assignment.parent_assignment_id
      const yachtId = assignment.yacht_id
      if (!parentId || !yachtId) throw new Error("Missing parent_assignment_id or yacht_id.")

      const { error: rpcErr } = await supabase.rpc("create_yacht_assignment_override", {
        p_parent_assignment_id: parentId,
        p_yacht_id: yachtId,
      })
      if (rpcErr) throw rpcErr
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.message || "Failed to create override fork.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Assignment · ${assignment.name}`}
      onClose={() => {
        if (saving) return
        onClose()
      }}
      footer={
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="secondary" onClick={toggleArchive} disabled={saving}>
            {assignment.archived_at ? "Unarchive" : "Archive"}
          </button>
          <button type="button" className="cta-button" onClick={save} disabled={!canSave}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      }
    >
      {error ? (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {assignment.template_id ? (
          <span style={{ fontSize: 12, opacity: 0.7, border: "1px solid var(--border-subtle)", borderRadius: 999, padding: "2px 8px" }}>
            Template: {assignment.template_id}
          </span>
        ) : (
          <span style={{ fontSize: 12, opacity: 0.7, border: "1px solid var(--border-subtle)", borderRadius: 999, padding: "2px 8px" }}>
            No template
          </span>
        )}
        {assignment.archived_at ? (
          <span style={{ fontSize: 12, opacity: 0.7, border: "1px solid var(--border-subtle)", borderRadius: 999, padding: "2px 8px" }}>
            Archived
          </span>
        ) : (
          <span style={{ fontSize: 12, opacity: 0.7, border: "1px solid var(--border-subtle)", borderRadius: 999, padding: "2px 8px" }}>
            Active
          </span>
        )}
        {lineageLabel ? (
          <span style={{ fontSize: 12, opacity: 0.7, border: "1px solid var(--border-subtle)", borderRadius: 999, padding: "2px 8px" }}>
            {lineageLabel}
          </span>
        ) : null}
        {assignment.is_override ? (
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--accent-orange)", border: "1px solid rgba(255, 159, 10, 0.35)", borderRadius: 999, padding: "2px 8px", background: "rgba(255, 159, 10, 0.12)" }}>
            Override
          </span>
        ) : null}
      </div>

      {inherited ? (
        <div className="card" style={{ padding: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Override from Group</div>
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
            This assignment is inherited. To modify it permanently for this yacht, create an override fork.
          </div>
          <button type="button" className="secondary" onClick={createOverrideFork} disabled={saving} style={{ width: "100%" }}>
            Create override fork
          </button>
        </div>
      ) : null}

      <label>Name:</label>
      <input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} style={{ marginBottom: 12 }} />

      <label>Description:</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} rows={4} style={{ marginBottom: 12 }} />

      <label>Period:</label>
      <input value={period} onChange={(e) => setPeriod(e.target.value)} disabled={saving} style={{ marginBottom: 12 }} />

      <label>Config (JSON):</label>
      <textarea
        value={configText}
        onChange={(e) => setConfigText(e.target.value)}
        disabled={saving}
        rows={8}
        style={{
          marginBottom: 0,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
        }}
        placeholder='{"key":"value"}'
      />
    </Modal>
  )
}

