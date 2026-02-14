import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"

type GroupRow = { id: string; name: string; parent_group_id: string | null }

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
      parent_group_id: parentId || null,
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

