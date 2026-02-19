import React, { useMemo, useState } from "react"
import { Modal } from "../ui/Modal"
import type { AssignmentScope } from "./ContextSelector"

export function PropagationConfirmModal({
  scope,
  templateCount,
  affectedYachtCount,
  onCancel,
  onConfirm,
}: {
  scope: AssignmentScope
  templateCount: number | null
  affectedYachtCount: number | null
  onCancel: () => void
  onConfirm: (params: { overrideExisting: boolean }) => void
}) {
  const [overrideExisting, setOverrideExisting] = useState(false)

  const title = useMemo(() => {
    return "Confirm assignment propagation"
  }, [])

  const scopeLabel = useMemo(() => {
    if (scope.kind === "group") return `Group: ${scope.groupId}`
    if (scope.kind === "yacht") return `Yacht: ${scope.yachtId}`
    return "—"
  }, [scope])

  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="cta-button" onClick={() => onConfirm({ overrideExisting })}>
            Assign
          </button>
        </div>
      }
    >
      <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Target</div>
        <div>{scopeLabel}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Templates selected</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{templateCount == null ? "—" : templateCount}</div>
        </div>
        <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Affected yachts</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{affectedYachtCount == null ? "—" : affectedYachtCount}</div>
        </div>
      </div>

      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12, whiteSpace: "pre-wrap" }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Warnings</div>
        <div>- Yacht overrides create permanent forks (future propagation will not overwrite overrides).</div>
        <div>- Propagation is downward-only per backend rules.</div>
      </div>

      <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 10 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Existing assignments</div>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={overrideExisting} onChange={(e) => setOverrideExisting(e.target.checked)} />
          <div>
            <div style={{ fontWeight: 700 }}>Override existing assignments</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              If checked, the backend will replace existing matching assignments (unless an override/fork prevents it).
            </div>
          </div>
        </label>

        <div style={{ height: 8 }} />

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          If unchecked, existing assignments are kept and new ones are added where missing.
        </div>
      </div>
    </Modal>
  )
}

