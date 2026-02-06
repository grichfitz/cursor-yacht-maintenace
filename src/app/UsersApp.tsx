import React from "react"
import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useUserGroupTree } from "../hooks/useUserGroupTree"

export default function UsersApp() {
  const navigate = useNavigate()
  const { nodes, loading } = useUserGroupTree()

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
        Users
      </div>

      <TreeDisplay
        nodes={nodes as TreeNode[]}
        onSelect={(node) => {
          if (node.nodeType === "user") {
            navigate(`/apps/users/${node.id}`)
          }
        }}
      />
    </div>
  )
}

