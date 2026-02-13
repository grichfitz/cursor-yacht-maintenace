import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useMyRole } from "../hooks/useMyRole"
import { useSession } from "../auth/SessionProvider"

type YachtRow = {
  id: string
  name: string
  group_id: string
}

type TaskInstanceRow = {
  id: string
  yacht_id: string
  status: "pending" | "assigned" | "completed" | "verified"
  due_at: string | null
  template_id: string
  template_name: string
}

type TemplateRow = {
  id: string
  name: string
  description: string | null
}

type GroupMemberRow = {
  user_id: string
}

type UserRow = {
  id: string
  display_name: string | null
  email: string | null
}

type AssignmentRow = {
  task_instance_id: string
  assigned_to: string
  assigned_at: string
}

function StatusPill({ status }: { status: TaskInstanceRow["status"] }) {
  const cfg = useMemo(() => {
    switch (status) {
      case "pending":
        return { bg: "rgba(110,110,115,0.12)", fg: "rgba(60,60,67,0.95)" }
      case "assigned":
        return { bg: "rgba(10,132,255,0.14)", fg: "rgba(10,132,255,0.95)" }
      case "completed":
        return { bg: "rgba(52,199,89,0.14)", fg: "rgba(28,110,50,1)" }
      case "verified":
        return { bg: "rgba(34,199,184,0.16)", fg: "rgba(10,140,130,1)" }
    }
  }, [status])

  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.fg,
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: 999,
        padding: "3px 8px",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  )
}

