import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"

type GroupRow = {
  id: string
  name: string
  archived_at: string | null
}

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

type GroupTemplateRow = {
  id: string
  group_id: string
  origin_global_template_id: string | null
  title: string
  description: string | null
  interval_days: number | null
  checklist_json: any | null
  active: boolean
  archived_at: string | null
}

function parseJsonOrNull(raw: string): { ok: true; value: any | null } | { ok: false; error: string } {
  const t = raw.trim()
  if (!t) return { ok: true, value: null }
  try {
    return { ok: true, value: JSON.parse(t) }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Invalid JSON" }
  }
}

export default function GroupTemplatesPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const { session } = useSession()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [group, setGroup] = useState<GroupRow | null>(null)
  const [globalTemplates, setGlobalTemplates] = useState<GlobalTemplateRow[]>([])
  const [categories, setCategories] = useState<TemplateCategoryRow[]>([])
  const [groupTemplates, setGroupTemplates] = useState<GroupTemplateRow[]>([])

  const [workingId, setWorkingId] = useState<string | null>(null)

  const [selectedGroupTemplateId, setSelectedGroupTemplateId] = useState<string | null>(null)
  const selectedGroupTemplate = useMemo(
    () => groupTemplates.find((t) => t.id === selectedGroupTemplateId) ?? null,
    [groupTemplates, selectedGroupTemplateId]
  )

  // Local edit buffer for group_templates
  const [editTitle, setEditTitle] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editInterval, setEditInterval] = useState("")
  const [editChecklist, setEditChecklist] = useState("")

  useEffect(() => {
    if (!selectedGroupTemplate) return
    setEditTitle(selectedGroupTemplate.title ?? "")
    setEditDesc(selectedGroupTemplate.description ?? "")
    setEditInterval(selectedGroupTemplate.interval_days === null ? "" : String(selectedGroupTemplate.interval_days))
    setEditChecklist(selectedGroupTemplate.checklist_json ? JSON.stringify(selectedGroupTemplate.checklist_json, null, 2) : "")
  }, [selectedGroupTemplate?.id])

  const load = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => setLoading(false), 1500)
    try {
      const [{ data: g, error: gErr }, { data: t, error: tErr }, { data: c, error: cErr }, { data: gt, error: gtErr }] =
        await Promise.all([
          supabase.from("groups").select("id,name,archived_at").eq("id", groupId).maybeSingle(),
          supabase
            .from("global_templates")
            .select("id,title,description,interval_days,checklist_json,archived_at")
            .order("title"),
          supabase.from("template_categories").select("id,name,description,archived_at").order("name"),
          supabase
            .from("group_templates")
            .select("id,group_id,origin_global_template_id,title,description,interval_days,checklist_json,active,archived_at")
            .eq("group_id", groupId)
            .order("title"),
        ])

      const firstErr = gErr || tErr || cErr || gtErr
      if (firstErr) {
        setError(firstErr.message)
        setGroup(null)
        setGlobalTemplates([])
        setCategories([])
        setGroupTemplates([])
        setLoading(false)
        return
      }

      setGroup((g as GroupRow) ?? null)
      setGlobalTemplates((t as GlobalTemplateRow[]) ?? [])
      setCategories((c as TemplateCategoryRow[]) ?? [])
      setGroupTemplates((gt as GroupTemplateRow[]) ?? [])
      setLoading(false)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }, [groupId])

  useEffect(() => {
    if (!session) return
    if (!groupId) return
    void load()
  }, [session, groupId, load])

  const assignGlobalTemplateToGroup = async (templateId: string) => {
    if (!groupId) return
    setWorkingId(templateId)
    setError(null)

    // Canonical YM v2 RPC (per YM_V2_CANONICAL_ARCHITECTURE.md).
    const { error: rpcErr } = await supabase.rpc("assign_global_template_to_group", {
      p_group_id: groupId,
      p_global_template_id: templateId,
    })

    setWorkingId(null)
    if (rpcErr) {
      setError(rpcErr.message)
      return
    }
    await load()
  }

  const assignCategoryToGroup = async (categoryId: string) => {
    if (!groupId) return
    setWorkingId(categoryId)
    setError(null)

    const { error: rpcErr } = await supabase.rpc("assign_category_to_group", {
      p_group_id: groupId,
      p_category_id: categoryId,
    })

    setWorkingId(null)
    if (rpcErr) {
      setError(rpcErr.message)
      return
    }
    await load()
  }

  const saveGroupTemplate = async () => {
    if (!groupId) return
    if (!selectedGroupTemplate) return

    const title = editTitle.trim()
    if (!title) {
      setError("Title is required.")
      return
    }

    const intervalRaw = editInterval.trim()
    const interval = intervalRaw === "" ? null : Number(intervalRaw)
    if (interval !== null && (!Number.isFinite(interval) || interval <= 0)) {
      setError("Interval days must be a positive number (or blank).")
      return
    }

    const parsed = parseJsonOrNull(editChecklist)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    setError(null)
    const { error: upErr } = await supabase
      .from("group_templates")
      .update({
        title,
        description: editDesc.trim() ? editDesc.trim() : null,
        interval_days: interval,
        checklist_json: parsed.value,
      })
      .eq("id", selectedGroupTemplate.id)
      .eq("group_id", groupId)

    if (upErr) {
      setError(upErr.message)
      return
    }
    await load()
  }

  if (!session) return <div className="screen">Loading…</div>

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <div className="screen-title">Group · Templates</div>
      <div className="screen-subtitle">{group?.name || groupId}</div>

      {error ? <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div> : null}

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Global templates</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{globalTemplates.length}</div>
        </div>

        {globalTemplates.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No templates.</div>
        ) : (
          globalTemplates.map((t) => (
            <div key={t.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="list-row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: 700 }}>
                    {t.title}
                    {t.archived_at ? <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>(Archived)</span> : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{t.description || "—"}</div>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => assignGlobalTemplateToGroup(t.id)}
                  disabled={workingId === t.id}
                  style={{ opacity: workingId === t.id ? 0.6 : 1 }}
                >
                  {workingId === t.id ? "Assigning…" : "Assign to Group"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Template categories</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{categories.length}</div>
        </div>

        {categories.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No categories.</div>
        ) : (
          categories.map((c) => (
            <div key={c.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="list-row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: 700 }}>
                    {c.name}
                    {c.archived_at ? <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>(Archived)</span> : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{c.description || "—"}</div>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => assignCategoryToGroup(c.id)}
                  disabled={workingId === c.id}
                  style={{ opacity: workingId === c.id ? 0.6 : 1 }}
                >
                  {workingId === c.id ? "Assigning…" : "Assign Category"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Group templates</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{groupTemplates.length}</div>
        </div>

        {groupTemplates.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No group templates.</div>
        ) : (
          groupTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              className="list-button"
              onClick={() => setSelectedGroupTemplateId(t.id)}
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

      {selectedGroupTemplate ? (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Edit group template</div>
          <label>Title:</label>
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ marginBottom: 10 }} />
          <label>Description:</label>
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} style={{ marginBottom: 10 }} />
          <label>Interval days:</label>
          <input value={editInterval} onChange={(e) => setEditInterval(e.target.value)} style={{ marginBottom: 10 }} />
          <label>Checklist JSON:</label>
          <textarea value={editChecklist} onChange={(e) => setEditChecklist(e.target.value)} rows={4} style={{ marginBottom: 12 }} />

          <button type="button" className="cta-button" onClick={saveGroupTemplate}>
            Save
          </button>
        </div>
      ) : null}
    </div>
  )
}

