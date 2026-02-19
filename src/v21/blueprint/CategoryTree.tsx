import React, { useMemo, useState } from "react"
import TreeDisplay, { type TreeNode } from "../../components/TreeDisplay"
import type { GlobalCategoryRow } from "./types"
import { supabase } from "../../lib/supabase"

function badge(label: string) {
  return (
    <span
      style={{
        fontSize: 12,
        opacity: 0.7,
        border: "1px solid var(--border-subtle)",
        borderRadius: 999,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  )
}

export function CategoryTree({
  categories,
  selectedId,
  onSelect,
  onReload,
}: {
  categories: GlobalCategoryRow[]
  selectedId: string | undefined
  onSelect: (id: string) => void
  onReload: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [mutatingId, setMutatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const childrenById = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const c of categories) {
      if (!c.parent_category_id) continue
      const arr = m.get(c.parent_category_id) ?? []
      arr.push(c.id)
      m.set(c.parent_category_id, arr)
    }
    return m
  }, [categories])

  const nodes = useMemo(() => {
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

  const beginRename = (c: GlobalCategoryRow) => {
    setError(null)
    setEditingId(c.id)
    setEditingName(c.name ?? "")
  }

  const commitRename = async () => {
    const id = editingId
    if (!id) return
    const trimmed = editingName.trim()
    if (!trimmed) {
      setError("Category name is required.")
      return
    }

    setMutatingId(id)
    setError(null)
    try {
      const { error: upErr } = await supabase.from("global_categories").update({ name: trimmed }).eq("id", id)
      if (upErr) throw upErr
      setEditingId(null)
      setEditingName("")
      onReload()
    } catch (e: any) {
      setError(e?.message || "Failed to rename category.")
    } finally {
      setMutatingId(null)
    }
  }

  const addChild = async (parentId: string | null) => {
    const name = window.prompt("New child category name:")
    const trimmed = String(name ?? "").trim()
    if (!trimmed) return

    setError(null)
    setMutatingId(parentId ?? "__root__")
    try {
      const { error: insErr } = await supabase.from("global_categories").insert({
        parent_category_id: parentId,
        name: trimmed,
      })
      if (insErr) throw insErr
      onReload()
    } catch (e: any) {
      setError(e?.message || "Failed to create category.")
    } finally {
      setMutatingId(null)
    }
  }

  const toggleArchive = async (c: GlobalCategoryRow) => {
    const nextArchivedAt = c.archived_at ? null : new Date().toISOString()
    const ok = window.confirm(c.archived_at ? "Unarchive this category?" : "Archive this category?\n\nIt will be hidden from non-admin lists.")
    if (!ok) return

    setError(null)
    setMutatingId(c.id)
    try {
      const { error: upErr } = await supabase.from("global_categories").update({ archived_at: nextArchivedAt }).eq("id", c.id)
      if (upErr) throw upErr
      onReload()
    } catch (e: any) {
      setError(e?.message || "Failed to archive category.")
    } finally {
      setMutatingId(null)
    }
  }

  const deleteIfNoChildren = async (c: GlobalCategoryRow) => {
    const hasKids = (childrenById.get(c.id)?.length ?? 0) > 0
    if (hasKids) return
    const ok = window.confirm("Delete this category?\n\nThis cannot be undone.")
    if (!ok) return

    setError(null)
    setMutatingId(c.id)
    try {
      const { error: delErr } = await supabase.from("global_categories").delete().eq("id", c.id)
      if (delErr) throw delErr
      onReload()
    } catch (e: any) {
      setError(e?.message || "Failed to delete category.")
    } finally {
      setMutatingId(null)
    }
  }

  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div>
          <div style={{ fontWeight: 900 }}>Global Category Tree</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            {badge("GLOBAL BLUEPRINT MODE")}
          </div>
        </div>
        <button type="button" className="secondary" onClick={() => addChild(null)} disabled={mutatingId === "__root__"}>
          + Root category
        </button>
      </div>

      {error ? (
        <div style={{ color: "var(--accent-red)", marginTop: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      ) : null}

      <div style={{ height: 10 }} />

      <div style={{ flex: 1, overflow: "auto" }}>
        <TreeDisplay
          nodes={nodes}
          selectedId={selectedId}
          onSelect={(n) => onSelect(n.id)}
          renderActions={(node) => {
            const c = node.meta as GlobalCategoryRow
            const hasKids = (childrenById.get(c.id)?.length ?? 0) > 0
            const isEditing = editingId === c.id
            const isMutating = mutatingId === c.id

            return (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {c.archived_at ? badge("Archived") : null}
                <button type="button" className="secondary" onClick={() => addChild(c.id)} disabled={isMutating}>
                  + Child
                </button>
                {!isEditing ? (
                  <button type="button" className="secondary" onClick={() => beginRename(c)} disabled={isMutating}>
                    Rename
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void commitRename()
                        if (e.key === "Escape") {
                          setEditingId(null)
                          setEditingName("")
                        }
                      }}
                      style={{ width: 180 }}
                      disabled={isMutating}
                    />
                    <button type="button" className="secondary" onClick={commitRename} disabled={isMutating}>
                      Save
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="secondary"
                  onClick={() => toggleArchive(c)}
                  disabled={isMutating}
                  style={{
                    color: c.archived_at ? "var(--accent-blue)" : "var(--accent-orange)",
                    background: c.archived_at ? "rgba(10, 132, 255, 0.10)" : "rgba(255, 159, 10, 0.12)",
                  }}
                >
                  {c.archived_at ? "Unarchive" : "Archive"}
                </button>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => deleteIfNoChildren(c)}
                  disabled={isMutating || hasKids}
                  title={hasKids ? "Cannot delete: category has children." : "Delete category"}
                  style={{ color: hasKids ? "var(--text-secondary)" : "var(--accent-red)" }}
                >
                  Delete
                </button>
              </div>
            )
          }}
          renderLabel={(node) => {
            const c = node.meta as GlobalCategoryRow
            return (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontWeight: node.id === selectedId ? 900 : 700 }}>{node.label}</span>
                {c.archived_at ? <span style={{ fontSize: 12, opacity: 0.65 }}>(archived)</span> : null}
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}

