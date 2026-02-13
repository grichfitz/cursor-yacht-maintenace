import React, { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import EditorNav from "./EditorNav"
import { useSession } from "../../auth/SessionProvider"

type CategoryRow = { id: string; name: string }

export default function EditorCategoriesPage() {
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryRow[]>([])

  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)

    const { data, error: loadErr } = await supabase
      .from("categories")
      .select("id,name")
      .order("name")

    if (loadErr) {
      setError(loadErr.message)
      setCategories([])
      setLoading(false)
      return
    }

    setCategories((data as CategoryRow[]) ?? [])
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

    const { error: insErr } = await supabase.from("categories").insert({ name: trimmed })
    if (insErr) {
      setError(insErr.message)
      setCreating(false)
      return
    }

    setNewName("")
    setCreating(false)
    await load()
  }

  const startEdit = (c: CategoryRow) => {
    setEditingId(c.id)
    setEditName(c.name)
  }

  const save = async () => {
    if (!editingId) return
    const trimmed = editName.trim()
    if (!trimmed) return

    setSaving(true)
    setError(null)

    const { error: upErr } = await supabase
      .from("categories")
      .update({ name: trimmed })
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
    const ok = window.confirm("Delete this category? This cannot be undone.")
    if (!ok) return

    setError(null)
    const { error: delErr } = await supabase.from("categories").delete().eq("id", id)
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
      <div className="screen-title">Editor · Categories</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Create category</div>
        <label>Name:</label>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ marginBottom: 12 }}
          disabled={creating}
        />
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
          <div style={{ fontWeight: 800 }}>Categories</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{categories.length}</div>
        </div>

        {categories.map((c) => (
          <div key={c.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            {editingId === c.id ? (
              <div style={{ padding: 12 }}>
                <label>Name:</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ marginBottom: 12 }}
                  disabled={saving}
                />
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
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="secondary" onClick={() => startEdit(c)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => del(c.id)}
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

