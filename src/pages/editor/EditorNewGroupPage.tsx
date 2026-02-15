import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"
import { buildGroupParentSelectOptions } from "../../utils/groupTreeUi"

type GroupRow = { id: string; name: string; parent_group_id: string | null }

export default function EditorNewGroupPage() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [groups, setGroups] = useState<GroupRow[]>([])

  const [name, setName] = useState("")
  const [parentId, setParentId] = useState<string>("")

  const parentOptions = useMemo(() => buildGroupParentSelectOptions(groups), [groups])

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const loadGroups = async () => {
      setLoading(true)
      setError(null)
      const { data, error: gErr } = await supabase.from("groups").select("id,name,parent_group_id").order("name")
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
      parent_group_id: parentId ? parentId : null,
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

        <label>Parent group (optional):</label>
        <select value={parentId} onChange={(e) => setParentId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving}>
          <option value="">—</option>
          {parentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
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

