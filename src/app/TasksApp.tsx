import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useTaskTree } from "../hooks/useTaskTree"
import React from "react";

export default function TasksApp() {
  const navigate = useNavigate()
  const { nodes, loading } = useTaskTree()
  const rootIds = (nodes as TreeNode[]).filter((n) => n.parentId === null).map((n) => n.id)

  if (loading) {
    return <div className="screen">Loading…</div>
  }

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="screen-title">Tasks</div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <TreeDisplay
          nodes={nodes as TreeNode[]}
          defaultExpandedIds={rootIds}
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
