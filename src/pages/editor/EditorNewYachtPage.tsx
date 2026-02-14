import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"

type GroupRow = { id: string; name: string; parent_group_id: string | null }

export default function EditorNewYachtPage() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [groups, setGroups] = useState<GroupRow[]>([])

  const [name, setName] = useState("")
  const [groupId, setGroupId] = useState("")
  const [makeModel, setMakeModel] = useState("")
  const [location, setLocation] = useState("")

  const groupById = useMemo(() => {
    const m = new Map<string, GroupRow>()
    groups.forEach((g) => m.set(g.id, g))
    return m
  }, [groups])

  const childrenMap = useMemo(() => {
    const m = new Map<string | null, GroupRow[]>()
    for (const g of groups) {
      const key = g.parent_group_id && groupById.has(g.parent_group_id) ? g.parent_group_id : null
      const arr = m.get(key) ?? []
      arr.push(g)
      m.set(key, arr)
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => a.name.localeCompare(b.name))
      m.set(k, arr)
    }
    return m
  }, [groups, groupById])

  const orderedGroups = useMemo(() => {
    const out: Array<{ g: GroupRow; depth: number }> = []
    const visited = new Set<string>()

    const walk = (parentId: string | null, depth: number) => {
      const kids = childrenMap.get(parentId) ?? []
      for (const g of kids) {
        if (visited.has(g.id)) continue
        visited.add(g.id)
        out.push({ g, depth })
        walk(g.id, depth + 1)
      }
    }

    walk(null, 0)

    for (const g of groups) {
      if (!visited.has(g.id)) out.push({ g, depth: 0 })
    }

    return out
  }, [childrenMap, groups])

  const formatTreeLabel = (g: GroupRow) => {
    const parts: string[] = [g.name]
    let cur = g
    let guard = 0
    while (cur.parent_group_id && groupById.has(cur.parent_group_id) && guard < 10) {
      const p = groupById.get(cur.parent_group_id)!
      parts.unshift(p.name)
      cur = p
      guard++
    }
    return parts.join(" › ")
  }

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
      const list = (data as GroupRow[]) ?? []
      setGroups(list)
      if (!groupId && list.length === 1) setGroupId(list[0].id)
      setLoading(false)
    }

    loadGroups()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const create = async () => {
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Yacht name is required.")
      return
    }
    if (!groupId) {
      setError("Group is required.")
      return
    }

    setSaving(true)
    const { error: insErr } = await supabase.from("yachts").insert({
      name: trimmed,
      group_id: groupId,
      make_model: makeModel.trim() ? makeModel.trim() : null,
      location: location.trim() ? location.trim() : null,
    })
    setSaving(false)

    if (insErr) {
      setError(insErr.message)
      return
    }

    navigate("/editor/yachts", { replace: true })
  }

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Create yacht</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error && <div style={{ color: "var(--accent-red)", marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <div className="card">
        <label>Name:</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} disabled={saving} />

        <label>Group:</label>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving}>
          <option value="">Select group…</option>
          {orderedGroups.map(({ g }) => (
            <option key={g.id} value={g.id}>
              {formatTreeLabel(g)}
            </option>
          ))}
        </select>

        <label>Make / Model:</label>
        <input value={makeModel} onChange={(e) => setMakeModel(e.target.value)} style={{ marginBottom: 12 }} disabled={saving} />

        <label>Location:</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} style={{ marginBottom: 12 }} disabled={saving} />

        <button type="button" className="cta-button" onClick={create} disabled={saving}>
          {saving ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  )
}

