import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"

type Option = {
  id: string
  name: string
}

export default function NewTaskPage() {
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [unitId, setUnitId] = useState<string | null>(null)
  const [periodId, setPeriodId] = useState<string | null>(null)

  const [units, setUnits] = useState<Option[]>([])
  const [periods, setPeriods] = useState<Option[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from("units_of_measure").select("id,name").then(({ data }) => {
      setUnits((data as Option[]) || [])
    })

    supabase.from("periods").select("id,name").then(({ data }) => {
      setPeriods((data as Option[]) || [])
    })
  }, [])

  const handleCreate = async () => {
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Task name is required.")
      return
    }

    setSaving(true)

    const { data, error: insertError } = await supabase
      .from("tasks")
      .insert({
        name: trimmed,
        description: description.trim() ? description.trim() : null,
        default_unit_of_measure_id: unitId,
        default_period_id: periodId,
      })
      .select("id")
      .single()

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    const newId = (data as any)?.id as string | undefined
    if (!newId) {
      setError("Task created, but no ID returned.")
      return
    }

    // Replace New Task page in history so Back goes to task list
    navigate(`/apps/tasks/${newId}`, { replace: true })
  }

  return (
    <div className="app-content">
      {/* Top Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          marginTop: -6,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          ← Back
        </button>

        <button
          onClick={() => navigate("/desktop")}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          Home
        </button>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>New Task</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 12 }}>
          {error}
        </div>
      )}

      <label>Name:</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <label>Description / Notes:</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        style={{ marginBottom: 12 }}
      />

      <label>Measurement:</label>
      <select
        value={unitId ?? ""}
        onChange={(e) => setUnitId(e.target.value || null)}
        style={{ marginBottom: 12 }}
      >
        <option value="">—</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>

      <label>Schedule Period:</label>
      <select
        value={periodId ?? ""}
        onChange={(e) => setPeriodId(e.target.value || null)}
        style={{ marginBottom: 12 }}
      >
        <option value="">—</option>
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleCreate}
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
          {saving ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  )
}

