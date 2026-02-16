import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"
import EditorNav from "./editor/EditorNav"
import { buildCategorySelectOptions, type CategoryTreeRow } from "../utils/categoryTreeUi"
import { useMyRole } from "../hooks/useMyRole"
import { loadManagerScopeGroupIds } from "../utils/groupScope"
import { buildGroupParentSelectOptions, type GroupTreeRow } from "../utils/groupTreeUi"

export default function NewTaskPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session } = useSession()
  const { role, loading: roleLoading } = useMyRole()

  const [title, setTitle] = useState("")
  const [status, setStatus] = useState("pending")
  const [yachtId, setYachtId] = useState("")
  const [dueLocal, setDueLocal] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [description, setDescription] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [assignedToManual, setAssignedToManual] = useState("")
  const [groupId, setGroupId] = useState("")

  const [yachts, setYachts] = useState<Array<{ id: string; name: string; group_id: string | null }>>([])
  const [templates, setTemplates] = useState<Array<{ id: string; title: string }>>([])
  const [categories, setCategories] = useState<CategoryTreeRow[]>([])
  const [groups, setGroups] = useState<GroupTreeRow[]>([])
  const [users, setUsers] = useState<Array<{ id: string; full_name: string | null; email: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const categoryOptions = useMemo(() => buildCategorySelectOptions(categories), [categories])
  const STATUS_OPTIONS = useMemo(() => ["pending", "in_progress", "blocked", "completed", "cancelled"] as const, [])
  const groupOptions = useMemo(() => buildGroupParentSelectOptions(groups), [groups])

  const visibleYachts = useMemo(() => {
    if (!groupId) return yachts
    return yachts.filter((y) => y.group_id === groupId)
  }, [yachts, groupId])

  useEffect(() => {
    if (!groupId) return
    if (!yachtId) return
    const ok = yachts.some((y) => y.id === yachtId && y.group_id === groupId)
    if (!ok) setYachtId("")
  }, [groupId, yachtId, yachts])

  const dueIso = useMemo(() => {
    const raw = dueLocal.trim()
    if (!raw) return null
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
  }, [dueLocal])

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      const scopeGroupIds = role === "manager" ? await loadManagerScopeGroupIds(session.user.id) : null

      const loadYachts = async () => {
        if (role === "manager" && scopeGroupIds && scopeGroupIds.length === 0) return []
        let q = supabase.from("yachts").select("id,name,group_id").order("name")
        if (role === "manager" && scopeGroupIds && scopeGroupIds.length > 0) q = q.in("group_id", scopeGroupIds)
        const { data, error } = await q
        if (error) throw error
        return (data as any[]) ?? []
      }

      const loadTemplateOptions = async (): Promise<Array<{ id: string; title: string }>> => {
        if (role === "manager") {
          if (scopeGroupIds && scopeGroupIds.length === 0) return []
          const { data, error } = await supabase
            .from("templates")
            .select("id,name,group_id")
            .order("name")
            .limit(5000)

          if (error) throw error
          const rows = ((data as any[]) ?? []) as any[]
          const filtered = scopeGroupIds && scopeGroupIds.length > 0
            ? rows.filter((r) => scopeGroupIds.includes(String(r.group_id ?? "")))
            : rows
          const groupTemplates = filtered.map((r) => ({ id: String(r.id), title: String(r.name ?? "") }))

          // Managers can also choose global templates (if the table exists).
          const { data: gt, error: gtErr } = await supabase
            .from("global_templates")
            .select("id,title")
            .order("title")
            .limit(5000)

          const globalMissing =
            !!gtErr &&
            (String(gtErr.message || "").toLowerCase().includes("could not find the table") ||
              String(gtErr.message || "").toLowerCase().includes("does not exist"))

          const globalTemplates = globalMissing || gtErr
            ? []
            : ((gt as any[]) ?? []).map((r) => ({ id: String(r.id), title: String(r.title ?? "") }))

          if (gtErr && !globalMissing) throw gtErr

          const merged = new Map<string, { id: string; title: string }>()
          for (const t of [...globalTemplates, ...groupTemplates]) merged.set(t.id, t)
          return Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title))
        }

        const { data, error } = await supabase
          .from("global_templates")
          .select("id,title")
          .order("title")
          .limit(5000)

        if (error) throw error
        return ((data as any[]) ?? []).map((r) => ({ id: String(r.id), title: String(r.title ?? "") }))
      }

      const loadCategories = async (): Promise<CategoryTreeRow[]> => {
        const runQuery = async (withGroup: boolean) => {
          let q = supabase
            .from("categories")
            .select(withGroup ? "id,name,parent_category_id,group_id" : "id,name,parent_category_id")
            .order("name")
            .limit(5000)
          if (withGroup && role === "manager" && scopeGroupIds && scopeGroupIds.length > 0) {
            q = q.in("group_id", scopeGroupIds)
          }
          return await q
        }

        let { data, error } = await runQuery(true)
        if (!error) return (data as CategoryTreeRow[]) ?? []

        const msg = String(error.message || "")
        const missingGroupCol = msg.includes("group_id") && msg.toLowerCase().includes("does not exist")
        if (missingGroupCol) {
          ;({ data, error } = await runQuery(false))
          if (!error) return (data as CategoryTreeRow[]) ?? []
        }

        const missingParentCol = msg.includes("parent_category_id") && msg.toLowerCase().includes("does not exist")
        if (!missingParentCol) throw error

        const { data: flat, error: flatErr } = await supabase
          .from("categories")
          .select("id,name")
          .order("name")
          .limit(5000)

        if (flatErr) throw flatErr

        return (((flat as any[]) ?? []) as Array<{ id: string; name: string }>).map((c) => ({
          id: String(c.id),
          name: String(c.name ?? ""),
          parent_category_id: null,
        }))
      }

      const loadGroups = async (): Promise<GroupTreeRow[]> => {
        let q = supabase.from("groups").select("id,name,parent_group_id").order("name").limit(5000)
        if (role === "manager" && scopeGroupIds && scopeGroupIds.length > 0) {
          q = q.in("id", scopeGroupIds)
        }
        if (role === "manager" && scopeGroupIds && scopeGroupIds.length === 0) return []
        const { data, error } = await q
        if (error) throw error
        return (data as GroupTreeRow[]) ?? []
      }

      const loadUsersDirectory = async () => {
        try {
          const { data, error } = await supabase.from("users").select("id,full_name,email").order("email").limit(500)
          if (error) return []
          return ((data as any[]) ?? []).map((r) => ({
            id: String(r.id),
            full_name: (r.full_name ?? null) as string | null,
            email: (r.email ?? null) as string | null,
          }))
        } catch {
          return []
        }
      }

      try {
        const [y, tpl, cats, grp, dir] = await Promise.all([
          loadYachts(),
          loadTemplateOptions(),
          loadCategories(),
          loadGroups(),
          loadUsersDirectory(),
        ])

        if (cancelled) return

        setYachts(((y as any[]) ?? []).map((r) => ({ id: String(r.id), name: String(r.name ?? ""), group_id: (r.group_id ?? null) as string | null })))
        setTemplates((tpl as Array<{ id: string; title: string }>) ?? [])
        setCategories((cats as CategoryTreeRow[]) ?? [])
        setGroups((grp as GroupTreeRow[]) ?? [])
        setUsers((dir as Array<{ id: string; full_name: string | null; email: string | null }>) ?? [])
        setLoading(false)
      } catch (e: any) {
        if (cancelled) return
        setError(String(e?.message ?? e ?? "Failed to load."))
        setYachts([])
        setTemplates([])
        setCategories([])
        setGroups([])
        setUsers([])
        setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [session, role])

  useEffect(() => {
    if (loading) return
    if (yachtId) return
    const preselect = searchParams.get("yachtId")
    if (preselect) setYachtId(preselect)
  }, [loading, searchParams, yachtId])

  const handleCreate = async () => {
    setError(null)
    setNotice(null)

    const trimmedName = title.trim()
    const trimmedStatus = status.trim()
    const trimmedDescription = description.trim()
    const assignedId = assignedToManual.trim() || assignedTo.trim()

    if (!trimmedName) {
      setError("Task title is required.")
      return
    }
    if (!yachtId) {
      setError("Yacht is required.")
      return
    }

    const nextStatus = trimmedStatus || "pending"

    setSaving(true)

    const { data, error: insertError } = await supabase
      .from("tasks")
      .insert({
        title: trimmedName,
        status: nextStatus,
        yacht_id: yachtId,
        due_date: dueIso,
        template_id: templateId ? templateId : null,
        category_id: categoryId ? categoryId : null,
        description: trimmedDescription ? trimmedDescription : null,
        assigned_to: assignedId ? assignedId : null,
      })
      .select("id")
      .single()

    setSaving(false)

    if (insertError) {
      const msg = String(insertError.message || "")
      const isRls =
        msg.toLowerCase().includes("row-level security") ||
        msg.toLowerCase().includes("violates row-level security") ||
        msg.toLowerCase().includes("rls")

      if (isRls) {
        setNotice(
          "Your account is blocked by Supabase RLS for `tasks` INSERT.\n\nFix: apply `docs/v2/migration_tasks_rls_admin_manager.sql` in the Supabase SQL editor (or your migrations pipeline), then try again."
        )
      }
      setError(insertError.message)
      return
    }

    const newId = (data as any)?.id as string | undefined
    if (!newId) {
      setError("Task created, but no ID returned.")
      return
    }

    navigate(`/editor/tasks/${newId}`, { replace: true })
  }

  if (roleLoading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Create task</div>
      <div className="screen-subtitle">Admin or manager.</div>

      {error ? <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div> : null}
      {notice && !error ? (
        <div style={{ color: "var(--text-secondary)", marginBottom: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>
          {notice}
        </div>
      ) : null}
      {notice && error ? (
        <div style={{ color: "var(--text-secondary)", marginBottom: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>Loading…</div>
      ) : (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Task</div>

          <label>Task:</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 12 }} disabled={saving} />

          <label>Description (optional):</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            style={{ marginBottom: 12 }}
            disabled={saving}
            placeholder="Add details, steps, parts used, notes…"
          />

          <label>Status:</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ marginBottom: 6 }} disabled={saving}>
            <option value="">— (defaults to pending)</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
            Leave blank to default to <strong>pending</strong>.
          </div>

          <label>Yacht:</label>
          {groupOptions.length > 0 ? (
            <>
              <label>Assign to group (optional):</label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving}>
                <option value="">—</option>
                {groupOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          <label>Yacht:</label>
          <select value={yachtId} onChange={(e) => setYachtId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving}>
            <option value="">Select yacht…</option>
            {visibleYachts.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name || y.id}
              </option>
            ))}
          </select>

          <label>Due date (optional):</label>
          <input type="datetime-local" value={dueLocal} onChange={(e) => setDueLocal(e.target.value)} style={{ marginBottom: 12 }} disabled={saving} />

          <label>Template (optional):</label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving}>
            <option value="">—</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title || t.id}
              </option>
            ))}
          </select>

          <label>Category (optional):</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving}>
            <option value="">—</option>
            {categoryOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          <label>Assign to crew (optional):</label>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || users.length === 0}>
            <option value="">{users.length === 0 ? "User directory unavailable" : "—"}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email || u.id}
              </option>
            ))}
          </select>

          {users.length === 0 ? (
            <>
              <label>Or paste crew UUID (optional):</label>
              <input
                value={assignedToManual}
                onChange={(e) => setAssignedToManual(e.target.value)}
                style={{ marginBottom: 12 }}
                disabled={saving}
                placeholder="user UUID…"
              />
            </>
          ) : null}

          <button type="button" className="cta-button" onClick={handleCreate} disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      )}
    </div>
  )
}

