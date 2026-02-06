import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useTaskTree } from "../hooks/useTaskTree"
import React from "react";

export default function TasksApp() {
  const navigate = useNavigate()
  const { nodes, loading } = useTaskTree()

  if (loading) {
    return <div className="app-content">Loading…</div>
  }

  return (
    <div className="app-content">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          marginBottom: 8,
          color: "var(--text-primary)",
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      {/* Subheading */}
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        Tasks
      </div>

      <TreeDisplay
        nodes={nodes as TreeNode[]}
        onSelect={(node) => {
          // Tasks are leaf nodes only
          if (node.nodeType === "task") {
            navigate(`/apps/tasks/${node.id}`)
          }
        }}
      />
    </div>
  )
}
