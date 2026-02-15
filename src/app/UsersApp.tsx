import React from "react"
import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useUserGroupTree } from "../hooks/useUserGroupTree"
import { Folder, User } from "lucide-react"
import { pickBadgeVariant } from "../ui/badgeColors"
import { useIsAdmin } from "../hooks/useIsAdmin"

export default function UsersApp() {
  const navigate = useNavigate()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  const { nodes, loading } = useUserGroupTree()

  if (loading || adminLoading) {
    return <div className="screen">Loading…</div>
  }

  if (!isAdmin) {
    return (
      <div className="screen">
        <div className="screen-title">Users</div>
        <div style={{ opacity: 0.75, fontSize: 13 }}>
          This area is restricted to administrators.
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="screen-title">Users</div>

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
              navigate(`/users/${node.id}`)
            }
          }}
        />
      </div>
    </div>
  )
}

