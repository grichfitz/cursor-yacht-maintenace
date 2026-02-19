import React, { useCallback, useEffect, useMemo, useState } from "react"
import EditorNav from "../../pages/editor/EditorNav"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import { useMyRole } from "../../hooks/useMyRole"
import type { GlobalCategoryRow, TaskTemplateRow } from "../blueprint/types"
import type { GroupRow, TaskAssignmentRow, YachtRow } from "./types"
import { ContextSelector, type AssignmentScope } from "./ContextSelector"
import { BlueprintBrowser, type BlueprintSelection } from "./BlueprintBrowser"
import { PropagationConfirmModal } from "./PropagationConfirmModal"
import { AssignmentList } from "./AssignmentList"
import { AssignmentEditorModal } from "./AssignmentEditorModal"

export default function AssignmentPage() {
  const { session } = useSession()
  const { role, loading: roleLoading } = useMyRole()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [groups, setGroups] = useState<GroupRow[]>([])
  const [yachts, setYachts] = useState<YachtRow[]>([])

  const [categories, setCategories] = useState<GlobalCategoryRow[]>([])
  const [templates, setTemplates] = useState<TaskTemplateRow[]>([])

  const [scope, setScope] = useState<AssignmentScope>({ kind: "none" })
  const [selection, setSelection] = useState<BlueprintSelection>({ kind: "none" })

  const [assignments, setAssignments] = useState<TaskAssignmentRow[]>([])
  const [editing, setEditing] = useState<TaskAssignmentRow | null>(null)

  const [showConfirm, setShowConfirm] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [confirmAffectedYachtCount, setConfirmAffectedYachtCount] = useState<number | null>(null)

  const canEditAssignments = role === "admin" || role === "manager"

  const templateNameById = useMemo(() => {
    const m = new Map<string, string>()
    templates.forEach((t) => m.set(t.id, t.name))
    return m
  }, [templates])

  const loadBlueprint = useCallback(async () => {
    const [catsRes, tplRes] = await Promise.all([
      supabase.from("global_categories").select("id,parent_category_id,name,archived_at,created_at").order("name").limit(5000),
      supabase.from("task_templates").select("id,global_category_id,name,description,period,metadata,archived_at,created_at").order("name").limit(10000),
    ])
    if (catsRes.error) throw catsRes.error
    if (tplRes.error) throw tplRes.error
    setCategories((catsRes.data as any as GlobalCategoryRow[]) ?? [])
    setTemplates((tplRes.data as any as TaskTemplateRow[]) ?? [])
  }, [])

  const loadDirectory = useCallback(async () => {
    const [gRes, yRes] = await Promise.all([
      supabase.from("groups").select("id,name").order("name").limit(5000),
      supabase.from("yachts").select("id,name,group_id").order("name").limit(5000),
    ])
    if (gRes.error) throw gRes.error
    if (yRes.error) throw yRes.error
    setGroups((gRes.data as any as GroupRow[]) ?? [])
    setYachts((yRes.data as any as YachtRow[]) ?? [])
  }, [])

  const loadAssignments = useCallback(async () => {
    if (scope.kind === "none") {
      setAssignments([])
      return
    }
    let q = supabase
      .from("task_assignments")
      .select("id,template_id,parent_assignment_id,group_id,yacht_id,name,description,period,config,is_override,archived_at,created_at")
      .order("created_at", { ascending: false })
      .limit(5000)

    if (scope.kind === "group") q = q.eq("group_id", scope.groupId).is("yacht_id", null)
    if (scope.kind === "yacht") q = q.eq("yacht_id", scope.yachtId).is("group_id", null)

    const { data, error: aErr } = await q
    if (aErr) throw aErr
    setAssignments((data as any as TaskAssignmentRow[]) ?? [])
  }, [scope])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    const timeoutId = window.setTimeout(() => setLoading(false), 1500)

    try {
      await Promise.all([loadDirectory(), loadBlueprint()])
      await loadAssignments()
      setLoading(false)
    } catch (e: any) {
      setError(e?.message || "Failed to load assignments UI.")
      setLoading(false)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }, [loadDirectory, loadBlueprint, loadAssignments])

  useEffect(() => {
    if (!session) return
    void loadAll()
  }, [session, loadAll])

  useEffect(() => {
    if (!session) return
    void loadAssignments().catch((e: any) => {
      setError(e?.message || "Failed to load assignments.")
      setAssignments([])
    })
  }, [session, loadAssignments])

  const templateCountForConfirm = useMemo(() => {
    if (selection.kind === "template") return 1
    if (selection.kind === "subtree") return null
    return 0
  }, [selection])

  const startAssign = async () => {
    setError(null)
    setNotice(null)

    if (!canEditAssignments) {
      setError("Read-only role. Only admin/manager can create assignments.")
      return
    }
    if (scope.kind === "none") {
      setError("Select a group or yacht scope.")
      return
    }
    if (scope.kind === "group" && !scope.groupId) {
      setError("Select a group.")
      return
    }
    if (scope.kind === "yacht" && !scope.yachtId) {
      setError("Select a yacht.")
      return
    }
    if (selection.kind === "none") {
      setError("Select a template or a category subtree.")
      return
    }
    if (scope.kind === "yacht" && selection.kind === "subtree") {
      setError("Subtree assignment to yacht is not available (no RPC contract for it). Select a single template.")
      return
    }

    if (scope.kind === "yacht") {
      setConfirmAffectedYachtCount(1)
    } else {
      setConfirmAffectedYachtCount(null)
    }

    setShowConfirm(true)
  }

  const confirmAssign = async ({ overrideExisting }: { overrideExisting: boolean }) => {
    if (!canEditAssignments) return
    if (scope.kind === "none") return

    setAssigning(true)
    setError(null)
    setNotice(null)

    try {
      if (scope.kind === "group") {
        const groupId = scope.groupId
        if (selection.kind === "template") {
          const { error: rpcErr } = await supabase.rpc("assign_global_template_to_group", {
            p_template_id: selection.templateId,
            p_group_id: groupId,
            p_override_existing: overrideExisting,
          })
          if (rpcErr) throw rpcErr
        } else if (selection.kind === "subtree") {
          const { error: rpcErr } = await supabase.rpc("assign_global_category_subtree_to_group", {
            p_category_id: selection.categoryId,
            p_group_id: groupId,
            p_override_existing: overrideExisting,
          })
          if (rpcErr) throw rpcErr
        }
      } else if (scope.kind === "yacht") {
        const yachtId = scope.yachtId
        if (selection.kind !== "template") throw new Error("Invalid selection for yacht scope.")
        const { error: rpcErr } = await supabase.rpc("assign_global_template_to_yacht", {
          p_template_id: selection.templateId,
          p_yacht_id: yachtId,
          p_override_existing: overrideExisting,
        })
        if (rpcErr) throw rpcErr
      }

      setNotice("Assignments created.")
      setShowConfirm(false)
      setSelection({ kind: "none" })
      await loadAssignments()
    } catch (e: any) {
      setError(e?.message || "Failed to assign templates.")
    } finally {
      setAssigning(false)
    }
  }

  if (loading || roleLoading) return <div className="screen">Loading…</div>

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <EditorNav />
      <div className="screen-title">Editor · Assignments</div>
      <div className="screen-subtitle">Admin + manager. Crew/owner are read-only.</div>

      {error ? <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>{error}</div> : null}
      {notice && !error ? <div style={{ color: "var(--text-secondary)", marginBottom: 10, fontSize: 13 }}>{notice}</div> : null}
      {assigning ? (
        <div className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Assigning…</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Working…</div>
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
        <ContextSelector
          groups={groups}
          yachts={yachts}
          value={scope}
          onChange={(v) => {
            setScope(v)
            setError(null)
            setNotice(null)
            setAssignments([])
          }}
        />

        <BlueprintBrowser
          categories={categories}
          templates={templates}
          selection={selection}
          onChangeSelection={setSelection}
          allowSubtree={scope.kind !== "yacht"}
        />

        <div className="card">
          <button type="button" className="cta-button" onClick={startAssign} disabled={!canEditAssignments || assigning}>
            Assign selected
          </button>
        </div>

        <AssignmentList
          assignments={assignments}
          templateNameById={templateNameById}
          canEdit={canEditAssignments}
          onEdit={(a) => setEditing(a)}
        />
      </div>

      {editing ? (
        <AssignmentEditorModal
          assignment={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await loadAssignments()
          }}
        />
      ) : null}

      {showConfirm ? (
        <PropagationConfirmModal
          scope={scope}
          templateCount={templateCountForConfirm === 0 ? 0 : templateCountForConfirm}
          affectedYachtCount={confirmAffectedYachtCount}
          onCancel={() => setShowConfirm(false)}
          onConfirm={confirmAssign}
        />
      ) : null}
    </div>
  )
}

