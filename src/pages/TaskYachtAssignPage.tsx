import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useYachtGroupTree } from "../hooks/useYachtGroupTree"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"

type TaskCategoryMapRow = { category_id: string }

type TaskContextRow = {
  yacht_id: string | null
  category_id: string | null
}

export default function TaskYachtAssignPage() {
  const navigate = useNavigate()
  const { taskId } = useParams<{ taskId: string }>()
  const { session } = useSession()
  const { nodes, loading, error } = useYachtGroupTree()

  const [checkedYachtIds, setCheckedYachtIds] = useState<string[]>([])
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [savingYachtId, setSavingYachtId] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [autoCategoryId, setAutoCategoryId] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    if (!taskId) return

    const load = async () => {
      setPageError(null)

      const { data: catLinks, error: catErr } = await supabase
        .from("task_category_map")
        .select("category_id")
        .eq("task_id", taskId)

      if (catErr) {
        setPageError(catErr.message)
        return
      }

      const cats = (catLinks as TaskCategoryMapRow[] | null) ?? []
      setCategoryIds(cats.map((c) => c.category_id))

      const { data: contexts, error: ctxErr } = await supabase
        .from("task_contexts")
        .select("yacht_id")
        .eq("task_id", taskId)
        .not("yacht_id", "is", null)

      if (ctxErr) {
        setPageError(ctxErr.message)
        return
      }

      const yachtIds = Array.from(
        new Set(
          ((contexts as TaskContextRow[] | null) ?? [])
            .map((c) => c.yacht_id)
            .filter(Boolean) as string[]
        )
      )

      setCheckedYachtIds(yachtIds)
    }

    load()
  }, [taskId, session])

  const ensureAutoCategory = async (): Promise<string[]> => {
    if (!taskId) return []

    if (categoryIds.length > 0) return categoryIds
    if (autoCategoryId) return [autoCategoryId]

    // Schema CSV: task_categories.group_id is NOT NULL. Find an existing group_id.
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
      if (!groupId) {
        throw new Error("No groups exist. Create a group before assigning yachts.")
      }
    }

    // Try to reuse an existing “Uncategorised” category in this group.
    const { data: existingCat, error: findErr } = await supabase
      .from("task_categories")
      .select("id")
      .eq("group_id", groupId)
      .eq("name", "Uncategorised")
      .eq("is_archived", false)
      .limit(1)

    if (findErr) throw new Error(findErr.message)

    let uncategorisedId = (existingCat as any[])?.[0]?.id as string | undefined

    if (!uncategorisedId) {
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
      uncategorisedId = (inserted as any)?.id as string | undefined
    }

    if (!uncategorisedId) {
      throw new Error("Failed to create or locate Uncategorised category.")
    }

    // Map the task to this category so it appears in the normal category tree.
    const { error: mapErr } = await supabase.from("task_category_map").upsert({
      task_id: taskId,
      category_id: uncategorisedId,
    })

    if (mapErr) throw new Error(mapErr.message)

    setAutoCategoryId(uncategorisedId)
    setCategoryIds([uncategorisedId])

    return [uncategorisedId]
  }

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

  const getDescendantYachtIds = (id: string): string[] => {
    const kids = childrenMap[id] || []
    const result: string[] = []
    for (const k of kids) {
      const node = nodeById.get(k)
      if (node?.nodeType === "yacht") result.push(k)
      result.push(...getDescendantYachtIds(k))
    }
    return result
  }

  const toggleYacht = async (yachtId: string) => {
    if (!taskId) return
    setPageError(null)
    let effectiveCategoryIds = categoryIds
    try {
      if (effectiveCategoryIds.length === 0) {
        effectiveCategoryIds = await ensureAutoCategory()
      }
    } catch (e: any) {
      setPageError(e?.message || "Failed to auto-assign category.")
      return
    }

    const shouldCheck = !checkedYachtIds.includes(yachtId)
    setSavingYachtId(yachtId)

    // Optimistic UI
    setCheckedYachtIds((prev) =>
      shouldCheck ? [...prev, yachtId] : prev.filter((x) => x !== yachtId)
    )

    if (!shouldCheck) {
      const { error: delErr } = await supabase
        .from("task_contexts")
        .delete()
        .eq("task_id", taskId)
        .eq("yacht_id", yachtId)

      setSavingYachtId(null)

      if (delErr) {
        setPageError(delErr.message)
        // Revert
        setCheckedYachtIds((prev) => [...new Set([...prev, yachtId])])
      }

      return
    }

    // Create task_contexts rows for this (task, yacht, category*) combination.
    // Schema CSV shows task_contexts.category_id is nullable, but ULTRA lifecycle is
    // Template → Category → Yacht → Execution, so we require categories first.
    const { data: existing, error: existingErr } = await supabase
      .from("task_contexts")
      .select("category_id")
      .eq("task_id", taskId)
      .eq("yacht_id", yachtId)
      .in("category_id", effectiveCategoryIds)

    if (existingErr) {
      setSavingYachtId(null)
      setPageError(existingErr.message)
      // Revert
      setCheckedYachtIds((prev) => prev.filter((x) => x !== yachtId))
      return
    }

    const existingCategoryIds = new Set(
      (((existing as TaskContextRow[] | null) ?? []).map((r) => r.category_id).filter(Boolean) as string[])
    )
    const missingCategoryIds = effectiveCategoryIds.filter((c) => !existingCategoryIds.has(c))

    if (missingCategoryIds.length > 0) {
      const { error: insertErr } = await supabase.from("task_contexts").insert(
        missingCategoryIds.map((categoryId) => ({
          task_id: taskId,
          yacht_id: yachtId,
          category_id: categoryId,
        }))
      )

      setSavingYachtId(null)

      if (insertErr) {
        setPageError(insertErr.message)
        // Revert
        setCheckedYachtIds((prev) => prev.filter((x) => x !== yachtId))
        return
      }
    }

    setSavingYachtId(null)
  }

  if (!taskId) return null

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

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Assigned Yachts</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
        Note: This is a legacy yacht-scoped assignment screen. Canonical ULTRA uses group-scoped
        assignments (`task_assignments`) with downward inheritance.
      </div>

      {(pageError || error) && (
        <div style={{ color: "var(--accent-red)", marginBottom: 12, fontSize: 13 }}>
          {pageError || error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <TreeDisplay
          nodes={nodes as TreeNode[]}
          renderActions={(node) => {
            if (node.nodeType === "yacht") {
              const isChecked = checkedYachtIds.includes(node.id)
              const disabled = savingYachtId === node.id
              return (
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={disabled}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation()
                    toggleYacht(node.id)
                  }}
                />
              )
            }

            // Group nodes show a read-only tri-state indicator based on descendant yachts
            const descendantYachts = getDescendantYachtIds(node.id)
            if (descendantYachts.length === 0) return null

            const all = descendantYachts.every((id) => checkedYachtIds.includes(id))
            const some = descendantYachts.some((id) => checkedYachtIds.includes(id))

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
    </div>
  )
}

