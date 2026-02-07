import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useYachtGroupTree } from "../hooks/useYachtGroupTree"
import React from "react";

export default function YachtsApp() {
  const navigate = useNavigate()
  const { nodes, loading } = useYachtGroupTree()

  if (loading) {
    return <div className="app-content">Loading…</div>
  }

  return (
    <div
      className="app-content"
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Top Bar (match editors) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          marginTop: -6,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-primary)",
            padding: 0,
          }}
        >
          ← Back
        </button>

        <button
          onClick={() => navigate("/desktop")}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-primary)",
            padding: 0,
          }}
        >
          Home
        </button>
      </div>

      <hr />

      {/* Subheading */}
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        Yachts
      </div>

      {/* Scroll-limited tree area */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <TreeDisplay
          nodes={nodes as TreeNode[]}
          onSelect={(node) => {
            if (node.nodeType === "yacht") {
              navigate(`/apps/yachts/${node.id}`)
            }
          }}
        />
      </div>

      <hr />

      {/* Bottom actions */}
      <div style={{ paddingTop: 6 }}>
        <button
          onClick={() => navigate("/apps/yachts/new")}
          style={{
            background: "var(--border-subtle)",
            border: "none",
            borderRadius: 12,
            padding: "4px 10px",
            cursor: "pointer",
            color: "var(--text-primary)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          New Yacht
        </button>
      </div>
    </div>
  )
}
