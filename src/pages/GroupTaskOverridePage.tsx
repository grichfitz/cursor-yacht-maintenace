import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"

type TaskRow = {
  id: string
  name: string
  description: string | null
  default_unit_of_measure_id: string | null
  default_period_id: string | null
}

type TaskAssignmentRow = {
  id: string
  group_id: string
  task_id: string
  inherits_from_assignment_id: string | null
  override_data: any
}

type EffectiveAssignmentRow = {
  task_id: string
  task_name: string
  task_description: string | null
  default_unit_of_measure_id: string | null
  default_period_id: string | null
  effective_override_data: any
  effective_assignment_id: string
  source_group_id: string
  is_local: boolean
}

type Option = { id: string; name: string }

function pickString(obj: any, key: string): string {
  const v = obj?.[key]
  return typeof v === "string" ? v : ""
}

function pickUuidOrNull(obj: any, key: string): string | null {
  const v = obj?.[key]
  return typeof v === "string" && v.trim() ? v : null
}

export default function GroupTaskOverridePage() {
  const navigate = useNavigate()
  const { groupId, taskId } = useParams<{ groupId: string; taskId: string }>()

  const [task, setTask] = useState<TaskRow | null>(null)
  const [effective, setEffective] = useState<EffectiveAssignmentRow | null>(null)
  const [assignment, setAssignment] = useState<TaskAssignmentRow | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [nameOverride, setNameOverride] = useState("")
  const [descriptionOverride, setDescriptionOverride] = useState("")
  const [unitOverride, setUnitOverride] = useState<string | null>(null)
  const [periodOverride, setPeriodOverride] = useState<string | null>(null)

  const [units, setUnits] = useState<Option[]>([])
  const [periods, setPeriods] = useState<Option[]>([])

  useEffect(() => {
    supabase.from("units_of_measure").select("id,name").then(({ data }) => {
      setUnits((data as any[])?.map((d) => ({ id: d.id, name: d.name })) ?? [])
    })
    supabase.from("periods").select("id,name").then(({ data }) => {
      setPeriods((data as any[])?.map((d) => ({ id: d.id, name: d.name })) ?? [])
    })
  }, [])

  useEffect(() => {
    if (!groupId || !taskId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setInfo(null)

      // 1) Load base template task.
      const { data: taskRow, error: taskErr } = await supabase
        .from("tasks")
        .select("id, name, description, default_unit_of_measure_id, default_period_id")
        .eq("id", taskId)
        .single()

      if (cancelled) return

      if (taskErr || !taskRow) {
        setError(taskErr?.message || "Task not found.")
        setLoading(false)
        return
      }
      setTask(taskRow as TaskRow)

      // 2) Load effective assignment (SQL-authoritative merge).
      const { data: effRows, error: effErr } = await supabase.rpc(
        "effective_task_assignments",
        { target_group_id: groupId }
      )

      if (cancelled) return

      if (effErr) {
        setError(effErr.message)
        setLoading(false)
        return
      }

      const match =
        ((effRows as EffectiveAssignmentRow[] | null) ?? []).find((r) => r.task_id === taskId) ??
        null

      if (!match) {
        setError("This task is not assigned to this group (directly or via inheritance).")
        setLoading(false)
        return
      }

      setEffective(match)

      // 3) Load or create local assignment row for this group+task.
      const { data: localRow, error: localErr } = await supabase
        .from("task_assignments")
        .select("id, group_id, task_id, inherits_from_assignment_id, override_data")
        .eq("group_id", groupId)
        .eq("task_id", taskId)
        .eq("is_archived", false)
        .maybeSingle()

      if (cancelled) return

      if (localErr) {
        setError(localErr.message)
        setLoading(false)
        return
      }

      let local = localRow as TaskAssignmentRow | null
      if (!local?.id) {
        const { data: inserted, error: insErr } = await supabase
          .from("task_assignments")
          .insert({
            group_id: groupId,
            task_id: taskId,
            inherits_from_assignment_id: match.effective_assignment_id,
            override_data: {},
            is_archived: false,
            updated_at: new Date().toISOString(),
          })
          .select("id, group_id, task_id, inherits_from_assignment_id, override_data")
          .single()

        if (cancelled) return

        if (insErr || !inserted) {
          setError(insErr?.message || "Failed to create local override.")
          setLoading(false)
          return
        }

        local = inserted as TaskAssignmentRow
      }

      setAssignment(local)

      const od = local.override_data ?? {}
      setNameOverride(pickString(od, "name"))
      setDescriptionOverride(pickString(od, "description"))
      setUnitOverride(pickUuidOrNull(od, "default_unit_of_measure_id"))
      setPeriodOverride(pickUuidOrNull(od, "default_period_id"))

      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [groupId, taskId])

  const inheritedName = effective?.task_name ?? task?.name ?? ""
  const inheritedDescription = effective?.task_description ?? task?.description ?? ""

  const effectiveName = useMemo(() => {
    return nameOverride.trim() || inheritedName
  }, [nameOverride, inheritedName])

  const effectiveDescription = useMemo(() => {
    return descriptionOverride.trim() || inheritedDescription || ""
  }, [descriptionOverride, inheritedDescription])

  const handleSave = async () => {
    if (!assignment?.id) return
    setSaving(true)
    setError(null)
    setInfo(null)

    const overrideData: Record<string, any> = {}
    if (nameOverride.trim()) overrideData.name = nameOverride.trim()
    if (descriptionOverride.trim()) overrideData.description = descriptionOverride.trim()
    if (unitOverride) overrideData.default_unit_of_measure_id = unitOverride
    if (periodOverride) overrideData.default_period_id = periodOverride

    const { error: upErr } = await supabase
      .from("task_assignments")
      .update({
        override_data: overrideData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignment.id)

    setSaving(false)

    if (upErr) {
      setError(upErr.message)
      return
    }

    setInfo("Saved group-local overrides.")
    navigate(-1)
  }

  const handleClearOverrides = async () => {
    if (!assignment?.id) return
    setSaving(true)
    setError(null)
    setInfo(null)

    const { error: upErr } = await supabase
      .from("task_assignments")
      .update({ override_data: {}, updated_at: new Date().toISOString() })
      .eq("id", assignment.id)

    setSaving(false)

    if (upErr) {
      setError(upErr.message)
      return
    }

    setNameOverride("")
    setDescriptionOverride("")
    setUnitOverride(null)
    setPeriodOverride(null)
    setInfo("Cleared local overrides.")
  }

  const handleRemoveLocal = async () => {
    if (!assignment?.id) return
    setSaving(true)
    setError(null)
    setInfo(null)

    const { error: delErr } = await supabase
      .from("task_assignments")
      .delete()
      .eq("id", assignment.id)

    setSaving(false)

    if (delErr) {
      setError(delErr.message)
      return
    }

    navigate(-1)
  }

  if (!groupId || !taskId) return null

  return (
    <div className="screen">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <button type="button" className="primary-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <hr />

      <div className="screen-title" style={{ fontSize: 18, marginBottom: 6 }}>
        Group Task Override
      </div>
      <div className="screen-subtitle">
        Editing here affects this group subtree only. Parent groups are never mutated.
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <>
          {error && (
            <div style={{ color: "var(--accent-red)", marginBottom: 12, fontSize: 13 }}>
              {error}
            </div>
          )}
          {info && (
            <div style={{ color: "var(--text-secondary)", marginBottom: 12, fontSize: 13 }}>
              {info}
            </div>
          )}

          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{effectiveName}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
              Template: {task?.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Inherited: {inheritedName}
            </div>
          </div>

          <label>Group-local name override (optional):</label>
          <input
            value={nameOverride}
            onChange={(e) => setNameOverride(e.target.value)}
            style={{ marginBottom: 12 }}
          />

          <label>Group-local description override (optional):</label>
          <textarea
            value={descriptionOverride}
            onChange={(e) => setDescriptionOverride(e.target.value)}
            style={{ marginBottom: 12, minHeight: 92 }}
          />

          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: -6, marginBottom: 12 }}>
            Effective description preview: {effectiveDescription || "—"}
          </div>

          <label>Unit override (optional):</label>
          <select
            value={unitOverride ?? ""}
            onChange={(e) => setUnitOverride(e.target.value || null)}
            style={{ marginBottom: 12 }}
          >
            <option value="">—</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <label>Period override (optional):</label>
          <select
            value={periodOverride ?? ""}
            onChange={(e) => setPeriodOverride(e.target.value || null)}
            style={{ marginBottom: 12 }}
          >
            <option value="">—</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              className="primary-button"
              onClick={handleRemoveLocal}
              disabled={saving}
              title="Deletes the local assignment row. If this task is inherited from a parent group, it will still apply."
            >
              Remove local
            </button>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="primary-button"
                onClick={handleClearOverrides}
                disabled={saving}
              >
                Clear overrides
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: saving ? "default" : "pointer",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  padding: 0,
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

