import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useYachtGroupTree } from "../hooks/useYachtGroupTree"
import React from "react";
import { Folder, Ship } from "lucide-react"
import { pickBadgeVariant } from "../ui/badgeColors"

export default function YachtsApp() {
  const navigate = useNavigate()
  const { nodes, loading } = useYachtGroupTree()

  if (loading) {
    return <div className="screen">Loading…</div>
  }

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="screen-title">Yachts</div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <TreeDisplay
          nodes={nodes as TreeNode[]}
          defaultExpandedIds={[]}
          renderIcon={(node) => {
            if (node.nodeType === "group") {
              const isVirtual = !!node.meta?.isVirtual
              const variant = isVirtual ? "gray" : pickBadgeVariant(node.id)
              return (
                <span className={`tree-icon-badge tree-icon-badge--${variant}`}>
                  <Folder size={16} />
                </span>
              )
            }
            if (node.nodeType === "yacht") {
              const variant = pickBadgeVariant(node.parentId ?? node.id)
              return (
                <span className={`tree-icon-badge tree-icon-badge--${variant} tree-icon-badge--solid`}>
                  <Ship size={16} />
                </span>
              )
            }
            return null
          }}
          onSelect={(node) => {
            if (node.nodeType === "yacht") {
              navigate(`/apps/yachts/${node.id}`)
            }
          }}
        />
      </div>

      <button
        type="button"
        className="cta-button"
        onClick={() => navigate("/apps/yachts/new")}
      >
        + Add Yacht
      </button>
    </div>
  )
}
