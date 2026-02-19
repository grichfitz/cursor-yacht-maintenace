import React, { useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"
import { Modal } from "../ui/Modal"
import { parseOptionalJson, stringifyJsonForEdit } from "../utils/jsonText"
import type { TaskTemplateRow } from "./types"

export function TemplateEditorModal({
  mode,
  categoryId,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit"
  categoryId: string
  initial?: TaskTemplateRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [period, setPeriod] = useState(initial?.period ?? "")
  const [metadataText, setMetadataText] = useState(() => stringifyJsonForEdit(initial?.metadata ?? null))

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const title = mode === "create" ? "New task template" : "Edit task template"

  const canSave = useMemo(() => !!name.trim() && !saving, [name, saving])

  const save = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Name is required.")
      return
    }

    const parsed = parseOptionalJson(metadataText)
    if (!parsed.ok) {
      setError(`Metadata JSON error: ${parsed.error}`)
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (mode === "create") {
        const { error: insErr } = await supabase.from("task_templates").insert({
          global_category_id: categoryId,
          name: trimmedName,
          description: description.trim() ? description.trim() : null,
          period: period.trim() ? period.trim() : null,
          metadata: parsed.value,
        })
        if (insErr) throw insErr
      } else {
        if (!initial?.id) throw new Error("Missing template id.")
        const { error: upErr } = await supabase
          .from("task_templates")
          .update({
            name: trimmedName,
            description: description.trim() ? description.trim() : null,
            period: period.trim() ? period.trim() : null,
            metadata: parsed.value,
          })
          .eq("id", initial.id)
        if (upErr) throw upErr
      }

      onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.message || "Failed to save template.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={title}
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
      {error ? (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      ) : null}

      <label>Name:</label>
      <input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} style={{ marginBottom: 12 }} />

      <label>Description:</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={saving}
        rows={4}
        style={{ marginBottom: 12 }}
      />

      <label>Period:</label>
      <input value={period} onChange={(e) => setPeriod(e.target.value)} disabled={saving} style={{ marginBottom: 12 }} placeholder="e.g. monthly, quarterly, 90d…" />

      <label>Metadata (JSON):</label>
      <textarea
        value={metadataText}
        onChange={(e) => setMetadataText(e.target.value)}
        disabled={saving}
        rows={8}
        style={{ marginBottom: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace" }}
        placeholder='{"key":"value"}'
      />
    </Modal>
  )
}

