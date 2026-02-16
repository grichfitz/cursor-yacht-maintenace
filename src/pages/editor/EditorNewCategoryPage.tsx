import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import EditorNav from "./EditorNav"
import { useSession } from "../../auth/SessionProvider"
import { useMyRole } from "../../hooks/useMyRole"
import { loadManagerScopeGroupIds } from "../../utils/groupScope"
import { buildGroupParentSelectOptions, type GroupTreeRow } from "../../utils/groupTreeUi"

type CategoryRow = { id: string; name: string; parent_category_id: string | null }

export default function EditorNewCategoryPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { role, loading: roleLoading } = useMyRole()

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [parentId, setParentId] = useState<string>("")
  const [groupId, setGroupId] = useState<string>("")
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [groups, setGroups] = useState<GroupTreeRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supportsParent, setSupportsParent] = useState(true)
  const [supportsGroup, setSupportsGroup] = useState(true)
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

  const groupOptions = useMemo(() => buildGroupParentSelectOptions(groups), [groups])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setNotice(null)

      try {
        const scopeIds = role === "manager" ? await loadManagerScopeGroupIds(session.user.id) : null

        const groupQuery =
          scopeIds && scopeIds.length > 0
            ? supabase.from("groups").select("id,name,parent_group_id").in("id", scopeIds).order("name")
            : supabase.from("groups").select("id,name,parent_group_id").order("name")

        const [{ data: catData, error: loadErr }, { data: groupData, error: gErr }] = await Promise.all([
          supabase.from("categories").select("id,name,parent_category_id").order("name"),
          groupQuery,
        ])

        if (cancelled) return
        if (gErr) throw gErr
        setGroups((groupData as GroupTreeRow[]) ?? [])

        if (loadErr) {
          const msg = String(loadErr.message || "")
          const missingParentCol = msg.includes("parent_category_id") && msg.toLowerCase().includes("does not exist")
          if (!missingParentCol) throw loadErr

          const { data: flat, error: flatErr } = await supabase.from("categories").select("id,name").order("name")
          if (cancelled) return
          if (flatErr) throw flatErr

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

        setCategories((catData as CategoryRow[]) ?? [])
        setLoading(false)
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message || "Failed to load categories.")
        setCategories([])
        setGroups([])
        setLoading(false)
      }
      if (cancelled) return
    }
    load()
    return () => {
      cancelled = true
    }
  }, [session, role])

  const create = async () => {
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Category name is required.")
      return
    }
    if (supportsGroup && !groupId) {
      setError("Group is required.")
      return
    }

    setSaving(true)
    const payloadBase = supportsParent ? { name: trimmed, parent_category_id: parentId || null } : { name: trimmed }
    const payload = supportsGroup ? { ...payloadBase, group_id: groupId } : payloadBase
    const { error: insErr } = await supabase.from("categories").insert(payload as any)
    setSaving(false)

    if (insErr) {
      const msg = String(insErr.message || "")
      const isRls = msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("violates row level security")
      const missingGroupCol = msg.includes("group_id") && msg.toLowerCase().includes("does not exist")
      if (missingGroupCol) {
        // Backward compat: categories without group scoping.
        setSupportsGroup(false)
        setNotice("Category groups are not enabled in this database yet (missing `categories.group_id`).")
      }
      if (isRls) {
        setNotice(
          "Supabase RLS is blocking category creation. Apply `docs/v2/migration_categories_rls_admin_manager.sql` in Supabase (SQL Editor) to allow admin/manager inserts."
        )
      }
      setError(insErr.message)
      return
    }

    navigate("/editor/categories", { replace: true })
  }

  if (loading || roleLoading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Create category</div>
      <div className="screen-subtitle">Admin or manager.</div>

      {error && <div style={{ color: "var(--accent-red)", marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {notice && !error ? (
        <div style={{ color: "var(--text-secondary)", marginBottom: 12, fontSize: 13 }}>{notice}</div>
      ) : null}

      <div className="card">
        {supportsGroup ? (
          <>
            <label>Group:</label>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving}>
              <option value="">Select group…</option>
              {groupOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
        ) : null}

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

