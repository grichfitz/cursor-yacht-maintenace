import React from "react"
import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useCategoryTree } from "../hooks/useCategoryTree"
import { Folder } from "lucide-react"
import { pickBadgeVariant } from "../ui/badgeColors"
import { useIsAdmin } from "../hooks/useIsAdmin"

export default function CategoriesApp() {
  const navigate = useNavigate()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  const { nodes, loading, error } = useCategoryTree()

  if (loading || adminLoading) return <div className="screen">Loading…</div>

  if (!isAdmin) {
    return (
      <div className="screen">
        <div className="screen-title">Categories</div>
        <div style={{ opacity: 0.75, fontSize: 13 }}>
          This area is restricted to administrators.
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="screen-title">Categories</div>
      {error ? (
        <div style={{ color: "var(--accent-red)", fontSize: 13, marginBottom: 10 }}>
          {error}
        </div>
      ) : null}

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <TreeDisplay
          nodes={nodes as TreeNode[]}
          defaultExpandedIds={[]}
          renderIcon={(node) => {
            if (node.nodeType === "category") {
              const isVirtual = !!node.meta?.isVirtual
              const variant = isVirtual ? "gray" : pickBadgeVariant(node.id)
              return (
                <span className={`tree-icon-badge tree-icon-badge--${variant}`}>
                  <Folder size={16} />
                </span>
              )
            }
            return null
          }}
          onSelect={(node) => {
            if (node.id.startsWith("__")) return
            navigate(`/categories/${node.id}`)
          }}
        />
      </div>

      <button
        type="button"
        className="cta-button"
        onClick={() => navigate("/categories/new")}
      >
        + New Category
      </button>
    </div>
  )
}

