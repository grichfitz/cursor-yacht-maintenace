import React, { useMemo } from "react"
import type { TaskAssignmentRow } from "./types"

function pill(label: string, style?: React.CSSProperties) {
  return (
    <span
      style={{
        fontSize: 12,
        opacity: 0.75,
        border: "1px solid var(--border-subtle)",
        borderRadius: 999,
        padding: "2px 8px",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
    </span>
  )
}

export function AssignmentList({
  assignments,
  templateNameById,
  canEdit,
  onEdit,
}: {
  assignments: TaskAssignmentRow[]
  templateNameById: Map<string, string>
  canEdit: boolean
  onEdit: (a: TaskAssignmentRow) => void
}) {
  const ordered = useMemo(() => {
    return [...assignments].sort((a, b) => {
      const aa = a.archived_at ? 1 : 0
      const bb = b.archived_at ? 1 : 0
      return aa - bb || a.name.localeCompare(b.name)
    })
  }, [assignments])

  return (
    <div className="card card-list">
      <div className="list-row" style={{ justifyContent: "space-between" }}>
        <div style={{ fontWeight: 900 }}>Assignments</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{ordered.length}</div>
      </div>

      {ordered.length === 0 ? (
        <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No assignments in this scope.</div>
      ) : (
        ordered.map((a) => {
          const inherited = !!a.yacht_id && !!a.parent_assignment_id && !a.is_override
          const overridden = !!a.yacht_id && !!a.parent_assignment_id && a.is_override
          const detached = !!a.yacht_id && !a.parent_assignment_id

          const templateLabel = a.template_id ? templateNameById.get(a.template_id) || a.template_id : "—"

          return (
            <div key={a.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="list-row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: 800, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span>{a.name}</span>
                    {a.archived_at ? pill("Archived") : pill("Active", { opacity: 0.65 })}
                    {a.is_override ? pill("Override", { color: "var(--accent-orange)", borderColor: "rgba(255,159,10,0.35)", background: "rgba(255,159,10,0.12)", opacity: 1 }) : null}
                    {inherited ? pill("Inherited") : overridden ? pill("Overridden") : detached ? pill("Detached") : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Template: {templateLabel}
                    {a.period ? ` · Period: ${a.period}` : ""}
                    {a.description?.trim() ? ` · ${a.description.trim()}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {canEdit ? (
                    <button type="button" className="secondary" onClick={() => onEdit(a)}>
                      Edit
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Read-only</div>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

