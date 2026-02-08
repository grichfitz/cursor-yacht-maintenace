import React from "react"
import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useUserGroupTree } from "../hooks/useUserGroupTree"

export default function UsersApp() {
  const navigate = useNavigate()
  const { nodes, loading } = useUserGroupTree()
  const rootIds = (nodes as TreeNode[]).filter((n) => n.parentId === null).map((n) => n.id)

  if (loading) {
    return <div className="screen">Loading…</div>
  }

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="screen-title">Users</div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <TreeDisplay
          nodes={nodes as TreeNode[]}
          defaultExpandedIds={rootIds}
          onSelect={(node) => {
            if (node.nodeType === "user") {
              navigate(`/apps/users/${node.id}`)
            }
          }}
        />
      </div>

      <button
        type="button"
        className="cta-button"
        onClick={() => navigate("/apps/users/new")}
      >
        + Add User
      </button>
    </div>
  )
}

