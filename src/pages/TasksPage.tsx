import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useFocusReload } from "../hooks/useFocusReload"
import { useSession } from "../auth/SessionProvider"

type TaskInstanceRow = {
  id: string
  yacht_id: string
  status: "open" | "pending_review" | "approved"
  due_date: string | null
  title: string
  owner_user_id: string | null
}

export default function TasksPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<TaskInstanceRow[]>([])

  const byDue = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const ad = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY
      const bd = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY
      return ad - bd
    })
  }, [tasks])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => {
      setLoading(false)
    }, 1500)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setTasks([])
        setLoading(false)
        return
      }

      // v1 "assigned" => v2 status=open AND owner_user_id = me
      const { data: instances, error: iErr } = await supabase
        .from("yacht_tasks")
        .select("id,yacht_id,status,due_date,title,owner_user_id")
        .eq("status", "open")
        .eq("owner_user_id", user.id)

      if (iErr) {
        setError(iErr.message)
        setLoading(false)
        return
      }

      setTasks((instances as TaskInstanceRow[]) ?? [])
      setLoading(false)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }, [])

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
  }, [session])

  useFocusReload(() => {
    void load()
  }, true)

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <div className="screen-title">My Tasks</div>
      <div className="screen-subtitle">Only tasks assigned to you.</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="card card-list">
        {byDue.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>
            No assigned tasks.
          </div>
        ) : (
          byDue.map((t) => (
            <button
              key={t.id}
              type="button"
              className="list-button"
              onClick={() => navigate(`/tasks/${t.id}`)}
            >
              <div className="list-button-main">
                <div className="list-button-title">{t.title}</div>
                <div className="list-button-subtitle">
                  {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : "No due date"} ·{" "}
                  {t.status}
                </div>
              </div>
              <div className="list-button-chevron">›</div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

