import React, { useMemo, useState } from "react"
import type { TaskTemplateRow } from "./types"
import { TemplateEditorModal } from "./TemplateEditorModal"
import { supabase } from "../../lib/supabase"

export function TemplatePanel({
  categoryId,
  categoryName,
  templates,
  onReload,
}: {
  categoryId: string | null
  categoryName: string
  templates: TaskTemplateRow[]
  onReload: () => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [editTemplate, setEditTemplate] = useState<TaskTemplateRow | null>(null)
  const [mutatingId, setMutatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ordered = useMemo(() => {
    return [...templates].sort((a, b) => {
      const aa = a.archived_at ? 1 : 0
      const bb = b.archived_at ? 1 : 0
      return aa - bb || a.name.localeCompare(b.name)
    })
  }, [templates])

  const toggleArchive = async (t: TaskTemplateRow) => {
    setError(null)
    setMutatingId(t.id)
    try {
      const nextArchivedAt = t.archived_at ? null : new Date().toISOString()
      const { error: upErr } = await supabase.from("task_templates").update({ archived_at: nextArchivedAt }).eq("id", t.id)
      if (upErr) throw upErr
      onReload()
    } catch (e: any) {
      setError(e?.message || "Failed to archive template.")
    } finally {
      setMutatingId(null)
    }
  }

  const deleteTemplate = async (t: TaskTemplateRow) => {
    const ok = window.confirm("Delete this template?\n\nThis cannot be undone.")
    if (!ok) return
    setError(null)
    setMutatingId(t.id)
    try {
      const { error: delErr } = await supabase.from("task_templates").delete().eq("id", t.id)
      if (delErr) throw delErr
      onReload()
    } catch (e: any) {
      setError(e?.message || "Failed to delete template.")
    } finally {
      setMutatingId(null)
    }
  }

  if (!categoryId) {
    return (
      <div className="card" style={{ height: "100%" }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Task templates</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>Select a category to edit templates.</div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Templates</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>{categoryName}</div>
          </div>
          <button type="button" className="secondary" onClick={() => setShowCreate(true)}>
            + New template
          </button>
        </div>

        {error ? (
          <div style={{ color: "var(--accent-red)", marginTop: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        ) : null}
      </div>

      <div className="card card-list" style={{ flex: 1, overflow: "auto" }}>
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Templates</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{ordered.length}</div>
        </div>

        {ordered.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No templates in this category.</div>
        ) : (
          ordered.map((t) => (
            <div key={t.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="list-row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: 800, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span>{t.name}</span>
                    {t.archived_at ? (
                      <span style={{ fontSize: 12, opacity: 0.7, border: "1px solid var(--border-subtle)", borderRadius: 999, padding: "2px 8px" }}>
                        Archived
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {t.period ? `Period: ${t.period}` : "No period"}{t.description?.trim() ? ` · ${t.description.trim()}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button type="button" className="secondary" onClick={() => setEditTemplate(t)} disabled={mutatingId === t.id}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => toggleArchive(t)}
                    disabled={mutatingId === t.id}
                    style={{
                      color: t.archived_at ? "var(--accent-blue)" : "var(--accent-orange)",
                      background: t.archived_at ? "rgba(10, 132, 255, 0.10)" : "rgba(255, 159, 10, 0.12)",
                    }}
                  >
                    {t.archived_at ? "Unarchive" : "Archive"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => deleteTemplate(t)}
                    disabled={mutatingId === t.id}
                    style={{ color: "var(--accent-red)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate ? (
        <TemplateEditorModal
          mode="create"
          categoryId={categoryId}
          onClose={() => setShowCreate(false)}
          onSaved={onReload}
        />
      ) : null}

      {editTemplate ? (
        <TemplateEditorModal
          mode="edit"
          categoryId={categoryId}
          initial={editTemplate}
          onClose={() => setEditTemplate(null)}
          onSaved={onReload}
        />
      ) : null}
    </div>
  )
}

