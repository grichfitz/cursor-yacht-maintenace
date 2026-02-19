import React, { useMemo, useState } from "react"
import TreeDisplay, { type TreeNode } from "../../components/TreeDisplay"
import type { GlobalCategoryRow, TaskTemplateRow } from "../blueprint/types"

export type BlueprintSelection =
  | { kind: "template"; templateId: string }
  | { kind: "subtree"; categoryId: string }
  | { kind: "none" }

export function BlueprintBrowser({
  categories,
  templates,
  selection,
  onChangeSelection,
  allowSubtree,
}: {
  categories: GlobalCategoryRow[]
  templates: TaskTemplateRow[]
  selection: BlueprintSelection
  onChangeSelection: (s: BlueprintSelection) => void
  allowSubtree: boolean
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined)

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const categoryNodes = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id))
    const out: TreeNode[] = categories
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({
        id: c.id,
        parentId: c.parent_category_id && ids.has(c.parent_category_id) ? c.parent_category_id : null,
        label: c.name,
        nodeType: "category",
        meta: c,
      }))
    return out
  }, [categories])

  const templatesInSelected = useMemo(() => {
    if (!selectedCategoryId) return []
    return templates
      .filter((t) => t.global_category_id === selectedCategoryId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [templates, selectedCategoryId])

  const selectedCategoryName = selectedCategoryId ? categoryById.get(selectedCategoryId)?.name ?? "" : ""

  return (
    <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <div>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Blueprint</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>Browse the global blueprint tree (read-only).</div>
        <TreeDisplay
          nodes={categoryNodes}
          selectedId={selectedCategoryId}
          onSelect={(n) => setSelectedCategoryId(n.id)}
          renderLabel={(node) => {
            const c = node.meta as GlobalCategoryRow
            return (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontWeight: node.id === selectedCategoryId ? 900 : 700 }}>{node.label}</span>
                {c.archived_at ? <span style={{ fontSize: 12, opacity: 0.65 }}>(archived)</span> : null}
              </div>
            )
          }}
        />
      </div>

      <div>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Templates</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
          {selectedCategoryId ? (
            <>
              {selectedCategoryName || selectedCategoryId}
              {" · "}
              {templatesInSelected.length} in category
            </>
          ) : (
            "Select a category to pick templates."
          )}
        </div>

        {selectedCategoryId ? (
          <>
            <div className="card" style={{ padding: 10, marginBottom: 10 }}>
              <button
                type="button"
                className="secondary"
                style={{ width: "100%" }}
                onClick={() => onChangeSelection({ kind: "subtree", categoryId: selectedCategoryId })}
                disabled={!allowSubtree}
              >
                Select entire subtree
              </button>
              {!allowSubtree ? (
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                  Subtree assignment is not available for yacht scope.
                </div>
              ) : null}
            </div>

            <div className="card card-list">
              <div className="list-row" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800 }}>Templates</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{templatesInSelected.length}</div>
              </div>

              {templatesInSelected.length === 0 ? (
                <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No templates in this category.</div>
              ) : (
                templatesInSelected.map((t) => {
                  const isSelected = selection.kind === "template" && selection.templateId === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="list-button"
                      onClick={() => onChangeSelection({ kind: "template", templateId: t.id })}
                      style={{
                        opacity: t.archived_at ? 0.65 : 1,
                        background: isSelected ? "rgba(10, 132, 255, 0.10)" : undefined,
                      }}
                    >
                      <div className="list-button-main">
                        <div className="list-button-title" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span>{t.name}</span>
                          {t.archived_at ? (
                            <span style={{ fontSize: 12, opacity: 0.75, border: "1px solid var(--border-subtle)", borderRadius: 999, padding: "2px 8px" }}>
                              Archived
                            </span>
                          ) : null}
                        </div>
                        <div className="list-button-subtitle">{t.period ? `Period: ${t.period}` : "No period"}</div>
                      </div>
                      <div className="list-button-chevron">{isSelected ? "✓" : "›"}</div>
                    </button>
                  )
                })
              )}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.75 }}>No category selected.</div>
        )}
      </div>
    </div>
  )
}