export default function YachtPage() {
  const { yachtId } = useParams<{ yachtId: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const { role, loading: roleLoading } = useMyRole()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [yacht, setYacht] = useState<YachtRow | null>(null)
  const [instances, setInstances] = useState<TaskInstanceRow[]>([])
  const [assignments, setAssignments] = useState<Map<string, AssignmentRow>>(new Map())

  // Admin-only: create instance
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [newTemplateId, setNewTemplateId] = useState<string>("")
  const [dueAt, setDueAt] = useState<string>("")
  const [creating, setCreating] = useState(false)

  // Manager/Admin: assignees limited to yacht's group members
  const [assignees, setAssignees] = useState<UserRow[]>([])
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assignTo, setAssignTo] = useState<string>("")
  const [savingAssign, setSavingAssign] = useState(false)
  const [savingVerify, setSavingVerify] = useState<string | null>(null)

  const canAssign = role === "admin" || role === "manager"
  const canVerify = role === "admin" || role === "manager"
  const canCreateInstances = role === "admin"

  const load = async () => {
    if (!yachtId) return
    setLoading(true)
    setError(null)

    // If not admin, restrict yacht visibility to user's group memberships.
    if (role !== "admin") {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setYacht(null)
        setInstances([])
        setAssignments(new Map())
        setLoading(false)
        return
      }

      const { data: links, error: linkErr } = await supabase
        .from("user_group_links")
        .select("group_id")
        .eq("user_id", user.id)

      if (linkErr) {
        setError(linkErr.message)
        setYacht(null)
        setInstances([])
        setAssignments(new Map())
        setLoading(false)
        return
      }

      const groupIds = Array.from(
        new Set(((links as any[]) ?? []).map((l) => l.group_id).filter(Boolean))
      )

      if (groupIds.length === 0) {
        setYacht(null)
        setInstances([])
        setAssignments(new Map())
        setLoading(false)
        return
      }

      const { data: yachtRow, error: yErr } = await supabase
        .from("yachts")
        .select("id,name,group_id")
        .eq("id", yachtId)
        .in("group_id", groupIds)
        .maybeSingle()

      if (yErr) {
        setError(yErr.message)
        setLoading(false)
        return
      }

      if (!yachtRow) {
        setYacht(null)
        setInstances([])
        setAssignments(new Map())
        setLoading(false)
        return
      }

      // Proceed with visible yachtRow.
      const { data: taskRows, error: tErr } = await supabase
        .from("task_instances")
        .select("id,yacht_id,status,due_at,template_id,template_name")
        .eq("yacht_id", yachtId)
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })

      if (tErr) {
        setError(tErr.message)
        setYacht(yachtRow as YachtRow)
        setInstances([])
        setLoading(false)
        return
      }

      const instanceIds = ((taskRows as TaskInstanceRow[]) ?? []).map((t) => t.id)
      const assignmentMap = new Map<string, AssignmentRow>()

      if (instanceIds.length > 0) {
        const { data: aRows, error: aErr } = await supabase
          .from("task_assignments")
          .select("task_instance_id,assigned_to,assigned_at")
          .in("task_instance_id", instanceIds)

        if (!aErr) {
          ;((aRows as AssignmentRow[]) ?? []).forEach((a) => assignmentMap.set(a.task_instance_id, a))
        }
      }

      setYacht(yachtRow as YachtRow)
      setInstances((taskRows as TaskInstanceRow[]) ?? [])
      setAssignments(assignmentMap)
      setLoading(false)
      return
    }

    const { data: yachtRow, error: yErr } = await supabase
      .from("yachts")
      .select("id,name,group_id")
      .eq("id", yachtId)
      .single()

    if (yErr) {
      setError(yErr.message)
      setLoading(false)
      return
    }

    const { data: taskRows, error: tErr } = await supabase
      .from("task_instances")
      .select("id,yacht_id,status,due_at,template_id,template_name")
      .eq("yacht_id", yachtId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })

    if (tErr) {
      setError(tErr.message)
      setYacht(yachtRow as YachtRow)
      setInstances([])
      setLoading(false)
      return
    }

    const instanceIds = ((taskRows as TaskInstanceRow[]) ?? []).map((t) => t.id)
    const assignmentMap = new Map<string, AssignmentRow>()

    if (instanceIds.length > 0) {
      const { data: aRows, error: aErr } = await supabase
        .from("task_assignments")
        .select("task_instance_id,assigned_to,assigned_at")
        .in("task_instance_id", instanceIds)

      if (!aErr) {
        ;((aRows as AssignmentRow[]) ?? []).forEach((a) => assignmentMap.set(a.task_instance_id, a))
      }
    }

    setYacht(yachtRow as YachtRow)
    setInstances((taskRows as TaskInstanceRow[]) ?? [])
    setAssignments(assignmentMap)
    setLoading(false)
  }

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const run = async () => {
      if (cancelled) return
      await load()
    }

    run()
    const sub = supabase.auth.onAuthStateChange((event) => {
      // Avoid resume lag: token refresh fires on app resume; don't flip UI back to loading.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        run()
      }
    })
    return () => {
      cancelled = true
      sub.data.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yachtId, session])

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const loadTemplatesIfAdmin = async () => {
      if (!canCreateInstances) return
      const { data, error: tErr } = await supabase
        .from("task_templates")
        .select("id,name,description")
        .order("name")
      if (cancelled) return
      if (tErr) return
      setTemplates((data as TemplateRow[]) ?? [])
    }

    const loadAssigneesIfManager = async () => {
      if (!yacht?.group_id) return
      if (!canAssign) return

      const { data: memberRows, error: mErr } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", yacht.group_id)

      if (cancelled) return
      if (mErr) return

      const ids = Array.from(new Set(((memberRows as GroupMemberRow[]) ?? []).map((m) => m.user_id)))
      if (ids.length === 0) {
        setAssignees([])
        return
      }

      const { data: users, error: uErr } = await supabase
        .from("users")
        .select("id,display_name,email")
        .in("id", ids)
        .order("display_name")

      if (cancelled) return
      if (uErr) return
      setAssignees((users as UserRow[]) ?? [])
    }

    loadTemplatesIfAdmin()
    loadAssigneesIfManager()

    return () => {
      cancelled = true
    }
  }, [canAssign, canCreateInstances, yacht?.group_id, session])

  const createInstance = async () => {
    if (!yachtId) return
    if (!newTemplateId) return

    setCreating(true)
    setError(null)

    const tmpl = templates.find((t) => t.id === newTemplateId)
    if (!tmpl) {
      setError("Template not found.")
      setCreating(false)
      return
    }

    const due = dueAt ? new Date(dueAt).toISOString() : null

    const { error: insErr } = await supabase.from("task_instances").insert({
      template_id: tmpl.id,
      yacht_id: yachtId,
      status: "pending",
      due_at: due,
      template_name: tmpl.name,
      template_description: tmpl.description,
    })

    if (insErr) {
      setError(insErr.message)
      setCreating(false)
      return
    }

    setNewTemplateId("")
    setDueAt("")
    setCreating(false)
    await load()
  }

  const assign = async (taskInstanceId: string) => {
    if (!assignTo) return
    setSavingAssign(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError("Not signed in.")
      setSavingAssign(false)
      return
    }

    const { error: insErr } = await supabase.from("task_assignments").insert({
      task_instance_id: taskInstanceId,
      assigned_to: assignTo,
      assigned_by: user.id,
    })

    if (insErr) {
      setError(insErr.message)
      setSavingAssign(false)
      return
    }

    const { error: upErr } = await supabase
      .from("task_instances")
      .update({ status: "assigned" })
      .eq("id", taskInstanceId)

    if (upErr) {
      setError(upErr.message)
      setSavingAssign(false)
      return
    }

    setSavingAssign(false)
    setAssigningId(null)
    setAssignTo("")
    await load()
  }

  const verify = async (taskInstanceId: string) => {
    setSavingVerify(taskInstanceId)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError("Not signed in.")
      setSavingVerify(null)
      return
    }

    const { error: insErr } = await supabase.from("task_verifications").insert({
      task_instance_id: taskInstanceId,
      verified_by: user.id,
    })

    if (insErr) {
      setError(insErr.message)
      setSavingVerify(null)
      return
    }

    const { error: upErr } = await supabase
      .from("task_instances")
      .update({ status: "verified" })
      .eq("id", taskInstanceId)

    if (upErr) {
      setError(upErr.message)
      setSavingVerify(null)
      return
    }

    setSavingVerify(null)
    await load()
  }

  if (loading || roleLoading) return <div className="screen">Loading…</div>

  if (!yacht) {
    return (
      <div className="screen">
        <div className="screen-title">Yacht</div>
        <div style={{ opacity: 0.75, fontSize: 13 }}>
          Not found (or not visible for this account).
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          marginTop: -6,
        }}
      >
        <button type="button" onClick={() => navigate(-1)} className="primary-button">
          ← Back
        </button>

        <button
          type="button"
          className="primary-button"
          onClick={() => navigate("/tasks")}
        >
          My tasks
        </button>
      </div>

      <hr />

      <div className="screen-title" style={{ marginBottom: 6 }}>
        {yacht.name}
      </div>
      <div className="screen-subtitle">Operational tasks for this yacht.</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {canCreateInstances ? (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Create task instance</div>
          <label>Task:</label>
          <select
            value={newTemplateId}
            onChange={(e) => setNewTemplateId(e.target.value)}
            style={{ marginBottom: 12 }}
            disabled={creating}
          >
            <option value="">Select a task…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <label>Due at (optional):</label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            style={{ marginBottom: 12 }}
            disabled={creating}
          />

          <button
            type="button"
            className="cta-button"
            onClick={createInstance}
            disabled={creating || !newTemplateId}
            style={{ opacity: creating || !newTemplateId ? 0.6 : 1 }}
          >
            {creating ? "Creating…" : "Create instance"}
          </button>
        </div>
      ) : null}

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Tasks</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{instances.length}</div>
        </div>

        {instances.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>
            No tasks.
          </div>
        ) : (
          instances.map((t) => {
            const a = assignments.get(t.id)
            const showAssign = canAssign && t.status === "pending"
            const showVerify = canVerify && t.status === "completed"

            return (
              <div key={t.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <button
                  type="button"
                  className="list-button"
                  onClick={() => navigate(`/tasks/${t.id}`)}
                >
                  <div className="list-button-main">
                    <div className="list-button-title" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span>{t.template_name}</span>
                      <StatusPill status={t.status} />
                    </div>
                    <div className="list-button-subtitle">
                      {t.due_at ? `Due ${new Date(t.due_at).toLocaleDateString()}` : "No due date"}
                      {a ? ` · Assigned` : ""}
                    </div>
                  </div>
                  <div className="list-button-chevron">›</div>
                </button>

                {showAssign ? (
                  <div style={{ padding: "0 12px 12px" }}>
                    {assigningId !== t.id ? (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setAssigningId(t.id)
                          setAssignTo("")
                        }}
                      >
                        Assign
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select
                          value={assignTo}
                          onChange={(e) => setAssignTo(e.target.value)}
                          disabled={savingAssign}
                        >
                          <option value="">Select assignee…</option>
                          {assignees.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.display_name || u.email || "Unnamed user"}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => assign(t.id)}
                          disabled={savingAssign || !assignTo}
                          style={{ opacity: savingAssign || !assignTo ? 0.6 : 1 }}
                        >
                          {savingAssign ? "Assigning…" : "Assign"}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setAssigningId(null)
                            setAssignTo("")
                          }}
                          disabled={savingAssign}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                {showVerify ? (
                  <div style={{ padding: "0 12px 12px" }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => verify(t.id)}
                      disabled={savingVerify === t.id}
                      style={{ opacity: savingVerify === t.id ? 0.6 : 1 }}
                    >
                      {savingVerify === t.id ? "Verifying…" : "Verify"}
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

