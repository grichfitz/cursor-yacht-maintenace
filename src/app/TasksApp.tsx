import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useTaskTree } from "../hooks/useTaskTree"
import React from "react";
import { CheckSquare, Folder } from "lucide-react"
import { pickBadgeVariant } from "../ui/badgeColors"

export default function TasksApp() {
  const navigate = useNavigate()
  const { nodes, loading } = useTaskTree()
  const rootIds = (nodes as TreeNode[]).filter((n) => n.parentId === null).map((n) => n.id)
  const visibleNodes = (nodes as TreeNode[]).filter((n) => {
    if (n.nodeType !== "task") return true
    return (n.meta as any)?.is_latest !== false
  })

  if (loading) {
    return <div className="screen">Loading…</div>
  }

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="screen-title">Tasks</div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <TreeDisplay
          nodes={visibleNodes as TreeNode[]}
          defaultExpandedIds={rootIds}
          renderIcon={(node) => {
            if (node.nodeType === "category") {
              const variant = pickBadgeVariant(node.id)
              return (
                <span className={`tree-icon-badge tree-icon-badge--${variant}`}>
                  <Folder size={16} />
                </span>
              )
            }
            if (node.nodeType === "task") {
              const variant = pickBadgeVariant(node.parentId ?? node.id)
              return (
                <span className={`tree-icon-badge tree-icon-badge--${variant} tree-icon-badge--solid`}>
                  <CheckSquare size={16} />
                </span>
              )
            }
            return null
          }}
          onSelect={(node) => {
            // Tasks are leaf nodes only
            if (node.nodeType === "task") {
              navigate(`/apps/tasks/${node.id}`)
            }
          }}
        />
      </div>

      <button
        type="button"
        className="cta-button"
        onClick={() => navigate("/apps/tasks/new")}
      >
        + Add Task
      </button>
    </div>
  )
}
