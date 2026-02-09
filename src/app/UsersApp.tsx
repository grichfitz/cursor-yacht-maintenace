import React from "react"
import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useUserGroupTree } from "../hooks/useUserGroupTree"
import { Folder, User } from "lucide-react"
import { pickBadgeVariant } from "../ui/badgeColors"

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
            if (node.nodeType === "user") {
              const variant = pickBadgeVariant(node.parentId ?? node.id)
              return (
                <span className={`tree-icon-badge tree-icon-badge--${variant} tree-icon-badge--solid`}>
                  <User size={16} />
                </span>
              )
            }
            return null
          }}
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

