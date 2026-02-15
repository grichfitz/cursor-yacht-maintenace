import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"

type TaskRow = {
  id: string
  title: string
  status: string
  yacht_id: string
  category_id: string | null
  due_date: string | null
  template_id: string | null
}

type YachtRow = { id: string; name: string }
type TemplateRow = { id: string; name: string }

function toLocalInputValue(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 16)
}

export default function EditorEditTaskPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { taskId } = useParams<{ taskId: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const [row, setRow] = useState<TaskRow | null>(null)
  const [yachts, setYachts] = useState<YachtRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])

  const [title, setTitle] = useState("")
  const [status, setStatus] = useState("")
  const [yachtId, setYachtId] = useState("")
  const [dueLocal, setDueLocal] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [categoryId, setCategoryId] = useState("")

  const dueIso = useMemo(() => {
    const raw = dueLocal.trim()
    if (!raw) return null
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
  }, [dueLocal])

  useEffect(() => {
    if (!session) return
    if (!taskId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setSaved(null)

      const [{ data: t, error: tErr }, { data: y, error: yErr }, { data: tpl, error: tplErr }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id,title,status,yacht_id,category_id,due_date,template_id")
          .eq("id", taskId)
          .maybeSingle(),
        supabase.from("yachts").select("id,name").order("name"),
        supabase.from("templates").select("id,name").order("name"),
      ])

      if (cancelled) return

      const firstErr = tErr || yErr || tplErr
      if (firstErr) {
        setError(firstErr.message)
        setRow(null)
        setLoading(false)
        return
      }

      const task = (t as TaskRow | null) ?? null
      if (!task?.id) {
        setError("Task not found (or not visible).")
        setRow(null)
        setLoading(false)
        return
      }

      setRow(task)
      setYachts((y as YachtRow[]) ?? [])
      setTemplates((tpl as TemplateRow[]) ?? [])

      setTitle(task.title ?? "")
      setStatus(task.status ?? "")
      setYachtId(task.yacht_id ?? "")
      setDueLocal(toLocalInputValue(task.due_date))
      setTemplateId(task.template_id ?? "")
      setCategoryId(task.category_id ?? "")

      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [session, taskId])

  const save = async () => {
    if (!taskId) return
    setError(null)
    setSaved(null)

    const trimmedName = title.trim()
    const trimmedStatus = status.trim()

    if (!trimmedName) {
      setError("Task title is required.")
      return
    }
    if (!trimmedStatus) {
      setError("Status is required.")
      return
    }
    if (!yachtId) {
      setError("Yacht is required.")
      return
    }

    setSaving(true)

    const { error: upErr } = await supabase
      .from("tasks")
      .update({
        title: trimmedName,
        status: trimmedStatus,
        yacht_id: yachtId,
        due_date: dueIso,
        template_id: templateId ? templateId : null,
        category_id: categoryId ? categoryId : null,
      })
      .eq("id", taskId)

    setSaving(false)

    if (upErr) {
      setError(upErr.message)
      return
    }

    setSaved("Saved.")
  }

  if (!taskId) return null
  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Edit task</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error ? <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div> : null}

      {!row ? (
        <div style={{ opacity: 0.75, fontSize: 13 }}>Task not found (or not visible).</div>
      ) : (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Task</div>

          <label>Title:</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 12 }} disabled={saving} />

          <label>Status:</label>
          <input value={status} onChange={(e) => setStatus(e.target.value)} style={{ marginBottom: 12 }} disabled={saving} />

          <label>Yacht:</label>
          <select value={yachtId} onChange={(e) => setYachtId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving}>
            <option value="">Select yacht…</option>
            {yachts.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name || y.id}
              </option>
            ))}
          </select>

          <label>Due date (optional):</label>
          <input type="datetime-local" value={dueLocal} onChange={(e) => setDueLocal(e.target.value)} style={{ marginBottom: 12 }} disabled={saving} />

          <label>Template (optional):</label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving}>
            <option value="">—</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || t.id}
              </option>
            ))}
          </select>

          <label>Category ID (optional):</label>
          <input value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving} />

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{saved || ""}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="secondary" onClick={() => navigate(-1)} disabled={saving}>
                Back
              </button>
              <button type="button" onClick={save} disabled={saving} style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

