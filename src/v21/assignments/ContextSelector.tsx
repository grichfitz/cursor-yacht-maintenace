import React, { useMemo } from "react"
import type { GroupRow, YachtRow } from "./types"

export type AssignmentScope =
  | { kind: "group"; groupId: string }
  | { kind: "yacht"; yachtId: string }
  | { kind: "none" }

export function ContextSelector({
  groups,
  yachts,
  value,
  onChange,
}: {
  groups: GroupRow[]
  yachts: YachtRow[]
  value: AssignmentScope
  onChange: (v: AssignmentScope) => void
}) {
  const groupOptions = useMemo(() => [...groups].sort((a, b) => a.name.localeCompare(b.name)), [groups])
  const yachtOptions = useMemo(() => [...yachts].sort((a, b) => a.name.localeCompare(b.name)), [yachts])

  return (
    <div className="card">
      <div style={{ fontWeight: 900, marginBottom: 8 }}>Scope</div>
      <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
        Choose exactly one context: group <strong>or</strong> yacht.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="radio"
            name="assignmentScope"
            checked={value.kind === "group"}
            onChange={() => onChange({ kind: "group", groupId: groupOptions[0]?.id ?? "" })}
          />
          Group
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="radio"
            name="assignmentScope"
            checked={value.kind === "yacht"}
            onChange={() => onChange({ kind: "yacht", yachtId: yachtOptions[0]?.id ?? "" })}
          />
          Yacht
        </label>
      </div>

      <div style={{ height: 10 }} />

      {value.kind === "group" ? (
        <>
          <label>Group:</label>
          <select
            value={value.groupId}
            onChange={(e) => onChange({ kind: "group", groupId: e.target.value })}
            style={{ width: "100%" }}
          >
            <option value="">Select group…</option>
            {groupOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name || g.id}
              </option>
            ))}
          </select>
        </>
      ) : value.kind === "yacht" ? (
        <>
          <label>Yacht:</label>
          <select
            value={value.yachtId}
            onChange={(e) => onChange({ kind: "yacht", yachtId: e.target.value })}
            style={{ width: "100%" }}
          >
            <option value="">Select yacht…</option>
            {yachtOptions.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name || y.id}
              </option>
            ))}
          </select>
        </>
      ) : null}
    </div>
  )
}

