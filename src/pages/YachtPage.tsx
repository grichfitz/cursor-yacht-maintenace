import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useMyRole } from "../hooks/useMyRole"
import { useSession } from "../auth/SessionProvider"

type YachtRow = {
  id: string
  name: string
  group_id: string
  archived_at: string | null
}

type TaskInstanceRow = {
  id: string
  yacht_id: string
  status: "open" | "pending_review" | "approved"
  due_date: string | null
  title: string
  owner_user_id: string | null
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
  task_id: string
  assigned_to: string
  assigned_at: string
}

function StatusPill({ status }: { status: TaskInstanceRow["status"] | string | null | undefined }) {
  const cfg = useMemo(() => {
    switch (status) {
      case "open":
        return { bg: "rgba(110,110,115,0.12)", fg: "rgba(60,60,67,0.95)", label: "Pending" }
      case "pending_review":
        return { bg: "rgba(52,199,89,0.14)", fg: "rgba(28,110,50,1)", label: "Completed" }
      case "approved":
        return { bg: "rgba(34,199,184,0.16)", fg: "rgba(10,140,130,1)", label: "Approved" }
      default: {
        const raw = typeof status === "string" ? status : ""
        const pretty = raw ? raw.replace(/_/g, " ") : "Unknown"
        const label = pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : "Unknown"
        return { bg: "rgba(110,110,115,0.12)", fg: "rgba(60,60,67,0.95)", label }
      }
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
      {cfg.label}
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

  // Manager/Admin: assignees limited to yacht's group members
  const [assignees, setAssignees] = useState<UserRow[]>([])
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assignTo, setAssignTo] = useState<string>("")
  const [savingAssign, setSavingAssign] = useState(false)
  const [savingVerify, setSavingVerify] = useState<string | null>(null)
  const [takingId, setTakingId] = useState<string | null>(null)

  const canAssign = role === "admin" || role === "manager"
  const canVerify = role === "admin" || role === "manager"

  const load = async () => {
    if (!yachtId) return
    setLoading(true)
    setError(null)

    // YM v2 finalization: rely on RLS for data scoping (no frontend role-based filtering).
    const { data: yachtRow, error: yErr } = await supabase
      .from("yachts")
      .select("id,name,group_id,archived_at")
      .eq("id", yachtId)
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

    const { data: taskRows, error: tErr } = await supabase
      .from("yacht_tasks")
      .select("id,yacht_id,status,due_date,title,owner_user_id")
      .eq("yacht_id", yachtId)
      .order("due_date", { ascending: true, nullsFirst: false })
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

    // v1 "assigned" status is now represented by owner_user_id on yacht_tasks.
    if (instanceIds.length > 0) {
      ;((taskRows as TaskInstanceRow[]) ?? []).forEach((t) => {
        if (t.owner_user_id) {
          assignmentMap.set(t.id, { task_id: t.id, assigned_to: t.owner_user_id, assigned_at: "" })
        }
      })
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

      // YM v2: no public.users directory table. Keep the assign dropdown functional using IDs only.
      if (cancelled) return
      setAssignees(ids.map((id) => ({ id, display_name: null, email: null })))
    }

    loadAssigneesIfManager()

    return () => {
      cancelled = true
    }
  }, [canAssign, yacht?.group_id, session])

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

    const { error: upErr } = await supabase
      .from("yacht_tasks")
      // v1 "assigned" => v2 owner_user_id is set (status stays open)
      .update({ status: "open", owner_user_id: assignTo })
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

  const takeOwnership = async (taskInstanceId: string) => {
    setTakingId(taskInstanceId)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError("Not signed in.")
      setTakingId(null)
      return
    }

    const { error: upErr } = await supabase
      .from("yacht_tasks")
      // v1 "assigned" => v2 owner_user_id is set (status stays open)
      .update({ status: "open", owner_user_id: user.id })
      .eq("id", taskInstanceId)

    if (upErr) {
      setError(upErr.message)
      setTakingId(null)
      return
    }

    setTakingId(null)
    await load()
  }

  const verify = async (taskInstanceId: string) => {
    setSavingVerify(taskInstanceId)
    setError(null)

    const { error: rpcErr } = await supabase.rpc("approve_yacht_task", {
      p_task_id: taskInstanceId,
    })

    if (rpcErr) {
      setError(rpcErr.message)
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

  const yachtPhotoUrl: string | null = null
  const yachtMakeModel: string | null = null
  const yachtLocation: string | null = null
  const yachtEngineerHours: number | null = null

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

      <div className="card" style={{ paddingBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Yacht info</div>
        {yachtPhotoUrl ? (
          <img
            src={yachtPhotoUrl}
            alt=""
            style={{
              width: "100%",
              height: 160,
              objectFit: "cover",
              borderRadius: 14,
              border: "1px solid var(--border-subtle)",
              marginBottom: 10,
            }}
          />
        ) : null}
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          <div>
            <strong style={{ color: "var(--text-primary)" }}>Make / model:</strong>{" "}
            {yachtMakeModel || "—"}
          </div>
          <div>
            <strong style={{ color: "var(--text-primary)" }}>Location:</strong>{" "}
            {yachtLocation || "—"}
          </div>
          {typeof yachtEngineerHours === "number" ? (
            <div>
              <strong style={{ color: "var(--text-primary)" }}>Engineer hours:</strong>{" "}
              {yachtEngineerHours}
            </div>
          ) : null}
        </div>
      </div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

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
            const unownedOpen = t.status === "open" && !t.owner_user_id
            const showAssign = canAssign && unownedOpen
            const showVerify = canVerify && t.status === "pending_review"
            const showTake = role === "crew" && unownedOpen

            return (
              <div key={t.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <button
                  type="button"
                  className="list-button"
                  onClick={() => navigate(`/tasks/${t.id}`)}
                >
                  <div className="list-button-main">
                    <div className="list-button-title" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span>{t.title}</span>
                      <StatusPill status={t.status} />
                    </div>
                    <div className="list-button-subtitle">
                      {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : "No due date"}
                      {t.owner_user_id || a ? ` · Assigned` : ""}
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

                {showTake ? (
                  <div style={{ padding: "0 12px 12px" }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => takeOwnership(t.id)}
                      disabled={takingId === t.id}
                      style={{ opacity: takingId === t.id ? 0.6 : 1 }}
                    >
                      {takingId === t.id ? "Taking…" : "Take"}
                    </button>
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

