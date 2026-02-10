import React from "react"
import { useNavigate, useParams } from "react-router-dom"
import GenericTreeAssignPage from "./GenericTreeAssignPage"
import { useGroupTree } from "../hooks/useGroupTree"

export default function UserGroupAssignPage() {
  const navigate = useNavigate()
  const { userId } = useParams<{ userId: string }>()
  const { nodes } = useGroupTree()

  if (!userId) return null

  return (
    <div
      className="screen"
      style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          className="primary-button"
          onClick={() => navigate(-1)}
          style={{ cursor: "pointer" }}
        >
          ← Back
        </div>

        <div
          className="primary-button"
          onClick={() => navigate("/desktop")}
          style={{ cursor: "pointer" }}
        >
          Home
        </div>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Assigned Groups</div>

      <div style={{ 
        marginBottom: 12, 
        padding: 12, 
        background: "rgba(255, 193, 7, 0.1)", 
        border: "1px solid rgba(255, 193, 7, 0.3)",
        borderRadius: 8,
        fontSize: 13,
        color: "var(--text-primary)"
      }}>
        <strong>Note:</strong> User-group assignment is restricted to administrators only. If you are an admin, you can modify memberships using the checkboxes below. Non-admin users cannot modify user-group assignments.
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <GenericTreeAssignPage
          targetId={userId}
          nodes={nodes}
          // Schema source of truth: user_group_links(user_id, group_id)
          // Note: RLS blocks writes - this is admin/service only per RLS_DESIGN.md
          mapTable="user_group_links"
          mapTargetField="user_id"
          mapNodeField="group_id"
          editBasePath="/groups"
        />
      </div>

      <hr />

      <div style={{ paddingTop: 6 }}>
        <button
          onClick={() => navigate("/groups/new")}
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
          New Group
        </button>
      </div>
    </div>
  )
}

