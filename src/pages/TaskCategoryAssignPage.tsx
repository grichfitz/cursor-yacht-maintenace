import { useNavigate, useParams } from "react-router-dom"
import { useCategoryTree } from "../hooks/useCategoryTree"
import GenericTreeAssignPage from "./GenericTreeAssignPage"
import { supabase } from "../lib/supabase"
import React, { useEffect, useState } from "react";

export default function TaskCategoryAssignPage() {
  const navigate = useNavigate()
  const { taskId } = useParams<{ taskId: string }>()
  const { nodes } = useCategoryTree()
  const [taskName, setTaskName] = useState<string>("")

  if (!taskId) return null

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("name")
        .eq("id", taskId)
        .maybeSingle()

      if (!cancelled) {
        if (error) setTaskName("")
        else setTaskName((data as any)?.name ?? "")
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [taskId])

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
        Assigned Categories{taskName ? ` for ${taskName}` : ""}
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <GenericTreeAssignPage
          targetId={taskId}
          nodes={nodes}
          mapTable="task_category_map"
          mapTargetField="task_id"
          mapNodeField="category_id"
          editBasePath="/categories"
        />
      </div>

      <hr />

      <div style={{ paddingTop: 6 }}>
        <button
          onClick={() => navigate("/categories/new")}
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
          New Category
        </button>
      </div>

    </div>
  )
}
