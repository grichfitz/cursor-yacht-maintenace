import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Pencil } from "lucide-react"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { useTaskTree } from "../hooks/useTaskTree"
import { supabase } from "../lib/supabase"

type TaskAssignmentRow = {
  id: string
  group_id: string
  task_id: string
  inherits_from_assignment_id: string | null
  override_data: any
  is_archived: boolean
}

type EffectiveAssignmentRow = {
  task_id: string
  task_name: string
  task_description: string | null
  default_unit_of_measure_id: string | null
  default_period_id: string | null
  effective_override_data: any
  effective_assignment_id: string
  source_group_id: string
  is_local: boolean
}

export default function GroupTaskAssignPage() {
  const navigate = useNavigate()
  const { groupId } = useParams<{ groupId: string }>()
  const { nodes, loading, error } = useTaskTree()

  const [effectiveByTaskId, setEffectiveByTaskId] = useState<
    Record<string, EffectiveAssignmentRow>
  >({})
  const [localByTaskId, setLocalByTaskId] = useState<Record<string, TaskAssignmentRow>>(
    {}
  )
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const load = async () => {
    if (!groupId) return
    setPageError(null)

    // Local assignments for this group only.
    const { data: local, error: localErr } = await supabase
      .from("task_assignments")
      .select("id, group_id, task_id, inherits_from_assignment_id, override_data, is_archived")
      .eq("group_id", groupId)
      .eq("is_archived", false)

    if (localErr) {
      setPageError(localErr.message)
      return
    }

    const localMap: Record<string, TaskAssignmentRow> = {}
    ;((local as TaskAssignmentRow[] | null) ?? []).forEach((r) => {
      localMap[r.task_id] = r
    })
    setLocalByTaskId(localMap)

    // Effective assignments for this group (SQL-authoritative inheritance merge).
    const { data: effective, error: effErr } = await supabase.rpc(
      "effective_task_assignments",
      { target_group_id: groupId }
    )

    if (effErr) {
      setPageError(effErr.message)
      setEffectiveByTaskId({})
      return
    }

    const effMap: Record<string, EffectiveAssignmentRow> = {}
    ;((effective as EffectiveAssignmentRow[] | null) ?? []).forEach((r) => {
      effMap[r.task_id] = r
    })
    setEffectiveByTaskId(effMap)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  const toggleTask = async (taskId: string) => {
    if (!groupId) return
    if (savingTaskId === taskId) return
    setPageError(null)
    setSavingTaskId(taskId)

    const effective = effectiveByTaskId[taskId]
    const local = localByTaskId[taskId]

    const isCurrentlyAssigned = !!effective
    const isInheritedOnly = isCurrentlyAssigned && !local

    if (isInheritedOnly) {
      setSavingTaskId(null)
      alert("This task is inherited from a parent group. Create a local override instead of unassigning.")
      return
    }

    if (local) {
      // Delete local assignment. If this was an override, the task may remain inherited.
      const { error: delErr } = await supabase
        .from("task_assignments")
        .delete()
        .eq("id", local.id)

      setSavingTaskId(null)

      if (delErr) {
        setPageError(delErr.message)
        return
      }

      await load()

      if (local.inherits_from_assignment_id) {
        alert("Removed local override. This task may still apply via inheritance from a parent group.")
      }

      return
    }

    // Insert new local assignment (base assignment for this group).
    const { error: insErr } = await supabase.from("task_assignments").insert({
      group_id: groupId,
      task_id: taskId,
      inherits_from_assignment_id: null,
      override_data: {},
      is_archived: false,
      updated_at: new Date().toISOString(),
    })

    setSavingTaskId(null)

    if (insErr) {
      setPageError(insErr.message)
      return
    }

    await load()
  }

  const ensureLocalOverride = async (taskId: string) => {
    if (!groupId) return
    setPageError(null)

    const alreadyLocal = localByTaskId[taskId]
    if (alreadyLocal) {
      navigate(`/groups/${groupId}/tasks/${taskId}/override`)
      return
    }

    const effective = effectiveByTaskId[taskId]
    if (!effective?.effective_assignment_id) {
      setPageError("This task is not assigned to this group (directly or via inheritance).")
      return
    }

    const { error: insErr } = await supabase.from("task_assignments").insert({
      group_id: groupId,
      task_id: taskId,
      inherits_from_assignment_id: effective.effective_assignment_id,
      override_data: {},
      is_archived: false,
      updated_at: new Date().toISOString(),
    })

    if (insErr) {
      setPageError(insErr.message)
      return
    }

    await load()
    navigate(`/groups/${groupId}/tasks/${taskId}/override`)
  }

  const visibleNodes = useMemo(() => {
    // For assignment screens, keep the normal tree; virtual nodes remain non-editable.
    return nodes
  }, [nodes])

  if (!groupId) return null

  return (
    <div
      className="screen"
      style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <button type="button" className="primary-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Group Task Assignments</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
        Parent assignments propagate downward. Inherited tasks cannot be removed here; create a local override instead.
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => navigate(`/groups/${groupId}/categories/apply`)}
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
          title="Bulk apply a category subtree (creates task assignments)"
        >
          Apply Category…
        </button>
      </div>

      {(pageError || error) && (
        <div style={{ color: "var(--accent-red)", marginBottom: 12, fontSize: 13 }}>
          {pageError || error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <TreeDisplay
          nodes={visibleNodes as TreeNode[]}
          renderActions={(node) => {
            const isVirtual = node.id.startsWith("__")
            if (node.nodeType !== "task") return null

            const effective = effectiveByTaskId[node.id]
            const local = localByTaskId[node.id]

            const isAssigned = !!effective
            const isInheritedOnly = isAssigned && !local

            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={isAssigned}
                  disabled={isVirtual || savingTaskId === node.id || isInheritedOnly}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation()
                    if (!isVirtual) toggleTask(node.id)
                  }}
                  title={
                    isInheritedOnly
                      ? "Inherited from a parent group"
                      : isAssigned
                        ? "Assigned locally"
                        : "Not assigned"
                  }
                />

                {/* Override / Edit */}
                {!isVirtual && isAssigned && (
                  <div
                    className="tree-action-icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      ensureLocalOverride(node.id)
                    }}
                    title={local ? "Edit local override" : "Create local override"}
                    style={{ opacity: savingTaskId === node.id ? 0.5 : 1 }}
                  >
                    <Pencil size={14} />
                  </div>
                )}
              </div>
            )
          }}
        />
      </div>

      {loading && <div style={{ padding: 12 }}>Loading…</div>}
    </div>
  )
}

