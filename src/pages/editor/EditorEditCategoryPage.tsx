import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"

type CategoryRow = { id: string; name: string; parent_category_id: string | null }

export default function EditorEditCategoryPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { categoryId } = useParams<{ categoryId: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supportsParent, setSupportsParent] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [parentId, setParentId] = useState<string>("")
  const [categories, setCategories] = useState<CategoryRow[]>([])

  const categoryById = useMemo(() => {
    const m = new Map<string, CategoryRow>()
    categories.forEach((c) => m.set(c.id, c))
    return m
  }, [categories])

  const childrenMap = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const c of categories) {
      if (!c.parent_category_id) continue
      const arr = m.get(c.parent_category_id) ?? []
      arr.push(c.id)
      m.set(c.parent_category_id, arr)
    }
    return m
  }, [categories])

  const descendantIds = useMemo(() => {
    if (!categoryId) return new Set<string>()
    const out = new Set<string>()
    const stack = [categoryId]
    while (stack.length) {
      const cur = stack.pop()!
      const kids = childrenMap.get(cur) ?? []
      for (const k of kids) {
        if (out.has(k)) continue
        out.add(k)
        stack.push(k)
      }
    }
    return out
  }, [categoryId, childrenMap])

  const orderedCategories = useMemo(() => {
    // Order like a tree so the dropdown is usable.
    const out: Array<{ c: CategoryRow; depth: number }> = []
    const visited = new Set<string>()
    const childRows = new Map<string | null, CategoryRow[]>()

    for (const c of categories) {
      const key =
        c.parent_category_id && categoryById.has(c.parent_category_id)
          ? c.parent_category_id
          : null
      const arr = childRows.get(key) ?? []
      arr.push(c)
      childRows.set(key, arr)
    }
    for (const [k, arr] of childRows.entries()) {
      arr.sort((a, b) => a.name.localeCompare(b.name))
      childRows.set(k, arr)
    }

    const walk = (pid: string | null, depth: number) => {
      const kids = childRows.get(pid) ?? []
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
  }, [categories, categoryById])

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
    if (!session) return
    if (!categoryId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setNotice(null)

      const [{ data: all, error: allErr }, { data, error }] = await Promise.all([
        supabase.from("categories").select("id,name,parent_category_id").order("name"),
        supabase.from("categories").select("id,name,parent_category_id").eq("id", categoryId).maybeSingle(),
      ])

      if (cancelled) return
      if (allErr || error) {
        const msg = String(allErr?.message || error?.message || "")
        const missingParentCol = msg.includes("parent_category_id") && msg.toLowerCase().includes("does not exist")
        if (!missingParentCol) {
          setError(allErr?.message || error?.message || "Failed to load category.")
          setLoading(false)
          return
        }

        const [{ data: allFlat, error: allFlatErr }, { data: rowFlat, error: rowFlatErr }] = await Promise.all([
          supabase.from("categories").select("id,name").order("name"),
          supabase.from("categories").select("id,name").eq("id", categoryId).maybeSingle(),
        ])
        if (cancelled) return
        if (allFlatErr || rowFlatErr) {
          setError(allFlatErr?.message || rowFlatErr?.message || "Failed to load category.")
          setLoading(false)
          return
        }

        setSupportsParent(false)
        setNotice("Nested categories are not enabled yet. Apply `migration_phase1c_categories_hierarchy.sql` in Supabase to edit parent relationships.")
        setCategories((((allFlat as any[]) ?? []) as Array<{ id: string; name: string }>).map((c) => ({
          id: c.id,
          name: c.name,
          parent_category_id: null,
        })))

        const row = rowFlat as { id?: string; name?: string } | null
        if (!row?.id) {
          setError("Category not found (or not visible).")
          setLoading(false)
          return
        }
        setName(row.name ?? "")
        setParentId("")
        setLoading(false)
        return
      }

      setCategories((all as CategoryRow[]) ?? [])

      const row = data as CategoryRow | null
      if (!row?.id) {
        setError("Category not found (or not visible).")
        setLoading(false)
        return
      }
      setName(row.name ?? "")
      setParentId(row.parent_category_id ?? "")
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session, categoryId])

  const save = async () => {
    if (!categoryId) return
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Name is required.")
      return
    }
    setSaving(true)

    const nextParent = supportsParent ? (parentId || null) : null
    if (supportsParent) {
      if (nextParent === categoryId) {
        setSaving(false)
        setError("A category cannot be its own parent.")
        return
      }
      if (nextParent && descendantIds.has(nextParent)) {
        setSaving(false)
        setError("Invalid parent (would create a cycle).")
        return
      }
    }

    const updatePayload = supportsParent ? { name: trimmed, parent_category_id: nextParent } : { name: trimmed }
    const { error } = await supabase.from("categories").update(updatePayload).eq("id", categoryId)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate("/editor/categories", { replace: true })
  }

  const del = async () => {
    if (!categoryId) return
    const ok = window.confirm("Delete this category?\n\nThis cannot be undone.")
    if (!ok) return

    setDeleting(true)
    setError(null)
    const { error } = await supabase.from("categories").delete().eq("id", categoryId)
    setDeleting(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate("/editor/categories", { replace: true })
  }

  if (!categoryId) return null
  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Edit category</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error ? <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div> : null}
      {notice && !error ? (
        <div style={{ color: "var(--text-secondary)", marginBottom: 10, fontSize: 13 }}>{notice}</div>
      ) : null}

      <div className="card">
        <label>Name:</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || deleting} />

        {supportsParent ? (
          <>
            <label>Parent category (optional):</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              style={{ marginBottom: 12 }}
              disabled={saving || deleting}
            >
              <option value="">—</option>
              {orderedCategories
                .map((x) => x.c)
                .filter((c) => c.id !== categoryId && !descendantIds.has(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatTreeLabel(c)}
                  </option>
                ))}
            </select>
          </>
        ) : null}

        <button type="button" className="cta-button" onClick={save} disabled={saving || deleting}>
          {saving ? "Saving…" : "Save"}
        </button>

        <hr />

        <button
          type="button"
          className="secondary"
          onClick={del}
          disabled={saving || deleting}
          style={{ color: "var(--accent-red)", width: "100%" }}
        >
          {deleting ? "Deleting…" : "Delete category"}
        </button>
      </div>
    </div>
  )
}

