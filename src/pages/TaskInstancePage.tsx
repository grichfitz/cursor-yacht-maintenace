import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useMyRole } from "../hooks/useMyRole"
import { useFocusReload } from "../hooks/useFocusReload"
import { useSession } from "../auth/SessionProvider"

type TaskInstanceRow = {
  id: string
  yacht_id: string
  status: "open" | "pending_review" | "approved"
  due_date: string | null
  title: string
  description: string | null
  owner_user_id: string | null
}

type YachtRow = {
  id: string
  name: string
  group_id: string
  archived_at: string | null
}

export default function TaskInstancePage() {
  const { taskInstanceId } = useParams<{ taskInstanceId: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const { role, loading: roleLoading } = useMyRole()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [row, setRow] = useState<TaskInstanceRow | null>(null)
  const [yacht, setYacht] = useState<YachtRow | null>(null)
  const [assignedToMe, setAssignedToMe] = useState(false)

  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const canComplete = useMemo(() => {
    // v1 "assigned" => v2 status=open AND owner_user_id = me
    return role === "crew" && assignedToMe && row?.status === "open"
  }, [role, assignedToMe, row?.status])

  const canVerify = useMemo(() => {
    // v1 "completed" => v2 pending_review
    return (role === "admin" || role === "manager") && row?.status === "pending_review"
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
      setYacht(null)
      setLoading(false)
      return
    }

    const { data, error: loadErr } = await supabase
      .from("yacht_tasks")
      .select("id,yacht_id,status,due_date,title,description,owner_user_id")
      .eq("id", taskInstanceId)
      .single()

    if (loadErr) {
      setError(loadErr.message)
      setRow(null)
      setYacht(null)
      setLoading(false)
      return
    }

    // Load the yacht for context (name/make/location).
    const { data: yRow, error: yErr } = await supabase
      .from("yachts")
      .select("id,name,group_id,archived_at")
      .eq("id", (data as TaskInstanceRow).yacht_id)
      .maybeSingle()

    if (!yErr) {
      setYacht((yRow as YachtRow) ?? null)
    } else {
      setYacht(null)
    }

    setRow(data as TaskInstanceRow)
    setAssignedToMe(((data as TaskInstanceRow)?.owner_user_id ?? null) === user.id)
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

    const { error: rpcErr } = await supabase.rpc("complete_yacht_task", {
      p_task_id: taskInstanceId,
    })

    if (rpcErr) {
      setError(rpcErr.message)
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

    const { error: rpcErr } = await supabase.rpc("approve_yacht_task", {
      p_task_id: taskInstanceId,
    })

    if (rpcErr) {
      setError(rpcErr.message)
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
            {row.title}
          </div>

          {row.description ? (
            <div className="screen-subtitle" style={{ marginBottom: 10 }}>
              {row.description}
            </div>
          ) : null}

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Yacht</div>
            {yacht ? (
              <button
                type="button"
                className="list-button"
                onClick={() => navigate(`/yachts/${yacht.id}`)}
              >
                <div className="list-button-main">
                  <div className="list-button-title">{yacht.name}</div>
                  <div className="list-button-subtitle">
                    {"—"}
                  </div>
                </div>
                <div className="list-button-chevron">›</div>
              </button>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.75 }}>—</div>
            )}
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Status</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>{row.status}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Due</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  {row.due_date ? new Date(row.due_date).toLocaleString() : "—"}
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

