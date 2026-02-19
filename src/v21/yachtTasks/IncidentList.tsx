import React, { useMemo } from "react"
import type { TaskIncidentRow } from "./types"
import type { TaskAssignmentRow } from "../assignments/types"

function pill(label: string, style?: React.CSSProperties) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 800,
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

export function IncidentList({
  incidents,
  assignmentById,
  canComplete,
  canManage,
  onComplete,
  onEdit,
}: {
  incidents: TaskIncidentRow[]
  assignmentById: Map<string, TaskAssignmentRow>
  canComplete: boolean
  canManage: boolean
  onComplete: (incidentId: string) => void
  onEdit: (incident: TaskIncidentRow) => void
}) {
  const ordered = useMemo(() => {
    return [...incidents].sort((a, b) => {
      const ad = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY
      const bd = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY
      return ad - bd || a.created_at.localeCompare(b.created_at)
    })
  }, [incidents])

  return (
    <div className="card card-list">
      <div className="list-row" style={{ justifyContent: "space-between" }}>
        <div style={{ fontWeight: 900 }}>Incidents</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{ordered.length}</div>
      </div>

      {ordered.length === 0 ? (
        <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No incidents.</div>
      ) : (
        ordered.map((i) => {
          const a = assignmentById.get(i.assignment_id)
          const assignmentName = a?.name || i.assignment_id
          const statusStyle =
            i.status === "pending"
              ? { background: "rgba(10, 132, 255, 0.12)", borderColor: "rgba(10, 132, 255, 0.25)", color: "var(--accent-blue)" }
              : i.status === "completed"
                ? { background: "rgba(0, 200, 83, 0.10)", borderColor: "rgba(0, 200, 83, 0.25)", color: "rgba(0, 120, 60, 1)" }
                : { background: "rgba(255, 59, 48, 0.10)", borderColor: "rgba(255, 59, 48, 0.25)", color: "var(--accent-red)" }

          return (
            <div key={i.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="list-row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: 800, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span>{assignmentName}</span>
                    {pill(i.status, statusStyle)}
                    {a?.is_override ? pill("Override", { opacity: 0.85 }) : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Due {new Date(i.due_date).toLocaleDateString()}
                    {i.completed_at ? ` · Completed ${new Date(i.completed_at).toLocaleString()}` : ""}
                    {i.completed_by ? ` · By ${i.completed_by}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {canManage ? (
                    <button type="button" className="secondary" onClick={() => onEdit(i)}>
                      Edit
                    </button>
                  ) : null}
                  {canComplete && i.status === "pending" ? (
                    <button type="button" className="secondary" onClick={() => onComplete(i.id)} style={{ background: "rgba(0, 200, 83, 0.10)", borderColor: "rgba(0, 200, 83, 0.25)" }}>
                      Complete
                    </button>
                  ) : null}
                  {!canManage && !canComplete ? <div style={{ fontSize: 12, opacity: 0.7 }}>Read-only</div> : null}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

