import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useMyRole } from "../hooks/useMyRole"
import { useFocusReload } from "../hooks/useFocusReload"
import { useSession } from "../auth/SessionProvider"

type TaskInstanceRow = {
  id: string
  yacht_id: string
  status: "pending" | "assigned" | "completed" | "verified"
  due_at: string | null
  template_name: string
  template_description: string | null
}

type AssignmentRow = {
  task_instance_id: string
  assigned_to: string
}

export default function TaskInstancePage() {
  const { taskInstanceId } = useParams<{ taskInstanceId: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const { role, loading: roleLoading } = useMyRole()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [row, setRow] = useState<TaskInstanceRow | null>(null)
  const [assignedToMe, setAssignedToMe] = useState(false)

  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const canComplete = useMemo(() => {
    return role === "crew" && assignedToMe && row?.status === "assigned"
  }, [role, assignedToMe, row?.status])

  const canVerify = useMemo(() => {
    return (role === "admin" || role === "manager") && row?.status === "completed"
  }, [role, row?.status])

  const load = useCallback(async () => {
    if (!taskInstanceId) return
    setLoading(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setRow(null)
      setLoading(false)
      return
    }

    const { data, error: loadErr } = await supabase
      .from("task_instances")
      .select("id,yacht_id,status,due_at,template_name,template_description")
      .eq("id", taskInstanceId)
      .single()

    if (loadErr) {
      setError(loadErr.message)
      setRow(null)
      setLoading(false)
      return
    }

    const { data: assignmentRows, error: aErr } = await supabase
      .from("task_assignments")
      .select("task_instance_id,assigned_to")
      .eq("task_instance_id", taskInstanceId)
      .limit(1)

    if (aErr) {
      setError(aErr.message)
      setRow(data as TaskInstanceRow)
      setAssignedToMe(false)
      setLoading(false)
      return
    }

    const assignedTo =
      ((assignmentRows as AssignmentRow[] | null) ?? [])[0]?.assigned_to ?? null

    setRow(data as TaskInstanceRow)
    setAssignedToMe(assignedTo === user.id)
    setLoading(false)
  }, [taskInstanceId])

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
  }, [taskInstanceId, session])

  useFocusReload(() => {
    void load()
  }, true)

  const markCompleted = async () => {
    if (!taskInstanceId) return

    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError("Not signed in.")
      setSaving(false)
      return
    }

    const { error: insErr } = await supabase.from("task_completions").insert({
      task_instance_id: taskInstanceId,
      user_id: user.id,
      notes: notes.trim() ? notes.trim() : null,
    })

    if (insErr) {
      setError(insErr.message)
      setSaving(false)
      return
    }

    const { error: upErr } = await supabase
      .from("task_instances")
      .update({ status: "completed" })
      .eq("id", taskInstanceId)

    if (upErr) {
      setError(upErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    navigate("/tasks", { replace: true })
  }

  const verify = async () => {
    if (!taskInstanceId) return

    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError("Not signed in.")
      setSaving(false)
      return
    }

    const { error: insErr } = await supabase.from("task_verifications").insert({
      task_instance_id: taskInstanceId,
      verified_by: user.id,
    })

    if (insErr) {
      setError(insErr.message)
      setSaving(false)
      return
    }

    const { error: upErr } = await supabase
      .from("task_instances")
      .update({ status: "verified" })
      .eq("id", taskInstanceId)

    if (upErr) {
      setError(upErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    navigate(-1)
  }

  if (loading || roleLoading) return <div className="screen">Loading…</div>

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
      </div>

      <hr />

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {!row ? (
        <div style={{ opacity: 0.75, fontSize: 13 }}>Task not found (or not visible).</div>
      ) : (
        <>
          <div className="screen-title" style={{ marginBottom: 8 }}>
            {row.template_name}
          </div>

          {row.template_description ? (
            <div className="screen-subtitle" style={{ marginBottom: 10 }}>
              {row.template_description}
            </div>
          ) : null}

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Status</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>{row.status}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Due</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  {row.due_at ? new Date(row.due_at).toLocaleString() : "—"}
                </div>
              </div>
            </div>
          </div>

          {canComplete ? (
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Complete task</div>
              <label>Notes:</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{ marginBottom: 12 }}
                disabled={saving}
              />
              <button
                type="button"
                className="cta-button"
                onClick={markCompleted}
                disabled={saving}
                style={{ opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Saving…" : "Mark completed"}
              </button>
            </div>
          ) : null}

          {canVerify ? (
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Verification</div>
              <button
                type="button"
                className="cta-button"
                onClick={verify}
                disabled={saving}
                style={{ opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Verifying…" : "Verify task"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

