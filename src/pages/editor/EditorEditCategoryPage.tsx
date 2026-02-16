import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"
import { useMyRole } from "../../hooks/useMyRole"
import { loadManagerScopeGroupIds } from "../../utils/groupScope"
import { buildGroupParentSelectOptions, type GroupTreeRow } from "../../utils/groupTreeUi"

type CategoryRow = { id: string; name: string; parent_category_id: string | null; group_id?: string | null; archived_at?: string | null }
type YachtRow = { id: string; name: string }
type TaskRow = {
  id: string
  title: string
  status: string
  yacht_id: string
  category_id: string | null
  due_date: string | null
}

export default function EditorEditCategoryPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { categoryId } = useParams<{ categoryId: string }>()
  const { role, loading: roleLoading } = useMyRole()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supportsParent, setSupportsParent] = useState(true)
  const [supportsGroup, setSupportsGroup] = useState(true)
  const [supportsArchive, setSupportsArchive] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [parentId, setParentId] = useState<string>("")
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [categoryGroupId, setCategoryGroupId] = useState<string | null>(null)
  const [archivedAt, setArchivedAt] = useState<string | null>(null)
  const [groups, setGroups] = useState<GroupTreeRow[]>([])

  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [yachtNameById, setYachtNameById] = useState<Map<string, string>>(new Map())
  const [addTaskId, setAddTaskId] = useState("")
  const [taskFilter, setTaskFilter] = useState("")
  const [taskMutatingId, setTaskMutatingId] = useState<string | null>(null)

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

  const groupOptions = useMemo(() => buildGroupParentSelectOptions(groups), [groups])

  useEffect(() => {
    if (!session) return
    if (!categoryId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setNotice(null)
      setTasksError(null)
      setSupportsArchive(true)

      try {
        const scopeIds = role === "manager" ? await loadManagerScopeGroupIds(session.user.id) : null
        const groupQuery =
          scopeIds && scopeIds.length > 0
            ? supabase.from("groups").select("id,name,parent_group_id").in("id", scopeIds).order("name")
            : supabase.from("groups").select("id,name,parent_group_id").order("name")

        const { data: groupData, error: gErr } = await groupQuery
        if (!cancelled) {
          if (gErr) {
            // Non-fatal; page still works without group selector.
            setGroups([])
          } else {
            setGroups((groupData as GroupTreeRow[]) ?? [])
          }
        }
      } catch {
        setGroups([])
      }

      const loadCategoryWithGroup = async () => {
        const [{ data: all, error: allErr }, { data, error }] = await Promise.all([
          supabase.from("categories").select("id,name,parent_category_id").order("name"),
          supabase.from("categories").select("id,name,parent_category_id,group_id,archived_at").eq("id", categoryId).maybeSingle(),
        ])
        return { all, allErr, data, error }
      }

      let all: any = null
      let data: any = null
      let allErr: any = null
      let error: any = null

      try {
        ;({ all, allErr, data, error } = await loadCategoryWithGroup())
      } catch (e: any) {
        allErr = e
        error = e
      }

      if (cancelled) return
      if (allErr || error) {
        const msg = String(allErr?.message || error?.message || "")
        const missingParentCol = msg.includes("parent_category_id") && msg.toLowerCase().includes("does not exist")
        const missingGroupCol = msg.includes("group_id") && msg.toLowerCase().includes("does not exist")
        const missingArchivedCol = msg.includes("archived_at") && msg.toLowerCase().includes("does not exist")
        if (missingArchivedCol) setSupportsArchive(false)
        if (!missingParentCol) {
          // If group_id is missing but hierarchy exists, retry without group_id.
          if (missingGroupCol) {
            setSupportsGroup(false)
            const [{ data: all2, error: allErr2 }, { data: row2, error: rowErr2 }] = await Promise.all([
              supabase.from("categories").select("id,name,parent_category_id").order("name"),
              supabase.from("categories").select("id,name,parent_category_id,archived_at").eq("id", categoryId).maybeSingle(),
            ])
            if (cancelled) return
            if (allErr2 || rowErr2) {
              setError(allErr2?.message || rowErr2?.message || "Failed to load category.")
              setLoading(false)
              return
            }
            setCategories((all2 as CategoryRow[]) ?? [])
            const row = row2 as CategoryRow | null
            if (!row?.id) {
              setError("Category not found (or not visible).")
              setLoading(false)
              return
            }
            setName(row.name ?? "")
            setParentId(row.parent_category_id ?? "")
            setCategoryGroupId(null)
            setArchivedAt((row as any)?.archived_at ?? null)
            setLoading(false)
            return
          }
          setError(allErr?.message || error?.message || "Failed to load category.")
          setLoading(false)
          return
        }

        const [{ data: allFlat, error: allFlatErr }, { data: rowFlat, error: rowFlatErr }] = await Promise.all([
          supabase.from("categories").select("id,name").order("name"),
          supabase.from("categories").select("id,name,archived_at").eq("id", categoryId).maybeSingle(),
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

        const row = rowFlat as { id?: string; name?: string; archived_at?: string | null } | null
        if (!row?.id) {
          setError("Category not found (or not visible).")
          setLoading(false)
          return
        }
        setName(row.name ?? "")
        setParentId("")
        setCategoryGroupId(null)
        setArchivedAt((row as any)?.archived_at ?? null)
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
      setCategoryGroupId((row as any)?.group_id ?? null)
      setArchivedAt((row as any)?.archived_at ?? null)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session, categoryId, role])

  useEffect(() => {
    if (!session) return
    if (!categoryId) return
    let cancelled = false

    const loadTasks = async () => {
      setTasksLoading(true)
      setTasksError(null)
      try {
        let yachts: YachtRow[] = []

        if (categoryGroupId) {
          const { data, error } = await supabase.from("yachts").select("id,name").eq("group_id", categoryGroupId).order("name").limit(2000)
          if (error) throw error
          yachts = (data as YachtRow[]) ?? []
        } else {
          const { data, error } = await supabase.from("yachts").select("id,name").order("name").limit(2000)
          if (error) throw error
          yachts = (data as YachtRow[]) ?? []
        }

        if (cancelled) return

        const yachtMap = new Map<string, string>()
        yachts.forEach((y) => yachtMap.set(y.id, y.name))
        setYachtNameById(yachtMap)

        const yachtIds = yachts.map((y) => y.id).filter(Boolean)
        if (yachtIds.length === 0) {
          setTasks([])
          setTasksLoading(false)
          return
        }

        const { data: taskRows, error: tErr } = await supabase
          .from("tasks")
          .select("id,title,status,yacht_id,category_id,due_date")
          .in("yacht_id", yachtIds)
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(2000)

        if (tErr) throw tErr
        if (cancelled) return

        setTasks((taskRows as TaskRow[]) ?? [])
        setTasksLoading(false)
      } catch (e: any) {
        if (!cancelled) {
          setTasksError(e?.message || "Failed to load tasks.")
          setTasks([])
          setTasksLoading(false)
        }
      }
    }

    loadTasks()
    return () => {
      cancelled = true
    }
  }, [session, categoryId, categoryGroupId])

  const assignedTasks = useMemo(() => {
    if (!categoryId) return []
    return tasks
      .filter((t) => t.category_id === categoryId)
      .slice()
      .sort((a, b) => {
        const ya = yachtNameById.get(a.yacht_id) ?? ""
        const yb = yachtNameById.get(b.yacht_id) ?? ""
        return ya.localeCompare(yb) || a.title.localeCompare(b.title)
      })
  }, [tasks, categoryId, yachtNameById])

  const availableTasks = useMemo(() => {
    if (!categoryId) return []
    const q = taskFilter.trim().toLowerCase()
    const out = tasks
      .filter((t) => t.category_id !== categoryId)
      .slice()
      .sort((a, b) => {
        const ya = yachtNameById.get(a.yacht_id) ?? ""
        const yb = yachtNameById.get(b.yacht_id) ?? ""
        return ya.localeCompare(yb) || a.title.localeCompare(b.title)
      })

    if (!q) return out
    return out.filter((t) => {
      const y = yachtNameById.get(t.yacht_id) ?? ""
      return `${t.title} ${y}`.toLowerCase().includes(q)
    })
  }, [tasks, categoryId, yachtNameById, taskFilter])

  const assignTask = async () => {
    if (!categoryId) return
    const taskId = addTaskId
    if (!taskId) return

    const t = tasks.find((x) => x.id === taskId) ?? null
    if (t?.category_id && t.category_id !== categoryId) {
      const ok = window.confirm("This task is already assigned to a category.\n\nMove it to this category?")
      if (!ok) return
    }

    setTaskMutatingId(taskId)
    setTasksError(null)
    try {
      const { error } = await supabase.from("tasks").update({ category_id: categoryId }).eq("id", taskId)
      if (error) throw error
      setAddTaskId("")
      // reload tasks by updating local state
      setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, category_id: categoryId } : x)))
    } catch (e: any) {
      setTasksError(e?.message || "Failed to assign task.")
    } finally {
      setTaskMutatingId(null)
    }
  }

  const unassignTask = async (taskId: string) => {
    if (!categoryId) return
    setTaskMutatingId(taskId)
    setTasksError(null)
    try {
      const { error } = await supabase.from("tasks").update({ category_id: null }).eq("id", taskId)
      if (error) throw error
      setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, category_id: null } : x)))
    } catch (e: any) {
      setTasksError(e?.message || "Failed to unassign task.")
    } finally {
      setTaskMutatingId(null)
    }
  }

  const save = async () => {
    if (!categoryId) return
    setError(null)
    setNotice(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Name is required.")
      return
    }
    if (supportsGroup && !categoryGroupId) {
      setError("Group is required.")
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

    const basePayload = supportsParent ? { name: trimmed, parent_category_id: nextParent } : { name: trimmed }
    const updatePayload = supportsGroup ? { ...basePayload, group_id: categoryGroupId } : basePayload
    const { error } = await supabase.from("categories").update(updatePayload).eq("id", categoryId)
    setSaving(false)
    if (error) {
      const msg = String(error.message || "")
      const isRls = msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("violates row level security")
      if (isRls) {
        setNotice(
          "Supabase RLS is blocking category updates. Apply `docs/v2/migration_categories_rls_admin_manager.sql` in Supabase (SQL Editor) to allow admin/manager updates."
        )
      }
      setError(error.message)
      return
    }
    navigate("/editor/categories", { replace: true })
  }

  const toggleArchive = async () => {
    if (!categoryId) return
    if (!supportsArchive) {
      setNotice("Archiving is not enabled in the database yet (missing `categories.archived_at`).")
      return
    }

    setError(null)
    setNotice(null)

    const nextIsArchived = !archivedAt
    const ok = window.confirm(
      nextIsArchived
        ? "Archive this category?\n\nIt will be hidden from lists."
        : "Unarchive this category?\n\nIt will reappear in lists."
    )
    if (!ok) return

    setArchiving(true)
    const nextArchivedAt = nextIsArchived ? new Date().toISOString() : null

    const { error: upErr } = await supabase
      .from("categories")
      .update({ archived_at: nextArchivedAt })
      .eq("id", categoryId)

    setArchiving(false)

    if (upErr) {
      const msg = String(upErr.message || "")
      const missingArchivedCol = msg.includes("archived_at") && msg.toLowerCase().includes("does not exist")
      if (missingArchivedCol) {
        setSupportsArchive(false)
        setNotice("Archiving is not enabled in the database yet (missing `categories.archived_at`).")
      }
      setError(upErr.message)
      return
    }

    setArchivedAt(nextArchivedAt)
    setNotice(nextIsArchived ? "Category archived." : "Category unarchived.")
  }

  if (!categoryId) return null
  if (loading || roleLoading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Edit category</div>
      <div className="screen-subtitle">Admin or manager.</div>

      {error ? <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div> : null}
      {notice && !error ? (
        <div style={{ color: "var(--text-secondary)", marginBottom: 10, fontSize: 13 }}>{notice}</div>
      ) : null}

      <div className="card">
        {supportsGroup ? (
          <>
            <label>Group:</label>
            <select
              value={categoryGroupId ?? ""}
              onChange={(e) => setCategoryGroupId(e.target.value || null)}
              style={{ marginBottom: 12 }}
              disabled={saving || archiving}
            >
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
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || archiving} />

        {supportsParent ? (
          <>
            <label>Parent category (optional):</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              style={{ marginBottom: 12 }}
              disabled={saving || archiving}
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

        <button type="button" className="cta-button" onClick={save} disabled={saving || archiving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>Tasks</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{assignedTasks.length}</div>
        </div>

        {tasksError ? (
          <div style={{ color: "var(--accent-red)", padding: 12, fontSize: 13 }}>{tasksError}</div>
        ) : null}

        <div style={{ padding: 12, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Add task to this category</div>
          <input
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value)}
            placeholder="Filter tasks…"
            style={{ width: "100%", marginBottom: 10 }}
            disabled={tasksLoading || !!taskMutatingId}
          />
          <select
            value={addTaskId}
            onChange={(e) => setAddTaskId(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
            disabled={tasksLoading || !!taskMutatingId}
          >
            <option value="">{tasksLoading ? "Loading…" : "Select task…"}</option>
            {availableTasks.slice(0, 300).map((t) => {
              const yachtName = yachtNameById.get(t.yacht_id) ?? t.yacht_id
              return (
                <option key={t.id} value={t.id}>
                  {t.title} · {yachtName}
                </option>
              )
            })}
          </select>
          <button type="button" className="cta-button" onClick={assignTask} disabled={!addTaskId || tasksLoading || !!taskMutatingId}>
            {taskMutatingId === addTaskId ? "Adding…" : "Add to category"}
          </button>
        </div>

        {tasksLoading ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>Loading tasks…</div>
        ) : assignedTasks.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No tasks in this category.</div>
        ) : (
          assignedTasks.map((t) => {
            const yachtName = yachtNameById.get(t.yacht_id) ?? t.yacht_id
            return (
              <div key={t.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="list-row" style={{ justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 700 }}>{t.title}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {yachtName}
                      {" · "}
                      {t.status}
                      {" · "}
                      {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : "No due date"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="secondary" onClick={() => navigate(`/editor/tasks/${t.id}`)} disabled={!!taskMutatingId}>
                      Open
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => unassignTask(t.id)}
                      disabled={!!taskMutatingId}
                      style={{ color: "var(--accent-red)" }}
                    >
                      {taskMutatingId === t.id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Archive</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
          Archived categories are hidden from lists.
        </div>

        {!supportsArchive ? (
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Archiving is not available (missing `categories.archived_at`).
          </div>
        ) : (
          <>
            {archivedAt ? (
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
                Archived {new Date(archivedAt).toLocaleDateString()}
              </div>
            ) : null}

            <button
              type="button"
              className="secondary"
              onClick={toggleArchive}
              disabled={saving || archiving}
              style={{
                width: "100%",
                opacity: saving || archiving ? 0.6 : 1,
                color: archivedAt ? "var(--accent-blue)" : "var(--accent-orange)",
                background: archivedAt ? "rgba(10, 132, 255, 0.10)" : "rgba(255, 159, 10, 0.12)",
              }}
            >
              {archiving ? (archivedAt ? "Unarchiving…" : "Archiving…") : archivedAt ? "Unarchive category" : "Archive category"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

