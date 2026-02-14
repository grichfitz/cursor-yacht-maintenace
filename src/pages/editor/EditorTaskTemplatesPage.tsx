import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import EditorNav from "./EditorNav"
import { useSession } from "../../auth/SessionProvider"

type GroupRow = { id: string; name: string }
type CategoryRow = { id: string; name: string }

type TemplateRow = {
  id: string
  name: string
  description: string | null
  category_id: string | null
  interval_days: number | null
  default_group_id: string | null
}

export default function EditorTaskTemplatesPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [groups, setGroups] = useState<GroupRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>()
    categories.forEach((c) => m.set(c.id, c.name))
    return m
  }, [categories])

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>()
    groups.forEach((g) => m.set(g.id, g.name))
    return m
  }, [groups])

  const load = async () => {
    setLoading(true)
    setError(null)

    const [{ data: g, error: gErr }, { data: c, error: cErr }, { data: t, error: tErr }] =
      await Promise.all([
        supabase.from("groups").select("id,name").order("name"),
        supabase.from("categories").select("id,name").order("name"),
        supabase
          .from("task_templates")
          .select("id,name,description,category_id,interval_days,default_group_id")
          .order("name"),
      ])

    const firstErr = gErr || cErr || tErr
    if (firstErr) {
      setError(firstErr.message)
      setLoading(false)
      return
    }

    setGroups((g as GroupRow[]) ?? [])
    setCategories((c as CategoryRow[]) ?? [])
    setTemplates((t as TemplateRow[]) ?? [])
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

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Editor · Tasks</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="card">
        <button
          type="button"
          className="secondary"
          style={{ width: "100%" }}
          onClick={() => navigate("/editor/task-templates/new")}
        >
          New task
        </button>
      </div>

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Tasks</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{templates.length}</div>
        </div>

        {templates.map((t) => (
          <div key={t.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="list-row" style={{ justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontWeight: 800 }}>{t.name}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {(t.category_id && categoryNameById.get(t.category_id)) || "No category"}
                  {t.default_group_id ? ` · Default: ${groupNameById.get(t.default_group_id) ?? "—"}` : ""}
                  {t.interval_days ? ` · Every ${t.interval_days}d` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="secondary" onClick={() => navigate(`/editor/task-templates/${t.id}`)}>
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

