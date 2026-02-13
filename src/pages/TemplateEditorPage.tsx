import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"

type TemplateRow = {
  id: string
  name: string
  description: string | null
  interval_days: number | null
  category_id: string | null
  default_group_id: string | null
}

function pickUuidOrNull(raw: unknown) {
  if (typeof raw !== "string") return null
  const s = raw.trim()
  return s ? s : null
}

export default function TemplateEditorPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { id } = useParams<{ id: string }>()

  const isNew = id === "new"
  const templateId = isNew ? null : (id ?? null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [loadedTemplate, setLoadedTemplate] = useState<TemplateRow | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [intervalDays, setIntervalDays] = useState<string>("")

  const [categoryId, setCategoryId] = useState<string>("")
  const [defaultGroupId, setDefaultGroupId] = useState<string>("")

  const header = useMemo(() => {
    if (isNew) return "New Template"
    if (!loadedTemplate) return "Template Editor"
    return "Template Editor"
  }, [isNew, loadedTemplate])

  const load = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    setLoadedTemplate(null)

    if (isNew) {
      setName("")
      setDescription("")
      setIntervalDays("")
      setCategoryId("")
      setDefaultGroupId("")
      setLoading(false)
      return
    }

    if (!templateId) {
      setError("Missing template id.")
      setLoading(false)
      return
    }

    const { data: row, error: rowErr } = await supabase
      .from("task_templates")
      .select("id,name,description,interval_days,category_id,default_group_id")
      .eq("id", templateId)
      .single()

    if (rowErr) {
      setError(rowErr.message)
      setLoading(false)
      return
    }

    const t = row as unknown as TemplateRow
    setLoadedTemplate(t)

    setName(t.name ?? "")
    setDescription(t.description ?? "")
    setIntervalDays(typeof t.interval_days === "number" ? String(t.interval_days) : "")
    setCategoryId(t.category_id ?? "")
    setDefaultGroupId(t.default_group_id ?? "")

    setLoading(false)
  }

  useEffect(() => {
    if (!session) return
    load()
  }, [session, id]) // id includes "new" vs uuid

  const parseIntervalDaysOrNull = () => {
    const s = intervalDays.trim()
    if (!s) return null
    const n = Number(s)
    if (!Number.isFinite(n) || n <= 0) return "Interval days must be a positive number (or blank)."
    return n
  }

  const handleSave = async () => {
    setError(null)
    setInfo(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Name is required.")
      return
    }

    setSaving(true)

    try {
      const interval = parseIntervalDaysOrNull()
      if (typeof interval === "string") throw new Error(interval)

      const payload = {
        name: trimmed,
        description: description.trim() ? description.trim() : null,
        interval_days: interval,
        category_id: pickUuidOrNull(categoryId),
        default_group_id: pickUuidOrNull(defaultGroupId),
      }

      if (isNew) {
        const { data, error: insErr } = await supabase
          .from("task_templates")
          .insert(payload)
          .select("id")
          .single()

        if (insErr) throw new Error(insErr.message)

        const newId = (data as any)?.id as string | undefined
        if (!newId) throw new Error("Template created, but no ID returned.")

        const { error: genErr } = await supabase.rpc("generate_task_instances")
        if (genErr) throw new Error(genErr.message)

        setInfo("Created.")
        navigate(`/templates/${newId}`, { replace: true })
        return
      }

      if (!templateId) throw new Error("Missing template id.")
      if (!loadedTemplate) throw new Error("Template not loaded.")

      const { error: upErr } = await supabase
        .from("task_templates")
        .update(payload)
        .eq("id", templateId)

      if (upErr) throw new Error(upErr.message)

      const { error: genErr } = await supabase.rpc("generate_task_instances")
      if (genErr) throw new Error(genErr.message)

      setInfo("Saved.")
      await load()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          marginTop: -6,
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/templates")}
          className="primary-button"
        >
          ← Back
        </button>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>{header}</div>

      {loadedTemplate && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
          ID: {loadedTemplate.id}
        </div>
      )}

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {info && (
        <div style={{ color: "var(--text-secondary)", marginBottom: 10, fontSize: 13 }}>
          {info}
        </div>
      )}

      <label>Name:</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 12 }}
        disabled={saving}
      />

      <label>Description:</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        style={{ marginBottom: 12 }}
        disabled={saving}
      />

      <label>Interval (days):</label>
      <input
        value={intervalDays}
        onChange={(e) => setIntervalDays(e.target.value)}
        placeholder="e.g. 30"
        style={{ marginBottom: 12 }}
        disabled={saving}
      />

      <label>Category ID (optional):</label>
      <input
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        placeholder="uuid"
        style={{ marginBottom: 12 }}
        disabled={saving}
      />

      <label>Default Group ID (optional):</label>
      <input
        value={defaultGroupId}
        onChange={(e) => setDefaultGroupId(e.target.value)}
        placeholder="uuid"
        style={{ marginBottom: 12 }}
        disabled={saving}
      />

      <button
        type="button"
        className="cta-button"
        onClick={handleSave}
        disabled={saving || !name.trim()}
        style={{ opacity: saving || !name.trim() ? 0.6 : 1 }}
      >
        {saving ? "Saving…" : isNew ? "Create" : "Save"}
      </button>
    </div>
  )
}

