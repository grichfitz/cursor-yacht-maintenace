import React, { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"

type GroupRow = { id: string; name: string }
type CategoryRow = { id: string; name: string }

type TemplateRow = {
  id: string
  name: string
  description: string | null
  category_id: string | null
  interval_days: number | null
  default_group_id: string | null
}

export default function EditorEditTaskTemplatePage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { templateId } = useParams<{ templateId: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
    if (!templateId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      const [{ data: g, error: gErr }, { data: c, error: cErr }, { data: t, error: tErr }] = await Promise.all([
        supabase.from("groups").select("id,name").order("name"),
        supabase.from("categories").select("id,name").order("name"),
        supabase
          .from("task_templates")
          .select("id,name,description,category_id,interval_days,default_group_id")
          .eq("id", templateId)
          .maybeSingle(),
      ])

      if (cancelled) return

      const firstErr = gErr || cErr || tErr
      if (firstErr) {
        setError(firstErr.message)
        setLoading(false)
        return
      }

      setGroups((g as GroupRow[]) ?? [])
      setCategories((c as CategoryRow[]) ?? [])

      const row = t as TemplateRow | null
      if (!row?.id) {
        setError("Task not found (or not visible).")
        setLoading(false)
        return
      }

      setName(row.name ?? "")
      setDescription(row.description ?? "")
      setCategoryId(row.category_id ?? "")
      setIntervalDays(typeof row.interval_days === "number" ? String(row.interval_days) : "")
      setDefaultGroupId(row.default_group_id ?? "")
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session, templateId])

  const save = async () => {
    if (!templateId) return
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Name is required.")
      return
    }

    const interval = intervalDays.trim() === "" ? null : Number(intervalDays.trim())
    if (interval !== null && (!Number.isFinite(interval) || interval <= 0)) {
      setError("Interval days must be a positive number (or blank).")
      return
    }

    setSaving(true)
    const { error: upErr } = await supabase
      .from("task_templates")
      .update({
        name: trimmed,
        description: description.trim() ? description.trim() : null,
        category_id: categoryId || null,
        interval_days: interval,
        default_group_id: defaultGroupId || null,
      })
      .eq("id", templateId)
    setSaving(false)

    if (upErr) {
      setError(upErr.message)
      return
    }

    navigate("/editor/task-templates", { replace: true })
  }

  const del = async () => {
    if (!templateId) return
    const ok = window.confirm("Delete this task?\n\nThis cannot be undone.")
    if (!ok) return

    setDeleting(true)
    setError(null)

    // Block delete if instances exist (FK RESTRICT will block anyway, but this gives a better message).
    const { data: inst, error: instErr } = await supabase
      .from("task_instances")
      .select("id")
      .eq("template_id", templateId)
      .limit(1)

    if (instErr) {
      setError(instErr.message)
      setDeleting(false)
      return
    }

    if ((inst?.length ?? 0) > 0) {
      setError("This task cannot be deleted because there are task instances already created from it.")
      setDeleting(false)
      return
    }

    const { error: delErr } = await supabase.from("task_templates").delete().eq("id", templateId)
    setDeleting(false)
    if (delErr) {
      setError(delErr.message)
      return
    }

    navigate("/editor/task-templates", { replace: true })
  }

  if (!templateId) return null
  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Edit task</div>
      <div className="screen-subtitle">Admin-only (task template).</div>

      {error ? <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div> : null}

      <div className="card">
        <label>Name:</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 10 }} disabled={saving || deleting} />

        <label>Description:</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ marginBottom: 10 }} disabled={saving || deleting} />

        <label>Category:</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ marginBottom: 10 }} disabled={saving || deleting}>
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label>Interval (days):</label>
        <input value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} placeholder="e.g. 30" style={{ marginBottom: 10 }} disabled={saving || deleting} />

        <label>Default group (optional):</label>
        <select value={defaultGroupId} onChange={(e) => setDefaultGroupId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || deleting}>
          <option value="">—</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <button type="button" className="cta-button" onClick={save} disabled={saving || deleting}>
          {saving ? "Saving…" : "Save"}
        </button>

        <hr />

        <button
          type="button"
          className="secondary"
          onClick={del}
          disabled={saving || deleting}
          style={{ color: "var(--accent-red)", width: "100%" }}
        >
          {deleting ? "Deleting…" : "Delete task"}
        </button>
      </div>
    </div>
  )
}

