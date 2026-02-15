import React, { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"

type GlobalTemplateRow = {
  id: string
  title: string
  description: string | null
  interval_days: number | null
  checklist_json: any | null
  archived_at: string | null
}

type TemplateCategoryRow = {
  id: string
  name: string
  description: string | null
  archived_at: string | null
}

type CategoryTemplateRow = {
  category_id: string
  global_template_id: string
}

function isValidJsonOrBlank(raw: string): { ok: true; value: any | null } | { ok: false; error: string } {
  const t = raw.trim()
  if (!t) return { ok: true, value: null }
  try {
    return { ok: true, value: JSON.parse(t) }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Invalid JSON" }
  }
}

export default function AdminTemplatesPage() {
  const { session } = useSession()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [templates, setTemplates] = useState<GlobalTemplateRow[]>([])
  const [categories, setCategories] = useState<TemplateCategoryRow[]>([])
  const [links, setLinks] = useState<CategoryTemplateRow[]>([])

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  // Create: category
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDesc, setNewCategoryDesc] = useState("")
  const [creatingCategory, setCreatingCategory] = useState(false)

  // Create: template
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newIntervalDays, setNewIntervalDays] = useState("")
  const [newChecklistJson, setNewChecklistJson] = useState("")
  const [creatingTemplate, setCreatingTemplate] = useState(false)

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === selectedTemplateId) ?? null, [templates, selectedTemplateId])
  const selectedCategory = useMemo(() => categories.find((c) => c.id === selectedCategoryId) ?? null, [categories, selectedCategoryId])

  const linkedCategoryIdsForSelectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return new Set<string>()
    return new Set(links.filter((l) => l.global_template_id === selectedTemplateId).map((l) => l.category_id))
  }, [links, selectedTemplateId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => setLoading(false), 1500)
    try {
      const [{ data: t, error: tErr }, { data: c, error: cErr }, { data: m, error: mErr }] = await Promise.all([
        supabase
          .from("global_templates")
          .select("id,title,description,interval_days,checklist_json,archived_at")
          .order("title"),
        supabase.from("template_categories").select("id,name,description,archived_at").order("name"),
        supabase.from("category_templates").select("category_id,global_template_id"),
      ])

      const firstErr = tErr || cErr || mErr
      if (firstErr) {
        setError(firstErr.message)
        setTemplates([])
        setCategories([])
        setLinks([])
        setLoading(false)
        return
      }

      setTemplates((t as GlobalTemplateRow[]) ?? [])
      setCategories((c as TemplateCategoryRow[]) ?? [])
      setLinks((m as CategoryTemplateRow[]) ?? [])
      setLoading(false)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    if (!session) return
    void load()
  }, [session, load])

  const createCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) return

    setCreatingCategory(true)
    setError(null)

    const { error: insErr } = await supabase.from("template_categories").insert({
      name,
      description: newCategoryDesc.trim() ? newCategoryDesc.trim() : null,
      archived_at: null,
    })

    setCreatingCategory(false)
    if (insErr) {
      setError(insErr.message)
      return
    }

    setNewCategoryName("")
    setNewCategoryDesc("")
    await load()
  }

  const createTemplate = async () => {
    const title = newTitle.trim()
    if (!title) return

    const intervalRaw = newIntervalDays.trim()
    const interval = intervalRaw === "" ? null : Number(intervalRaw)
    if (interval !== null && (!Number.isFinite(interval) || interval <= 0)) {
      setError("Interval days must be a positive number (or blank).")
      return
    }

    const parsed = isValidJsonOrBlank(newChecklistJson)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    setCreatingTemplate(true)
    setError(null)

    const { error: insErr } = await supabase.from("global_templates").insert({
      title,
      description: newDesc.trim() ? newDesc.trim() : null,
      interval_days: interval,
      checklist_json: parsed.value,
      archived_at: null,
    })

    setCreatingTemplate(false)
    if (insErr) {
      setError(insErr.message)
      return
    }

    setNewTitle("")
    setNewDesc("")
    setNewIntervalDays("")
    setNewChecklistJson("")
    await load()
  }

  const saveSelectedTemplate = async (patch: Partial<GlobalTemplateRow>) => {
    if (!selectedTemplateId) return
    setError(null)
    const { error: upErr } = await supabase.from("global_templates").update(patch).eq("id", selectedTemplateId)
    if (upErr) {
      setError(upErr.message)
      return
    }
    await load()
  }

  const saveSelectedCategory = async (patch: Partial<TemplateCategoryRow>) => {
    if (!selectedCategoryId) return
    setError(null)
    const { error: upErr } = await supabase.from("template_categories").update(patch).eq("id", selectedCategoryId)
    if (upErr) {
      setError(upErr.message)
      return
    }
    await load()
  }

  const toggleLink = async (categoryId: string) => {
    if (!selectedTemplateId) return
    setError(null)

    const isLinked = linkedCategoryIdsForSelectedTemplate.has(categoryId)
    if (!isLinked) {
      const { error: upErr } = await supabase
        .from("category_templates")
        .upsert(
          { category_id: categoryId, global_template_id: selectedTemplateId },
          { onConflict: "category_id,global_template_id" }
        )
      if (upErr) setError(upErr.message)
    } else {
      const { error: delErr } = await supabase
        .from("category_templates")
        .delete()
        .eq("category_id", categoryId)
        .eq("global_template_id", selectedTemplateId)
      if (delErr) setError(delErr.message)
    }

    await load()
  }

  if (!session) return <div className="screen">Loading…</div>
  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <div className="screen-title">Admin · Templates</div>
      <div className="screen-subtitle">Global templates, categories, and links.</div>

      {error ? (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div>
      ) : null}

      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Create category</div>
        <label>Name:</label>
        <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} style={{ marginBottom: 10 }} disabled={creatingCategory} />
        <label>Description (optional):</label>
        <textarea value={newCategoryDesc} onChange={(e) => setNewCategoryDesc(e.target.value)} rows={2} style={{ marginBottom: 12 }} disabled={creatingCategory} />
        <button type="button" className="cta-button" onClick={createCategory} disabled={creatingCategory || !newCategoryName.trim()}>
          {creatingCategory ? "Creating…" : "Create category"}
        </button>
      </div>

      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Create template</div>
        <label>Title:</label>
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ marginBottom: 10 }} disabled={creatingTemplate} />
        <label>Description (optional):</label>
        <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} style={{ marginBottom: 10 }} disabled={creatingTemplate} />
        <label>Interval days (optional):</label>
        <input value={newIntervalDays} onChange={(e) => setNewIntervalDays(e.target.value)} style={{ marginBottom: 10 }} disabled={creatingTemplate} />
        <label>Checklist JSON (optional):</label>
        <textarea value={newChecklistJson} onChange={(e) => setNewChecklistJson(e.target.value)} rows={3} style={{ marginBottom: 12 }} disabled={creatingTemplate} />
        <button type="button" className="cta-button" onClick={createTemplate} disabled={creatingTemplate || !newTitle.trim()}>
          {creatingTemplate ? "Creating…" : "Create template"}
        </button>
      </div>

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Global templates</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{templates.length}</div>
        </div>

        {templates.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No templates.</div>
        ) : (
          templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className="list-button"
              onClick={() => setSelectedTemplateId(t.id)}
              style={{ opacity: selectedTemplateId === t.id ? 1 : 0.98 }}
            >
              <div className="list-button-main">
                <div className="list-button-title">
                  {t.title}
                  {t.archived_at ? <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>(Archived)</span> : null}
                </div>
                <div className="list-button-subtitle">{t.description || "—"}</div>
              </div>
              <div className="list-button-chevron">›</div>
            </button>
          ))
        )}
      </div>

      {selectedTemplate ? (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Edit template</div>
          <label>Title:</label>
          <input
            value={selectedTemplate.title ?? ""}
            onChange={(e) => setTemplates((prev) => prev.map((x) => (x.id === selectedTemplate.id ? { ...x, title: e.target.value } : x)))}
            style={{ marginBottom: 10 }}
          />
          <label>Description:</label>
          <textarea
            value={selectedTemplate.description ?? ""}
            onChange={(e) => setTemplates((prev) => prev.map((x) => (x.id === selectedTemplate.id ? { ...x, description: e.target.value } : x)))}
            rows={2}
            style={{ marginBottom: 10 }}
          />
          <label>Interval days:</label>
          <input
            value={selectedTemplate.interval_days === null ? "" : String(selectedTemplate.interval_days)}
            onChange={(e) => {
              const raw = e.target.value
              setTemplates((prev) =>
                prev.map((x) =>
                  x.id === selectedTemplate.id
                    ? { ...x, interval_days: raw.trim() === "" ? null : Number(raw) }
                    : x
                )
              )
            }}
            style={{ marginBottom: 10 }}
          />
          <label>Checklist JSON:</label>
          <textarea
            value={selectedTemplate.checklist_json ? JSON.stringify(selectedTemplate.checklist_json, null, 2) : ""}
            onChange={(e) => {
              const parsed = isValidJsonOrBlank(e.target.value)
              if (!parsed.ok) {
                setError(parsed.error)
                return
              }
              setError(null)
              setTemplates((prev) => prev.map((x) => (x.id === selectedTemplate.id ? { ...x, checklist_json: parsed.value } : x)))
            }}
            rows={4}
            style={{ marginBottom: 12 }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="cta-button"
              onClick={() =>
                saveSelectedTemplate({
                  title: selectedTemplate.title.trim(),
                  description: selectedTemplate.description?.trim() ? selectedTemplate.description.trim() : null,
                  interval_days: selectedTemplate.interval_days,
                  checklist_json: selectedTemplate.checklist_json ?? null,
                })
              }
            >
              Save
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                saveSelectedTemplate({
                  archived_at: selectedTemplate.archived_at ? null : new Date().toISOString(),
                })
              }
            >
              {selectedTemplate.archived_at ? "Unarchive" : "Archive"}
            </button>
          </div>

          <hr />

          <div style={{ fontWeight: 800, marginBottom: 8 }}>Link to categories</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
            Toggle category links for the selected template.
          </div>
          {categories.length === 0 ? (
            <div style={{ opacity: 0.75, fontSize: 13 }}>No categories.</div>
          ) : (
            categories.map((c) => {
              const checked = linkedCategoryIdsForSelectedTemplate.has(c.id)
              return (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleLink(c.id)} />
                  <span style={{ fontSize: 13 }}>
                    {c.name}
                    {c.archived_at ? <span style={{ marginLeft: 8, opacity: 0.7 }}>(Archived)</span> : null}
                  </span>
                </label>
              )
            })
          )}
        </div>
      ) : null}

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Template categories</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{categories.length}</div>
        </div>

        {categories.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No categories.</div>
        ) : (
          categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="list-button"
              onClick={() => setSelectedCategoryId(c.id)}
            >
              <div className="list-button-main">
                <div className="list-button-title">
                  {c.name}
                  {c.archived_at ? <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>(Archived)</span> : null}
                </div>
                <div className="list-button-subtitle">{c.description || "—"}</div>
              </div>
              <div className="list-button-chevron">›</div>
            </button>
          ))
        )}
      </div>

      {selectedCategory ? (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Edit category</div>
          <label>Name:</label>
          <input
            value={selectedCategory.name ?? ""}
            onChange={(e) => setCategories((prev) => prev.map((x) => (x.id === selectedCategory.id ? { ...x, name: e.target.value } : x)))}
            style={{ marginBottom: 10 }}
          />
          <label>Description:</label>
          <textarea
            value={selectedCategory.description ?? ""}
            onChange={(e) => setCategories((prev) => prev.map((x) => (x.id === selectedCategory.id ? { ...x, description: e.target.value } : x)))}
            rows={2}
            style={{ marginBottom: 12 }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="cta-button"
              onClick={() =>
                saveSelectedCategory({
                  name: selectedCategory.name.trim(),
                  description: selectedCategory.description?.trim() ? selectedCategory.description.trim() : null,
                })
              }
            >
              Save
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                saveSelectedCategory({
                  archived_at: selectedCategory.archived_at ? null : new Date().toISOString(),
                })
              }
            >
              {selectedCategory.archived_at ? "Unarchive" : "Archive"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

