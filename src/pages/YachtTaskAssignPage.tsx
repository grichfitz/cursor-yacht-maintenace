import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useTaskTree } from "../hooks/useTaskTree"
import { supabase } from "../lib/supabase"
import { Pencil } from "lucide-react"
import { useSession } from "../auth/SessionProvider"

type TaskContextRow = {
  id: string
  task_id: string | null
  category_id: string | null
}

type TaskResultRow = { id: string }

type TaskCategoryMapRow = { category_id: string }

export default function YachtTaskAssignPage() {
  const navigate = useNavigate()
  const { yachtId } = useParams<{ yachtId: string }>()
  const { session } = useSession()

  const { nodes, loading, error } = useTaskTree()

  const [checkedTaskIds, setCheckedTaskIds] = useState<string[]>([])
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [overrideNameByTaskId, setOverrideNameByTaskId] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!session) return
    if (!yachtId) return

    const load = async () => {
      setPageError(null)

      const { data: contexts, error: ctxErr } = await supabase
        .from("task_contexts")
        .select("task_id")
        .eq("yacht_id", yachtId)
        .not("task_id", "is", null)

      if (ctxErr) {
        setPageError(ctxErr.message)
        return
      }

      const taskIds = Array.from(
        new Set(
          ((contexts as { task_id: string }[] | null) ?? []).map((c) => c.task_id)
        )
      )

      setCheckedTaskIds(taskIds)
    }

    load()
  }, [yachtId, session])

  useEffect(() => {
    if (!session) return
    if (!yachtId) return

    const loadOverrides = async () => {
      // Load yacht+task scope contexts (category_id is null)
      const { data: scopeContexts, error: scopeErr } = await supabase
        .from("task_contexts")
        .select("id, task_id")
        .eq("yacht_id", yachtId)
        .is("category_id", null)
        .not("task_id", "is", null)

      if (scopeErr) return

      const ctxs = (scopeContexts as { id: string; task_id: string }[] | null) ?? []
      const ctxIds = ctxs.map((c) => c.id)
      if (!ctxIds.length) {
        setOverrideNameByTaskId({})
        return
      }

      const { data: overrides, error: ovrErr } = await supabase
        .from("task_context_overrides")
        .select("task_context_id, name_override")
        .in("task_context_id", ctxIds)

      if (ovrErr) return

      const nameByCtxId = new Map<string, string>()
      ;((overrides as any[]) ?? []).forEach((o) => {
        if (o?.name_override) nameByCtxId.set(o.task_context_id, o.name_override)
      })

      const map: Record<string, string> = {}
      ctxs.forEach((c) => {
        const name = nameByCtxId.get(c.id)
        if (name) map[c.task_id] = name
      })

      setOverrideNameByTaskId(map)
    }

    loadOverrides()
  }, [yachtId, session])

  const childrenMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const n of nodes) {
      if (!n.parentId) continue
      if (!map[n.parentId]) map[n.parentId] = []
      map[n.parentId].push(n.id)
    }
    return map
  }, [nodes])

  const nodeById = useMemo(() => {
    const map = new Map<string, TreeNode>()
    nodes.forEach((n) => map.set(n.id, n))
    return map
  }, [nodes])

  // Show latest task templates, plus any non-latest tasks already assigned to this yacht.
  const visibleNodes = useMemo(() => {
    const checked = new Set(checkedTaskIds)
    return nodes.filter((n) => {
      if (n.nodeType !== "task") return true
      const isLatest = (n.meta as any)?.is_latest !== false
      return isLatest || checked.has(n.id)
    })
  }, [nodes, checkedTaskIds])

  const visibleNodesWithOverrides = useMemo(() => {
    if (!Object.keys(overrideNameByTaskId).length) return visibleNodes
    return visibleNodes.map((n) => {
      if (n.nodeType !== "task") return n
      const override = overrideNameByTaskId[n.id]
      if (!override) return n
      return { ...n, label: override }
    })
  }, [visibleNodes, overrideNameByTaskId])

  const getDescendantTaskIds = (id: string): string[] => {
    const kids = childrenMap[id] || []
    const result: string[] = []
    for (const k of kids) {
      const node = nodeById.get(k)
      if (node?.nodeType === "task") result.push(k)
      result.push(...getDescendantTaskIds(k))
    }
    return result
  }

  const ensureUncategorisedCategoryForTask = async (taskId: string) => {
    // If task has no categories, auto-create/reuse Uncategorised and map it.
    const { data: existingLinks, error: linkErr } = await supabase
      .from("task_category_map")
      .select("category_id")
      .eq("task_id", taskId)

    if (linkErr) throw new Error(linkErr.message)

    const existingCategoryIds =
      ((existingLinks as TaskCategoryMapRow[] | null) ?? []).map((l) => l.category_id)

    if (existingCategoryIds.length > 0) return existingCategoryIds

    // task_categories.group_id is NOT NULL: get a group_id from any existing category, else any group.
    const { data: catRows, error: catErr } = await supabase
      .from("task_categories")
      .select("group_id")
      .limit(1)

    if (catErr) throw new Error(catErr.message)

    let groupId = (catRows as any[])?.[0]?.group_id as string | undefined

    if (!groupId) {
      const { data: groups, error: grpErr } = await supabase
        .from("groups")
        .select("id")
        .order("name")
        .limit(1)

      if (grpErr) throw new Error(grpErr.message)
      groupId = (groups as any[])?.[0]?.id as string | undefined
    }

    if (!groupId) {
      throw new Error("No groups exist. Create a group before assigning tasks.")
    }

    const { data: found, error: findErr } = await supabase
      .from("task_categories")
      .select("id")
      .eq("group_id", groupId)
      .eq("name", "Uncategorised")
      .eq("is_archived", false)
      .limit(1)

    if (findErr) throw new Error(findErr.message)

    let categoryId = (found as any[])?.[0]?.id as string | undefined

    if (!categoryId) {
      const { data: inserted, error: insertErr } = await supabase
        .from("task_categories")
        .insert({
          name: "Uncategorised",
          parent_id: null,
          is_archived: false,
          group_id: groupId,
        })
        .select("id")
        .single()

      if (insertErr) throw new Error(insertErr.message)
      categoryId = (inserted as any)?.id as string | undefined
    }

    if (!categoryId) throw new Error("Failed to create Uncategorised category.")

    const { error: upsertErr } = await supabase.from("task_category_map").upsert({
      task_id: taskId,
      category_id: categoryId,
    })

    if (upsertErr) throw new Error(upsertErr.message)

    return [categoryId]
  }

  const toggleTask = async (taskId: string) => {
    if (!yachtId) return
    setPageError(null)

    const shouldCheck = !checkedTaskIds.includes(taskId)
    setSavingTaskId(taskId)

    // Optimistic UI
    setCheckedTaskIds((prev) =>
      shouldCheck ? [...prev, taskId] : prev.filter((x) => x !== taskId)
    )

    if (!shouldCheck) {
      // Unassign: block if any task_results exist for any contexts we would delete.
      const { data: contexts, error: ctxErr } = await supabase
        .from("task_contexts")
        .select("id, task_id, category_id")
        .eq("yacht_id", yachtId)
        .eq("task_id", taskId)

      if (ctxErr) {
        setPageError(ctxErr.message)
        setSavingTaskId(null)
        setCheckedTaskIds((prev) => [...new Set([...prev, taskId])])
        return
      }

      const contextIds = ((contexts as TaskContextRow[] | null) ?? []).map((c) => c.id)

      if (contextIds.length > 0) {
        const { data: results, error: resErr } = await supabase
          .from("task_results")
          .select("id")
          .in("task_context_id", contextIds)
          .limit(1)

        if (resErr) {
          setPageError(resErr.message)
          setSavingTaskId(null)
          setCheckedTaskIds((prev) => [...new Set([...prev, taskId])])
          return
        }

        if (((results as TaskResultRow[] | null) ?? []).length > 0) {
          setPageError(
            "This task cannot be unassigned because there is execution history (task_results) for this yacht."
          )
          setSavingTaskId(null)
          setCheckedTaskIds((prev) => [...new Set([...prev, taskId])])
          return
        }
      }

      const { error: delErr } = await supabase
        .from("task_contexts")
        .delete()
        .eq("yacht_id", yachtId)
        .eq("task_id", taskId)

      setSavingTaskId(null)

      if (delErr) {
        setPageError(delErr.message)
        setCheckedTaskIds((prev) => [...new Set([...prev, taskId])])
      }

      return
    }

    // Assign: create missing contexts for (task, yacht, category*) combinations.
    let categoryIds: string[] = []
    try {
      categoryIds = await ensureUncategorisedCategoryForTask(taskId)
    } catch (e: any) {
      setPageError(e?.message || "Failed to ensure category for task.")
      setSavingTaskId(null)
      setCheckedTaskIds((prev) => prev.filter((x) => x !== taskId))
      return
    }

    const { data: existing, error: existingErr } = await supabase
      .from("task_contexts")
      .select("category_id")
      .eq("yacht_id", yachtId)
      .eq("task_id", taskId)
      .in("category_id", categoryIds)

    if (existingErr) {
      setPageError(existingErr.message)
      setSavingTaskId(null)
      setCheckedTaskIds((prev) => prev.filter((x) => x !== taskId))
      return
    }

    const existingCategoryIds = new Set(
      (((existing as TaskContextRow[] | null) ?? [])
        .map((r) => r.category_id)
        .filter(Boolean) as string[])
    )

    const missingCategoryIds = categoryIds.filter((c) => !existingCategoryIds.has(c))

    if (missingCategoryIds.length > 0) {
      const { error: insertErr } = await supabase.from("task_contexts").insert(
        missingCategoryIds.map((categoryId) => ({
          task_id: taskId,
          yacht_id: yachtId,
          category_id: categoryId,
        }))
      )

      setSavingTaskId(null)

      if (insertErr) {
        setPageError(insertErr.message)
        setCheckedTaskIds((prev) => prev.filter((x) => x !== taskId))
        return
      }
    }

    setSavingTaskId(null)
  }

  if (!yachtId) return null

  return (
    <div
      className="screen"
      style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <button
          type="button"
          className="primary-button"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Assigned Tasks</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
        Note: This is a legacy yacht-scoped assignment screen. Canonical ULTRA uses group-scoped
        assignments (`task_assignments`) with downward inheritance.
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => navigate(`/apps/yachts/${yachtId}/categories/apply`)}
          style={{
            background: "var(--border-subtle)",
            border: "none",
            borderRadius: 12,
            padding: "4px 10px",
            cursor: "pointer",
            color: "var(--text-primary)",
            fontSize: 13,
            fontWeight: 500,
          }}
          title="Bulk apply a category subtree (creates task_contexts rows)"
        >
          Apply Category…
        </button>
      </div>

      {(pageError || error) && (
        <div style={{ color: "var(--accent-red)", marginBottom: 12, fontSize: 13 }}>
          {pageError || error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <TreeDisplay
          nodes={visibleNodesWithOverrides as TreeNode[]}
          renderActions={(node) => {
            const isVirtual = node.id.startsWith("__")

            if (node.nodeType === "task") {
              const isChecked = checkedTaskIds.includes(node.id)
              const disabled = savingTaskId === node.id
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleTask(node.id)
                    }}
                  />
                  <div
                    className="tree-action-icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/apps/yachts/${yachtId}/tasks/${node.id}/edit`)
                    }}
                    title="Edit for this yacht"
                    style={{ opacity: disabled ? 0.5 : 1 }}
                  >
                    <Pencil size={14} />
                  </div>
                </div>
              )
            }

            if (isVirtual) return null

            // Category nodes show a read-only tri-state indicator based on descendant tasks
            const descendantTasks = getDescendantTaskIds(node.id)
            if (descendantTasks.length === 0) return null

            const all = descendantTasks.every((id) => checkedTaskIds.includes(id))
            const some = descendantTasks.some((id) => checkedTaskIds.includes(id))

            return (
              <input
                type="checkbox"
                checked={all}
                readOnly
                disabled
                ref={(el) => {
                  if (el) el.indeterminate = !all && some
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )
          }}
        />
      </div>

      {loading && <div style={{ padding: 12 }}>Loading…</div>}
    </div>
  )
}

