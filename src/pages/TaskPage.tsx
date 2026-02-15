import React, { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useFocusReload } from "../hooks/useFocusReload"
import { useSession } from "../auth/SessionProvider"
import { loadAccessibleYachtIds } from "../utils/taskAccess"

type TaskRow = {
  id: string
  title: string
  status: string
  yacht_id: string
  category_id: string | null
  due_date: string | null
  template_id: string | null
}

type YachtRow = { id: string; name: string }

export default function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { session } = useSession()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [task, setTask] = useState<TaskRow | null>(null)
  const [yacht, setYacht] = useState<YachtRow | null>(null)

  const load = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => setLoading(false), 1500)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setTask(null)
        setYacht(null)
        setLoading(false)
        return
      }

      const yachtIds = await loadAccessibleYachtIds(user.id)
      if (yachtIds.length === 0) {
        setTask(null)
        setYacht(null)
        setLoading(false)
        return
      }

      const { data: t, error: tErr } = await supabase
        .from("tasks")
        .select("id,title,status,yacht_id,category_id,due_date,template_id")
        .eq("id", taskId)
        .in("yacht_id", yachtIds)
        .maybeSingle()

      if (tErr) {
        setError(tErr.message)
        setTask(null)
        setYacht(null)
        setLoading(false)
        return
      }

      const row = (t as TaskRow | null) ?? null
      setTask(row)

      if (!row?.yacht_id) {
        setYacht(null)
        setLoading(false)
        return
      }

      const { data: y, error: yErr } = await supabase
        .from("yachts")
        .select("id,name")
        .eq("id", row.yacht_id)
        .maybeSingle()

      if (!yErr) setYacht((y as YachtRow) ?? null)
      else setYacht(null)

      setLoading(false)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }, [taskId])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await load()
    }

    run()
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") run()
    })

    return () => {
      cancelled = true
      sub.data.subscription.unsubscribe()
    }
  }, [session, load])

  useFocusReload(() => {
    void load()
  }, true)

  if (!taskId) return null
  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, marginTop: -6 }}>
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

      {!task ? (
        <div style={{ opacity: 0.75, fontSize: 13 }}>Task not found (or not visible).</div>
      ) : (
        <>
          <div className="screen-title" style={{ marginBottom: 8 }}>
            {task.title}
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Yacht</div>
            {yacht ? (
              <button type="button" className="list-button" onClick={() => navigate(`/yachts/${yacht.id}`)}>
                <div className="list-button-main">
                  <div className="list-button-title">{yacht.name}</div>
                </div>
                <div className="list-button-chevron">›</div>
              </button>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.75 }}>{task.yacht_id}</div>
            )}
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Status</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>{task.status}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Due</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  {task.due_date ? new Date(task.due_date).toLocaleString() : "—"}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

