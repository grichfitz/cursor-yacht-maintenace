import { useNavigate, useParams } from "react-router-dom"
import GenericTreeAssignPage from "./GenericTreeAssignPage"
import { useGroupTree } from "../hooks/useGroupTree"
import { supabase } from "../lib/supabase"
import React, { useEffect, useState } from "react";

export default function YachtGroupAssignPage() {
  const navigate = useNavigate()
  const { yachtId } = useParams<{ yachtId: string }>()
  const { nodes } = useGroupTree()
  const [yachtName, setYachtName] = useState<string>("")

  if (!yachtId) return null

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase
        .from("yachts")
        .select("name")
        .eq("id", yachtId)
        .maybeSingle()

      if (!cancelled) {
        if (error) {
          setYachtName("")
        } else {
          setYachtName((data as any)?.name ?? "")
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [yachtId])

  return (
    <div
      className="screen"
      style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <button
          type="button"
          className="primary-button"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        Groups{yachtName ? ` for ${yachtName}` : ""}
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <GenericTreeAssignPage
          targetId={yachtId}
          nodes={nodes}
          // Schema source of truth: yacht_group_links(yacht_id, group_id)
          mapTable="yacht_group_links"
          mapTargetField="yacht_id"
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
