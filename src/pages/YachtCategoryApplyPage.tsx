import React, { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useCategoryTree } from "../hooks/useCategoryTree"
import { supabase } from "../lib/supabase"

type TaskCategoryMapRow = { task_id: string; category_id: string }

type TaskContextRow = {
  task_id: string | null
  category_id: string | null
}

export default function YachtCategoryApplyPage() {
  const navigate = useNavigate()
  const { yachtId } = useParams<{ yachtId: string }>()
  const { nodes, loading, error, ARCHIVE_ID } = useCategoryTree()

  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const categoryNodes = useMemo(() => {
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

  const applyCategoryToYacht = async (categoryId: string) => {
    if (!yachtId) return
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

    // 1) Find all task↔category mappings in this subtree.
    const { data: links, error: linkErr } = await supabase
      .from("task_category_map")
      .select("task_id, category_id")
      .in("category_id", subtreeCategoryIds)

    if (linkErr) {
      setSavingCategoryId(null)
      setPageError(linkErr.message)
      return
    }

    const mappings = (links as TaskCategoryMapRow[] | null) ?? []
    if (!mappings.length) {
      setSavingCategoryId(null)
      setInfo("No tasks are linked to this category (or its descendants).")
      return
    }

    // 2) Load existing contexts for this yacht within these categories, so we don't duplicate.
    const { data: existing, error: existingErr } = await supabase
      .from("task_contexts")
      .select("task_id, category_id")
      .eq("yacht_id", yachtId)
      .in("category_id", subtreeCategoryIds)

    if (existingErr) {
      setSavingCategoryId(null)
      setPageError(existingErr.message)
      return
    }

    const existingPairs = new Set(
      (((existing as TaskContextRow[] | null) ?? [])
        .map((r) => (r.task_id && r.category_id ? `${r.task_id}::${r.category_id}` : null))
        .filter(Boolean) as string[])
    )

    const toInsert = mappings
      .map((m) => `${m.task_id}::${m.category_id}`)
      .filter((k) => !existingPairs.has(k))

    if (!toInsert.length) {
      setSavingCategoryId(null)
      setInfo("All tasks in this category subtree are already assigned to this yacht.")
      return
    }

    // De-dupe and insert rows.
    const uniquePairs = Array.from(new Set(toInsert))
    const rows = uniquePairs.map((k) => {
      const [task_id, category_id] = k.split("::")
      return { yacht_id: yachtId, task_id, category_id }
    })

    const { error: insErr } = await supabase.from("task_contexts").insert(rows)

    setSavingCategoryId(null)

    if (insErr) {
      setPageError(insErr.message)
      return
    }

    setInfo(`Applied category to yacht: added ${rows.length} task context row(s).`)
  }

  if (!yachtId) return null

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <button type="button" className="primary-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Apply Category to Yacht</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
        This is a bulk convenience action. It creates missing `task_contexts` rows for all task↔category links
        in the selected category subtree.
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
                  applyCategoryToYacht(node.id)
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: 12,
                  fontSize: 13,
                  opacity: isVirtual || savingCategoryId === node.id ? 0.6 : 1,
                }}
                title={isVirtual ? "Virtual node" : "Apply this category subtree to the yacht"}
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

