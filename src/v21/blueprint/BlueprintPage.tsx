import React, { useCallback, useEffect, useMemo, useState } from "react"
import EditorNav from "../../pages/editor/EditorNav"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import type { GlobalCategoryRow, TaskTemplateRow } from "./types"
import { CategoryTree } from "./CategoryTree"
import { TemplatePanel } from "./TemplatePanel"

export default function BlueprintPage() {
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [categories, setCategories] = useState<GlobalCategoryRow[]>([])
  const [templates, setTemplates] = useState<TaskTemplateRow[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => setLoading(false), 1500)
    try {
      const [catsRes, tplRes] = await Promise.all([
        supabase.from("global_categories").select("id,parent_category_id,name,archived_at,created_at").order("name").limit(5000),
        supabase.from("task_templates").select("id,global_category_id,name,description,period,metadata,archived_at,created_at").order("name").limit(10000),
      ])

      if (catsRes.error) throw catsRes.error
      if (tplRes.error) throw tplRes.error

      setCategories((catsRes.data as any as GlobalCategoryRow[]) ?? [])
      setTemplates((tplRes.data as any as TaskTemplateRow[]) ?? [])

      // Keep selection stable if possible.
      const catIds = new Set(((catsRes.data as any[]) ?? []).map((c) => String(c?.id ?? "")).filter(Boolean))
      if (selectedCategoryId && !catIds.has(selectedCategoryId)) setSelectedCategoryId(undefined)

      setLoading(false)
    } catch (e: any) {
      setError(e?.message || "Failed to load blueprint.")
      setCategories([])
      setTemplates([])
      setLoading(false)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }, [selectedCategoryId])

  useEffect(() => {
    if (!session) return
    void load()
  }, [session, load])

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null
    return categories.find((c) => c.id === selectedCategoryId) ?? null
  }, [categories, selectedCategoryId])

  const templatesInSelected = useMemo(() => {
    if (!selectedCategoryId) return []
    return templates.filter((t) => t.global_category_id === selectedCategoryId)
  }, [templates, selectedCategoryId])

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <EditorNav />
      <div className="screen-title">Editor · Blueprint</div>
      <div className="screen-subtitle">Admin-only. Global, read-only for everyone else.</div>

      {error ? (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.5fr", gap: 10, flex: 1, minHeight: 0 }}>
        <CategoryTree
          categories={categories}
          selectedId={selectedCategoryId}
          onSelect={(id) => setSelectedCategoryId(id)}
          onReload={load}
        />

        <TemplatePanel
          categoryId={selectedCategory?.id ?? null}
          categoryName={selectedCategory?.name ?? ""}
          templates={templatesInSelected}
          onReload={load}
        />
      </div>
    </div>
  )
}

