import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useTaskTree } from "../hooks/useTaskTree"
import React from "react";
import { CheckSquare, Folder } from "lucide-react"
import { pickBadgeVariant } from "../ui/badgeColors"

export default function TasksApp() {
  const navigate = useNavigate()
  const { nodes, loading, error } = useTaskTree()
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

      {error && (
        <div
          style={{
            background: "rgba(255,0,0,0.08)",
            border: "1px solid rgba(255,0,0,0.2)",
            color: "var(--text-primary)",
            padding: "8px 10px",
            borderRadius: 10,
            marginBottom: 10,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Task load warning</div>
          <div style={{ opacity: 0.9 }}>{error}</div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        {visibleNodes.length === 0 ||
        (visibleNodes.length > 0 && visibleNodes.every((n) => n.parentId !== null)) ? (
          <div style={{ opacity: 0.75, fontSize: 13, padding: "8px 2px" }}>
            No tasks visible for this account.
          </div>
        ) : null}
        <TreeDisplay
          nodes={visibleNodes as TreeNode[]}
          defaultExpandedIds={[]}
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
