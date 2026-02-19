import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import { useMyRole } from "../../hooks/useMyRole"
import type { TaskAssignmentRow } from "../assignments/types"
import type { TaskIncidentRow } from "./types"
import { IncidentList } from "./IncidentList"
import { IncidentEditor } from "./IncidentEditor"

type YachtRow = { id: string; name: string; group_id: string; archived_at: string | null }

type AssignmentOption = { id: string; name: string; archived_at: string | null }

export default function YachtTasksPage() {
  const { yachtId } = useParams<{ yachtId: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const { role, loading: roleLoading } = useMyRole()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [yacht, setYacht] = useState<YachtRow | null>(null)
  const [incidents, setIncidents] = useState<TaskIncidentRow[]>([])
  const [assignmentById, setAssignmentById] = useState<Map<string, TaskAssignmentRow>>(new Map())
  const [assignmentOptions, setAssignmentOptions] = useState<AssignmentOption[]>([])

  const [editingIncident, setEditingIncident] = useState<TaskIncidentRow | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [mutatingId, setMutatingId] = useState<string | null>(null)

  const canCreate = role === "admin" || role === "manager"
  const canManage = role === "admin" || role === "manager"
  const canComplete = role === "admin" || role === "manager" || role === "crew"

  const load = useCallback(async () => {
    if (!yachtId) return
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => setLoading(false), 1500)
    try {
      const yachtRes = await supabase
        .from("yachts")
        .select("id,name,group_id,archived_at")
        .eq("id", yachtId)
        .maybeSingle()

      if (yachtRes.error) throw yachtRes.error
      if (!yachtRes.data) {
        setYacht(null)
        setIncidents([])
        setAssignmentById(new Map())
        setAssignmentOptions([])
        setLoading(false)
        return
      }

      const incRes = await supabase
        .from("task_incidents")
        .select("id,assignment_id,yacht_id,due_date,status,completed_by,completed_at,created_at")
        .eq("yacht_id", yachtId)
        .order("due_date", { ascending: true })
        .limit(2000)

      if (incRes.error) throw incRes.error
      const incList = ((incRes.data as any[]) ?? []) as TaskIncidentRow[]

      const assignmentIds = Array.from(new Set(incList.map((i) => i.assignment_id).filter(Boolean)))
      const assignmentMap = new Map<string, TaskAssignmentRow>()
      if (assignmentIds.length > 0) {
        const { data: aRows, error: aErr } = await supabase
          .from("task_assignments")
          .select("id,template_id,parent_assignment_id,group_id,yacht_id,name,description,period,config,is_override,archived_at,created_at")
          .in("id", assignmentIds)
          .limit(5000)
        if (aErr) throw aErr
        ;(((aRows as any[]) ?? []) as TaskAssignmentRow[]).forEach((a) => assignmentMap.set(a.id, a))
      }

      // Options for creating/editing incidents (yacht assignments + group assignments for this yacht's group)
      const yachtGroupId = String((yachtRes.data as any)?.group_id ?? "")
      const { data: optionRows, error: optErr } = await supabase
        .from("task_assignments")
        .select("id,name,archived_at,yacht_id,group_id")
        .or(`yacht_id.eq.${yachtId},group_id.eq.${yachtGroupId}`)
        .order("name")
        .limit(5000)
      if (optErr) throw optErr

      setYacht(yachtRes.data as any as YachtRow)
      setIncidents(incList)
      setAssignmentById(assignmentMap)
      setAssignmentOptions((((optionRows as any[]) ?? []) as any[]).map((r) => ({
        id: String(r.id),
        name: String(r.name ?? ""),
        archived_at: (r.archived_at ?? null) as string | null,
      })))
      setLoading(false)
    } catch (e: any) {
      setError(e?.message || "Failed to load yacht tasks.")
      setYacht(null)
      setIncidents([])
      setAssignmentById(new Map())
      setAssignmentOptions([])
      setLoading(false)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }, [yachtId])

  useEffect(() => {
    if (!session) return
    void load()
  }, [session, load])

  const completeIncident = async (incidentId: string) => {
    if (!session?.user?.id) return
    if (!canComplete) return
    setMutatingId(incidentId)
    setError(null)
    try {
      const nowIso = new Date().toISOString()
      const { error: upErr } = await supabase
        .from("task_incidents")
        .update({ status: "completed", completed_at: nowIso })
        .eq("id", incidentId)
      if (upErr) throw upErr
      await load()
    } catch (e: any) {
      setError(e?.message || "Failed to complete incident.")
    } finally {
      setMutatingId(null)
    }
  }

  if (!yachtId) return null
  if (loading || roleLoading) return <div className="screen">Loading…</div>

  if (!yacht) {
    return (
      <div className="screen">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, marginTop: -6 }}>
          <button type="button" onClick={() => navigate(-1)} className="primary-button">
            ← Back
          </button>
        </div>
        <hr />
        <div className="screen-title">Yacht tasks</div>
        <div style={{ opacity: 0.75, fontSize: 13 }}>Not found (or not visible for this account).</div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, marginTop: -6 }}>
        <button type="button" onClick={() => navigate(`/yachts/${yachtId}`)} className="primary-button">
          ← Yacht
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          {canCreate ? (
            <button type="button" className="primary-button" onClick={() => setShowCreate(true)}>
              + Incident
            </button>
          ) : null}
        </div>
      </div>

      <hr />

      <div className="screen-title" style={{ marginBottom: 6 }}>
        {yacht.name}
      </div>
      <div className="screen-subtitle">Task incidents for this yacht.</div>

      {error ? (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      ) : null}

      <IncidentList
        incidents={incidents}
        assignmentById={assignmentById}
        canComplete={canComplete && !mutatingId}
        canManage={canManage && !mutatingId}
        onComplete={(id) => void completeIncident(id)}
        onEdit={(inc) => setEditingIncident(inc)}
      />

      {showCreate ? (
        <IncidentEditor
          yachtId={yachtId}
          assignments={assignmentOptions}
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={load}
        />
      ) : null}

      {editingIncident && canManage ? (
        <IncidentEditor
          yachtId={yachtId}
          assignments={assignmentOptions}
          mode="edit"
          initial={editingIncident}
          onClose={() => setEditingIncident(null)}
          onSaved={load}
        />
      ) : null}
    </div>
  )
}

