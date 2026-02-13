import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"
import EditorNav from "./EditorNav"
import { useSession } from "../../auth/SessionProvider"

type GroupRow = { id: string; name: string }
type YachtRow = { id: string; name: string; group_id: string }

export default function EditorYachtsPage() {
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [groups, setGroups] = useState<GroupRow[]>([])
  const [yachts, setYachts] = useState<YachtRow[]>([])

  const [newName, setNewName] = useState("")
  const [newGroupId, setNewGroupId] = useState("")
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editGroupId, setEditGroupId] = useState("")
  const [saving, setSaving] = useState(false)

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>()
    groups.forEach((g) => m.set(g.id, g.name))
    return m
  }, [groups])

  const load = async () => {
    setLoading(true)
    setError(null)

    const { data: g, error: gErr } = await supabase
      .from("groups")
      .select("id,name")
      .order("name")
    if (gErr) {
      setError(gErr.message)
      setLoading(false)
      return
    }

    const { data: y, error: yErr } = await supabase
      .from("yachts")
      .select("id,name,group_id")
      .order("name")
    if (yErr) {
      setError(yErr.message)
      setLoading(false)
      return
    }

    setGroups((g as GroupRow[]) ?? [])
    setYachts((y as YachtRow[]) ?? [])
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
    if (!trimmed || !newGroupId) return
    setCreating(true)
    setError(null)

    const { error: insErr } = await supabase.from("yachts").insert({
      name: trimmed,
      group_id: newGroupId,
    })

    if (insErr) {
      setError(insErr.message)
      setCreating(false)
      return
    }

    setNewName("")
    setNewGroupId("")
    setCreating(false)
    await load()
  }

  const startEdit = (y: YachtRow) => {
    setEditingId(y.id)
    setEditName(y.name)
    setEditGroupId(y.group_id)
  }

  const save = async () => {
    if (!editingId) return
    const trimmed = editName.trim()
    if (!trimmed || !editGroupId) return

    setSaving(true)
    setError(null)

    const { error: upErr } = await supabase
      .from("yachts")
      .update({ name: trimmed, group_id: editGroupId })
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
    const ok = window.confirm("Delete this yacht? This cannot be undone.")
    if (!ok) return

    setError(null)
    const { error: delErr } = await supabase.from("yachts").delete().eq("id", id)
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
      <div className="screen-title">Editor · Yachts</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Create yacht</div>
        <label>Name:</label>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ marginBottom: 12 }}
          disabled={creating}
        />
        <label>Group:</label>
        <select
          value={newGroupId}
          onChange={(e) => setNewGroupId(e.target.value)}
          style={{ marginBottom: 12 }}
          disabled={creating}
        >
          <option value="">Select group…</option>
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
          disabled={creating || !newName.trim() || !newGroupId}
          style={{ opacity: creating || !newName.trim() || !newGroupId ? 0.6 : 1 }}
        >
          {creating ? "Creating…" : "Create"}
        </button>
      </div>

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Yachts</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{yachts.length}</div>
        </div>

        {yachts.map((y) => (
          <div key={y.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            {editingId === y.id ? (
              <div style={{ padding: 12 }}>
                <label>Name:</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ marginBottom: 10 }}
                  disabled={saving}
                />
                <label>Group:</label>
                <select
                  value={editGroupId}
                  onChange={(e) => setEditGroupId(e.target.value)}
                  style={{ marginBottom: 12 }}
                  disabled={saving}
                >
                  <option value="">Select group…</option>
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
                    disabled={saving || !editName.trim() || !editGroupId}
                    style={{ opacity: saving || !editName.trim() || !editGroupId ? 0.6 : 1 }}
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
                  <div style={{ fontWeight: 700 }}>{y.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {groupNameById.get(y.group_id) ?? "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="secondary" onClick={() => startEdit(y)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => del(y.id)}
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

