import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"

type GroupRow = { id: string; name: string }
type CategoryRow = { id: string; name: string }

export default function EditorNewTaskTemplatePage() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [groups, setGroups] = useState<GroupRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [intervalDays, setIntervalDays] = useState<string>("")
  const [defaultGroupId, setDefaultGroupId] = useState<string>("")

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      const [{ data: g, error: gErr }, { data: c, error: cErr }] = await Promise.all([
        supabase.from("groups").select("id,name").order("name"),
        supabase.from("categories").select("id,name").order("name"),
      ])

      if (cancelled) return
      const firstErr = gErr || cErr
      if (firstErr) {
        setError(firstErr.message)
        setGroups([])
        setCategories([])
        setLoading(false)
        return
      }

      setGroups((g as GroupRow[]) ?? [])
      setCategories((c as CategoryRow[]) ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session])

  const create = async () => {
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Task name is required.")
      return
    }

    const interval = intervalDays.trim() === "" ? null : Number(intervalDays.trim())
    if (interval !== null && (!Number.isFinite(interval) || interval <= 0)) {
      setError("Interval days must be a positive number (or blank).")
      return
    }

    setSaving(true)
    const { error: insErr } = await supabase.from("task_templates").insert({
      name: trimmed,
      description: description.trim() ? description.trim() : null,
      category_id: categoryId || null,
      interval_days: interval,
      default_group_id: defaultGroupId || null,
    })
    setSaving(false)

    if (insErr) {
      setError(insErr.message)
      return
    }

    navigate("/editor/task-templates", { replace: true })
  }

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Create task</div>
      <div className="screen-subtitle">Admin-only (task template).</div>

      {error && <div style={{ color: "var(--accent-red)", marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <div className="card">
        <label>Name:</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 10 }} disabled={saving} />

        <label>Description (optional):</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ marginBottom: 10 }} disabled={saving} />

        <label>Category:</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ marginBottom: 10 }} disabled={saving}>
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label>Interval (days):</label>
        <input value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} placeholder="e.g. 30" style={{ marginBottom: 10 }} disabled={saving} />

        <label>Default group (optional):</label>
        <select value={defaultGroupId} onChange={(e) => setDefaultGroupId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving}>
          <option value="">—</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <button type="button" className="cta-button" onClick={create} disabled={saving}>
          {saving ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  )
}

