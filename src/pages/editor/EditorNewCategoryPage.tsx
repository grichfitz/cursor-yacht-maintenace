import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import EditorNav from "./EditorNav"

type CategoryRow = { id: string; name: string; parent_category_id: string | null }

export default function EditorNewCategoryPage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [parentId, setParentId] = useState<string>("")
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supportsParent, setSupportsParent] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  const categoryById = useMemo(() => {
    const m = new Map<string, CategoryRow>()
    categories.forEach((c) => m.set(c.id, c))
    return m
  }, [categories])

  const childrenMap = useMemo(() => {
    const m = new Map<string | null, CategoryRow[]>()
    for (const c of categories) {
      const key =
        c.parent_category_id && categoryById.has(c.parent_category_id)
          ? c.parent_category_id
          : null
      const arr = m.get(key) ?? []
      arr.push(c)
      m.set(key, arr)
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => a.name.localeCompare(b.name))
      m.set(k, arr)
    }
    return m
  }, [categories, categoryById])

  const orderedCategories = useMemo(() => {
    const out: Array<{ c: CategoryRow; depth: number }> = []
    const visited = new Set<string>()

    const walk = (parentId: string | null, depth: number) => {
      const kids = childrenMap.get(parentId) ?? []
      for (const c of kids) {
        if (visited.has(c.id)) continue
        visited.add(c.id)
        out.push({ c, depth })
        walk(c.id, depth + 1)
      }
    }

    walk(null, 0)
    for (const c of categories) {
      if (!visited.has(c.id)) out.push({ c, depth: 0 })
    }
    return out
  }, [childrenMap, categories])

  const formatTreeLabel = (c: CategoryRow) => {
    const parts: string[] = [c.name]
    let cur = c
    let guard = 0
    while (cur.parent_category_id && categoryById.has(cur.parent_category_id) && guard < 10) {
      const p = categoryById.get(cur.parent_category_id)!
      parts.unshift(p.name)
      cur = p
      guard++
    }
    return parts.join(" › ")
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setNotice(null)
      const { data, error: loadErr } = await supabase
        .from("categories")
        .select("id,name,parent_category_id")
        .order("name")
      if (cancelled) return
      if (loadErr) {
        const msg = String(loadErr.message || "")
        const missingParentCol = msg.includes("parent_category_id") && msg.toLowerCase().includes("does not exist")
        if (!missingParentCol) {
          setError(loadErr.message)
          setCategories([])
          setLoading(false)
          return
        }

        const { data: flat, error: flatErr } = await supabase.from("categories").select("id,name").order("name")
        if (cancelled) return
        if (flatErr) {
          setError(flatErr.message)
          setCategories([])
          setLoading(false)
          return
        }

        setSupportsParent(false)
        setCategories((((flat as any[]) ?? []) as Array<{ id: string; name: string }>).map((c) => ({
          id: c.id,
          name: c.name,
          parent_category_id: null,
        })))
        setNotice("Nested categories are not enabled yet. Apply `migration_phase1c_categories_hierarchy.sql` in Supabase to pick a parent.")
        setLoading(false)
        return
      }
      setCategories((data as CategoryRow[]) ?? [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const create = async () => {
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Category name is required.")
      return
    }

    setSaving(true)
    const payload = supportsParent ? { name: trimmed, parent_category_id: parentId || null } : { name: trimmed }
    const { error: insErr } = await supabase.from("categories").insert(payload)
    setSaving(false)

    if (insErr) {
      setError(insErr.message)
      return
    }

    navigate("/editor/categories", { replace: true })
  }

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Create category</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error && <div style={{ color: "var(--accent-red)", marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {notice && !error ? (
        <div style={{ color: "var(--text-secondary)", marginBottom: 12, fontSize: 13 }}>{notice}</div>
      ) : null}

      <div className="card">
        <label>Name:</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} disabled={saving} />

        {supportsParent ? (
          <>
            <label>Parent category (optional):</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              style={{ marginBottom: 12 }}
              disabled={saving}
            >
              <option value="">—</option>
              {orderedCategories.map(({ c }) => (
                <option key={c.id} value={c.id}>
                  {formatTreeLabel(c)}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <button type="button" className="cta-button" onClick={create} disabled={saving}>
          {saving ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  )
}

