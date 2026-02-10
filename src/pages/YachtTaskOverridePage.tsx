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

type OverrideRow = {
  task_context_id: string
  name_override: string | null
  description_override: string | null
  default_unit_of_measure_id_override: string | null
  default_period_id_override: string | null
}

type Option = { id: string; name: string }

export default function YachtTaskOverridePage() {
  const navigate = useNavigate()
  const { yachtId, taskId } = useParams<{ yachtId: string; taskId: string }>()

  const [task, setTask] = useState<TaskRow | null>(null)
  const [scopeContextId, setScopeContextId] = useState<string | null>(null)
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
    if (!yachtId || !taskId) return

    const load = async () => {
      setLoading(true)
      setError(null)
      setInfo(null)

      // 1) Load base task template
      const { data: taskRow, error: taskErr } = await supabase
        .from("tasks")
        .select("id, name, description, default_unit_of_measure_id, default_period_id")
        .eq("id", taskId)
        .single()

      if (taskErr || !taskRow) {
        setError(taskErr?.message || "Task not found.")
        setLoading(false)
        return
      }

      setTask(taskRow as TaskRow)

      // 2) Ensure yacht+task scope context exists (category_id = null)
      const { data: existingCtx, error: ctxErr } = await supabase
        .from("task_contexts")
        .select("id")
        .eq("yacht_id", yachtId)
        .eq("task_id", taskId)
        .is("category_id", null)
        .limit(1)
        .maybeSingle()

      if (ctxErr) {
        setError(ctxErr.message)
        setLoading(false)
        return
      }

      let ctxId = (existingCtx as any)?.id as string | undefined
      if (!ctxId) {
        const { data: insertedCtx, error: insCtxErr } = await supabase
          .from("task_contexts")
          .insert({ yacht_id: yachtId, task_id: taskId, category_id: null })
          .select("id")
          .single()

        if (insCtxErr || !(insertedCtx as any)?.id) {
          setError(insCtxErr?.message || "Failed to create yacht task scope.")
          setLoading(false)
          return
        }
        ctxId = (insertedCtx as any).id as string
      }

      setScopeContextId(ctxId)

      // 3) Load override row (if any)
      const { data: ovr, error: ovrErr } = await supabase
        .from("task_context_overrides")
        .select(
          "task_context_id, name_override, description_override, default_unit_of_measure_id_override, default_period_id_override"
        )
        .eq("task_context_id", ctxId)
        .maybeSingle()

      if (ovrErr) {
        setError(ovrErr.message)
        setLoading(false)
        return
      }

      const row = ovr as OverrideRow | null
      setNameOverride(row?.name_override ?? "")
      setDescriptionOverride(row?.description_override ?? "")
      setUnitOverride(row?.default_unit_of_measure_id_override ?? null)
      setPeriodOverride(row?.default_period_id_override ?? null)

      setLoading(false)
    }

    load()
  }, [yachtId, taskId])

  const effectiveName = useMemo(() => {
    return nameOverride.trim() || task?.name || ""
  }, [nameOverride, task?.name])

  const handleSave = async () => {
    if (!scopeContextId) return
    setSaving(true)
    setError(null)
    setInfo(null)

    const payload = {
      task_context_id: scopeContextId,
      name_override: nameOverride.trim() ? nameOverride.trim() : null,
      description_override: descriptionOverride.trim() ? descriptionOverride.trim() : null,
      default_unit_of_measure_id_override: unitOverride,
      default_period_id_override: periodOverride,
      updated_at: new Date().toISOString(),
    }

    const { error: upErr } = await supabase
      .from("task_context_overrides")
      .upsert(payload, { onConflict: "task_context_id" })

    setSaving(false)
    if (upErr) {
      setError(upErr.message)
      return
    }

    setInfo("Saved yacht-specific task details.")
    navigate(-1)
  }

  const handleClear = async () => {
    if (!scopeContextId) return
    setSaving(true)
    setError(null)
    setInfo(null)

    const { error: delErr } = await supabase
      .from("task_context_overrides")
      .delete()
      .eq("task_context_id", scopeContextId)

    setSaving(false)
    if (delErr) {
      setError(delErr.message)
      return
    }

    setNameOverride("")
    setDescriptionOverride("")
    setUnitOverride(null)
    setPeriodOverride(null)
    setInfo("Cleared yacht-specific overrides.")
  }

  if (!yachtId || !taskId) return null

  return (
    <div className="screen">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <button
          type="button"
          className="primary-button"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
      </div>

      <hr />

      <div className="screen-title" style={{ fontSize: 18, marginBottom: 6 }}>
        Yacht Task
      </div>
      <div className="screen-subtitle">
        Editing this task only affects this yacht.
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
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{effectiveName}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Base template: {task?.name}
            </div>
          </div>

          <label>Yacht-specific name (optional):</label>
          <input value={nameOverride} onChange={(e) => setNameOverride(e.target.value)} style={{ marginBottom: 12 }} />

          <label>Yacht-specific description (optional):</label>
          <textarea
            value={descriptionOverride}
            onChange={(e) => setDescriptionOverride(e.target.value)}
            style={{ marginBottom: 12, minHeight: 92 }}
          />

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
              onClick={handleClear}
              style={{ cursor: "pointer" }}
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
                cursor: "pointer",
                fontWeight: 600,
                color: "var(--text-primary)",
                padding: 0,
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

