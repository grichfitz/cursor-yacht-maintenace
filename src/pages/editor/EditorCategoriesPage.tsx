import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import EditorNav from "./EditorNav"
import { useSession } from "../../auth/SessionProvider"
import TreeDisplay, { type TreeNode } from "../../components/TreeDisplay"
import { useMyRole } from "../../hooks/useMyRole"
import { loadManagerScopeGroupIds } from "../../utils/groupScope"

type CategoryRow = { id: string; name: string; parent_category_id: string | null }

export default function EditorCategoriesPage() {
  const { session } = useSession()
  const { role, loading: roleLoading } = useMyRole()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  const nodes = useMemo(() => {
    const byId = new Set(categories.map((c) => c.id))
    const out: TreeNode[] = categories.map((c) => ({
      id: c.id,
      parentId: c.parent_category_id && byId.has(c.parent_category_id) ? c.parent_category_id : null,
      label: c.name,
      nodeType: "category",
      meta: c,
    }))
    return out
  }, [categories])

  const load = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      let scopeIds: string[] | null = null
      if (role === "manager") scopeIds = await loadManagerScopeGroupIds(session!.user.id)

      const runQuery = async (withGroup: boolean) => {
        let q = supabase
          .from("categories")
          .select(withGroup ? "id,name,parent_category_id,group_id" : "id,name,parent_category_id")
          .order("name")

        if (withGroup && scopeIds && scopeIds.length > 0) q = q.in("group_id", scopeIds)
        return await q
      }

      if (scopeIds && scopeIds.length === 0) {
        setCategories([])
        setLoading(false)
        return
      }

      let { data, error: loadErr } = await runQuery(true)

      if (loadErr) {
        const msg = String(loadErr.message || "")
        const missingGroupCol = msg.includes("group_id") && msg.toLowerCase().includes("does not exist")
        if (missingGroupCol) {
          ;({ data, error: loadErr } = await runQuery(false))
        }
      }

      if (loadErr) {
        // Backward-compat: if the hierarchy migration isn't applied yet, fall back to flat categories.
        const msg = String(loadErr.message || "")
        const missingParentCol =
          msg.includes("parent_category_id") && msg.toLowerCase().includes("does not exist")
        if (!missingParentCol) throw loadErr

        const { data: flat, error: flatErr } = await supabase
          .from("categories")
          .select("id,name")
          .order("name")

        if (flatErr) throw flatErr

        setCategories((((flat as any[]) ?? []) as Array<{ id: string; name: string }>).map((c) => ({
          id: c.id,
          name: c.name,
          parent_category_id: null,
        })))
        setNotice("Nested categories are not enabled yet. Apply `migration_phase1c_categories_hierarchy.sql` in Supabase.")
        setLoading(false)
        return
      }

      setCategories((data as CategoryRow[]) ?? [])
      setLoading(false)
    } catch (e: any) {
      setError(e?.message || "Failed to load categories.")
      setCategories([])
      setLoading(false)
    }
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
  }, [session, role])

  if (loading || roleLoading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Editor · Categories</div>
      <div className="screen-subtitle">Admin or manager.</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {notice && !error && (
        <div style={{ color: "var(--text-secondary)", marginBottom: 10, fontSize: 13 }}>
          {notice}
        </div>
      )}

      <div className="card">
        <button
          type="button"
          className="secondary"
          style={{ width: "100%" }}
          onClick={() => navigate("/editor/categories/new")}
        >
          New category
        </button>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>Categories</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{categories.length}</div>
        </div>

        <TreeDisplay
          nodes={nodes}
          selectedId={selectedId}
          onSelect={(n) => setSelectedId(n.id)}
          renderActions={(node) => {
            const c = (node.meta as CategoryRow) ?? null
            if (!c) return null
            return (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="secondary" onClick={() => navigate(`/editor/categories/${c.id}`)}>
                  Edit
                </button>
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}

