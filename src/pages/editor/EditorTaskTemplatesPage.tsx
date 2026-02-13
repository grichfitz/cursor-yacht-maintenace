import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"
import EditorNav from "./EditorNav"
import { useSession } from "../../auth/SessionProvider"

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

export default function EditorTaskTemplatesPage() {
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [groups, setGroups] = useState<GroupRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])

  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newCategoryId, setNewCategoryId] = useState<string>("")
  const [newIntervalDays, setNewIntervalDays] = useState<string>("")
  const [newDefaultGroupId, setNewDefaultGroupId] = useState<string>("")
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editCategoryId, setEditCategoryId] = useState<string>("")
  const [editIntervalDays, setEditIntervalDays] = useState<string>("")
  const [editDefaultGroupId, setEditDefaultGroupId] = useState<string>("")
  const [saving, setSaving] = useState(false)

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>()
    categories.forEach((c) => m.set(c.id, c.name))
    return m
  }, [categories])

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>()
    groups.forEach((g) => m.set(g.id, g.name))
    return m
  }, [groups])

  const load = async () => {
    setLoading(true)
    setError(null)

    const [{ data: g, error: gErr }, { data: c, error: cErr }, { data: t, error: tErr }] =
      await Promise.all([
        supabase.from("groups").select("id,name").order("name"),
        supabase.from("categories").select("id,name").order("name"),
        supabase
          .from("task_templates")
          .select("id,name,description,category_id,interval_days,default_group_id")
          .order("name"),
      ])

    const firstErr = gErr || cErr || tErr
    if (firstErr) {
      setError(firstErr.message)
      setLoading(false)
      return
    }

    setGroups((g as GroupRow[]) ?? [])
    setCategories((c as CategoryRow[]) ?? [])
    setTemplates((t as TemplateRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await load()
    }
    run()
    return () => {
      cancelled = true
    }
  }, [session])

  const create = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return

    setCreating(true)
    setError(null)

    const interval =
      newIntervalDays.trim() === "" ? null : Number(newIntervalDays.trim())
    if (interval !== null && (!Number.isFinite(interval) || interval <= 0)) {
      setError("Interval days must be a positive number (or blank).")
      setCreating(false)
      return
    }

    const { error: insErr } = await supabase.from("task_templates").insert({
      name: trimmed,
      description: newDescription.trim() ? newDescription.trim() : null,
      category_id: newCategoryId || null,
      interval_days: interval,
      default_group_id: newDefaultGroupId || null,
    })

    if (insErr) {
      setError(insErr.message)
      setCreating(false)
      return
    }

    setNewName("")
    setNewDescription("")
    setNewCategoryId("")
    setNewIntervalDays("")
    setNewDefaultGroupId("")
    setCreating(false)
    await load()
  }

  const startEdit = (t: TemplateRow) => {
    setEditingId(t.id)
    setEditName(t.name)
    setEditDescription(t.description ?? "")
    setEditCategoryId(t.category_id ?? "")
    setEditIntervalDays(t.interval_days ? String(t.interval_days) : "")
    setEditDefaultGroupId(t.default_group_id ?? "")
  }

  const save = async () => {
    if (!editingId) return
    const trimmed = editName.trim()
    if (!trimmed) return

    setSaving(true)
    setError(null)

    const interval =
      editIntervalDays.trim() === "" ? null : Number(editIntervalDays.trim())
    if (interval !== null && (!Number.isFinite(interval) || interval <= 0)) {
      setError("Interval days must be a positive number (or blank).")
      setSaving(false)
      return
    }

    const { error: upErr } = await supabase
      .from("task_templates")
      .update({
        name: trimmed,
        description: editDescription.trim() ? editDescription.trim() : null,
        category_id: editCategoryId || null,
        interval_days: interval,
        default_group_id: editDefaultGroupId || null,
      })
      .eq("id", editingId)

    if (upErr) {
      setError(upErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setEditingId(null)
    await load()
  }

  const del = async (id: string) => {
    const ok = window.confirm("Delete this task? This cannot be undone.")
    if (!ok) return

    setError(null)
    const { error: delErr } = await supabase.from("task_templates").delete().eq("id", id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    await load()
  }

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Editor · Tasks</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Create task</div>
        <label>Name:</label>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ marginBottom: 10 }}
          disabled={creating}
        />

        <label>Description:</label>
        <textarea
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          rows={3}
          style={{ marginBottom: 10 }}
          disabled={creating}
        />

        <label>Category:</label>
        <select
          value={newCategoryId}
          onChange={(e) => setNewCategoryId(e.target.value)}
          style={{ marginBottom: 10 }}
          disabled={creating}
        >
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label>Interval (days):</label>
        <input
          value={newIntervalDays}
          onChange={(e) => setNewIntervalDays(e.target.value)}
          placeholder="e.g. 30"
          style={{ marginBottom: 10 }}
          disabled={creating}
        />

        <label>Default group (optional):</label>
        <select
          value={newDefaultGroupId}
          onChange={(e) => setNewDefaultGroupId(e.target.value)}
          style={{ marginBottom: 12 }}
          disabled={creating}
        >
          <option value="">—</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="cta-button"
          onClick={create}
          disabled={creating || !newName.trim()}
          style={{ opacity: creating || !newName.trim() ? 0.6 : 1 }}
        >
          {creating ? "Creating…" : "Create"}
        </button>
      </div>

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Tasks</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{templates.length}</div>
        </div>

        {templates.map((t) => (
          <div key={t.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            {editingId === t.id ? (
              <div style={{ padding: 12 }}>
                <label>Name:</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ marginBottom: 10 }}
                  disabled={saving}
                />
                <label>Description:</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  style={{ marginBottom: 10 }}
                  disabled={saving}
                />
                <label>Category:</label>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  style={{ marginBottom: 10 }}
                  disabled={saving}
                >
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <label>Interval (days):</label>
                <input
                  value={editIntervalDays}
                  onChange={(e) => setEditIntervalDays(e.target.value)}
                  placeholder="e.g. 30"
                  style={{ marginBottom: 10 }}
                  disabled={saving}
                />
                <label>Default group:</label>
                <select
                  value={editDefaultGroupId}
                  onChange={(e) => setEditDefaultGroupId(e.target.value)}
                  style={{ marginBottom: 12 }}
                  disabled={saving}
                >
                  <option value="">—</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !editName.trim()}
                    style={{ opacity: saving || !editName.trim() ? 0.6 : 1 }}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditingId(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="list-row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: 800 }}>{t.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {(t.category_id && categoryNameById.get(t.category_id)) || "No category"}
                    {t.default_group_id
                      ? ` · Default: ${groupNameById.get(t.default_group_id) ?? "—"}`
                      : ""}
                    {t.interval_days ? ` · Every ${t.interval_days}d` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="secondary" onClick={() => startEdit(t)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => del(t.id)}
                    style={{ color: "var(--accent-red)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

