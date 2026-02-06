import { useNavigate, useParams } from "react-router-dom"
import GenericTreeAssignPage from "./GenericTreeAssignPage"
import { useGroupTree } from "../hooks/useGroupTree"

export default function YachtGroupAssignPage() {
  const navigate = useNavigate()
  const { yachtId } = useParams<{ yachtId: string }>()
  const { nodes } = useGroupTree()

  if (!yachtId) return null

  return (
    <div className="app-content">

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
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

      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        Assigned Groups
      </div>

      <GenericTreeAssignPage
        targetId={yachtId}
        nodes={nodes}
        mapTable="yacht_group_map"
        mapTargetField="yacht_id"
        mapNodeField="group_id"
        editBasePath="/groups"
      />

    </div>
  )
}
