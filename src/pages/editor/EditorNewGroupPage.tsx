import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"

type GroupRow = { id: string; name: string }

export default function EditorNewGroupPage() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [groups, setGroups] = useState<GroupRow[]>([])

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [parentId, setParentId] = useState<string>("")

  // YM v2: groups are flat (no parent hierarchy).
  const orderedGroups = useMemo(() => [...groups].sort((a, b) => a.name.localeCompare(b.name)), [groups])
  const formatTreeLabel = (g: GroupRow) => g.name

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const loadGroups = async () => {
      setLoading(true)
      setError(null)
      const { data, error: gErr } = await supabase.from("groups").select("id,name").order("name")
      if (cancelled) return
      if (gErr) {
        setError(gErr.message)
        setGroups([])
        setLoading(false)
        return
      }
      setGroups((data as GroupRow[]) ?? [])
      setLoading(false)
    }

    loadGroups()
    return () => {
      cancelled = true
    }
  }, [session])

  const create = async () => {
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Group name is required.")
      return
    }

    setSaving(true)
    const { error: insErr } = await supabase.from("groups").insert({
      name: trimmed,
      description: description.trim() ? description.trim() : null,
    })
    setSaving(false)

    if (insErr) {
      setError(insErr.message)
      return
    }

    navigate("/editor/groups", { replace: true })
  }

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Create group</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error && <div style={{ color: "var(--accent-red)", marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <div className="card">
        <label>Name:</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} disabled={saving} />

        <label>Description (optional):</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ marginBottom: 12 }} disabled={saving} />

        <label>Parent group (optional):</label>
        <select value={parentId} onChange={(e) => setParentId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving}>
          <option value="">—</option>
          {orderedGroups.map(({ g }) => (
            <option key={g.id} value={g.id}>
              {formatTreeLabel(g)}
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

