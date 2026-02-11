import React, { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useCategoryTree } from "../hooks/useCategoryTree"
import { supabase } from "../lib/supabase"

type TaskCategoryMapRow = { task_id: string; category_id: string }

type EffectiveAssignmentRow = {
  task_id: string
}

type LocalAssignmentRow = {
  task_id: string
}

export default function GroupCategoryApplyPage() {
  const navigate = useNavigate()
  const { groupId } = useParams<{ groupId: string }>()
  const { nodes, loading, error, ARCHIVE_ID } = useCategoryTree()

  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const categoryNodes = useMemo(() => {
    // Only categories here.
    return nodes.filter((n) => n.nodeType === "category")
  }, [nodes])

  const childrenMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const n of categoryNodes) {
      if (!n.parentId) continue
      if (!map[n.parentId]) map[n.parentId] = []
      map[n.parentId].push(n.id)
    }
    return map
  }, [categoryNodes])

  const getDescendantCategoryIds = (id: string): string[] => {
    const kids = childrenMap[id] || []
    return kids.flatMap((k) => [k, ...getDescendantCategoryIds(k)])
  }

  const applyCategory = async (categoryId: string) => {
    if (!groupId) return
    if (savingCategoryId === categoryId) return
    setPageError(null)
    setInfo(null)
    setSavingCategoryId(categoryId)

    const isVirtual = categoryId.startsWith("__")
    if (isVirtual) {
      setSavingCategoryId(null)
      return
    }

    const subtreeCategoryIds = [categoryId, ...getDescendantCategoryIds(categoryId)].filter(
      (id) => id !== ARCHIVE_ID && !id.startsWith("__")
    )

    if (!subtreeCategoryIds.length) {
      setSavingCategoryId(null)
      return
    }

    // 1) Find tasks linked to any category in the subtree.
    const { data: links, error: linkErr } = await supabase
      .from("task_category_map")
      .select("task_id, category_id")
      .in("category_id", subtreeCategoryIds)

    if (linkErr) {
      setSavingCategoryId(null)
      setPageError(linkErr.message)
      return
    }

    const taskIds = Array.from(
      new Set(((links as TaskCategoryMapRow[] | null) ?? []).map((l) => l.task_id))
    )

    if (!taskIds.length) {
      setSavingCategoryId(null)
      setInfo("No tasks are linked to this category (or its descendants).")
      return
    }

    // 2) Effective assignments (includes inherited); skip tasks already assigned.
    const { data: effective, error: effErr } = await supabase.rpc(
      "effective_task_assignments",
      { target_group_id: groupId }
    )

    if (effErr) {
      setSavingCategoryId(null)
      setPageError(effErr.message)
      return
    }

    const alreadyAssigned = new Set(
      (((effective as EffectiveAssignmentRow[] | null) ?? []) as any[]).map((r) => r.task_id)
    )

    // 3) Existing local assignments for this group; skip to avoid overwriting overrides.
    const { data: localExisting, error: localErr } = await supabase
      .from("task_assignments")
      .select("task_id")
      .eq("group_id", groupId)
      .in("task_id", taskIds)
      .eq("is_archived", false)

    if (localErr) {
      setSavingCategoryId(null)
      setPageError(localErr.message)
      return
    }

    const existingLocal = new Set(
      ((localExisting as LocalAssignmentRow[] | null) ?? []).map((r) => r.task_id)
    )

    const toInsert = taskIds.filter((t) => !alreadyAssigned.has(t) && !existingLocal.has(t))

    if (!toInsert.length) {
      setSavingCategoryId(null)
      setInfo("Everything in this category subtree is already assigned (directly or via inheritance).")
      return
    }

    const { error: insErr } = await supabase.from("task_assignments").insert(
      toInsert.map((taskId) => ({
        group_id: groupId,
        task_id: taskId,
        inherits_from_assignment_id: null,
        override_data: {},
        is_archived: false,
        updated_at: new Date().toISOString(),
      }))
    )

    setSavingCategoryId(null)

    if (insErr) {
      setPageError(insErr.message)
      return
    }

    setInfo(`Applied category to group: added ${toInsert.length} task assignment(s).`)
  }

  if (!groupId) return null

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <button type="button" className="primary-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Apply Category to Group</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
        This is a bulk convenience action. It creates missing `task_assignments` rows for all tasks linked to
        the selected category subtree. It does not overwrite existing local overrides.
      </div>

      {(pageError || error) && (
        <div style={{ color: "var(--accent-red)", marginBottom: 12, fontSize: 13 }}>
          {pageError || error}
        </div>
      )}

      {info && (
        <div style={{ color: "var(--text-secondary)", marginBottom: 12, fontSize: 13 }}>{info}</div>
      )}

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <TreeDisplay
          nodes={categoryNodes as TreeNode[]}
          renderActions={(node) => {
            const isVirtual = node.id.startsWith("__")
            return (
              <button
                type="button"
                className="primary-button"
                disabled={isVirtual || savingCategoryId === node.id}
                onClick={(e) => {
                  e.stopPropagation()
                  applyCategory(node.id)
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: 12,
                  fontSize: 13,
                  opacity: isVirtual || savingCategoryId === node.id ? 0.6 : 1,
                }}
                title={isVirtual ? "Virtual node" : "Apply this category subtree to the group"}
              >
                {savingCategoryId === node.id ? "Applying…" : "Apply"}
              </button>
            )
          }}
        />
      </div>

      {loading && <div style={{ padding: 12 }}>Loading…</div>}
    </div>
  )
}

