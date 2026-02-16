import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useFocusReload } from "../hooks/useFocusReload"
import { useSession } from "../auth/SessionProvider"
import { loadAccessibleYachtIds } from "../utils/taskAccess"

type TaskRow = {
  id: string
  yacht_id: string
  status: string
  due_date: string | null
  title: string
  category_id: string | null
  template_id: string | null
  assigned_to?: string | null
}

export default function TasksPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [yachtNameById, setYachtNameById] = useState<Map<string, string>>(new Map())

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
        setYachtNameById(new Map())
        setLoading(false)
        return
      }

      const yachtIds = await loadAccessibleYachtIds(user.id)

      const base = supabase
        .from("tasks")
        .select("id,title,status,yacht_id,category_id,due_date,template_id,assigned_to")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(500)

      const q =
        yachtIds.length === 0
          ? base.eq("assigned_to", user.id)
          : base.or(`yacht_id.in.(${yachtIds.join(",")}),assigned_to.eq.${user.id}`)

      const { data: rows, error: tErr } = await q

      if (tErr) {
        setError(tErr.message)
        setLoading(false)
        return
      }

      const list = (rows as TaskRow[]) ?? []
      setTasks(list)

      const uniqYachtIds = Array.from(new Set(list.map((t) => t.yacht_id).filter(Boolean)))
      if (uniqYachtIds.length > 0) {
        const { data: yachts, error: yErr } = await supabase.from("yachts").select("id,name").in("id", uniqYachtIds)
        if (!yErr) {
          const map = new Map<string, string>()
          ;((yachts as any[]) ?? []).forEach((y) => {
            if (y?.id) map.set(String(y.id), String(y.name ?? ""))
          })
          setYachtNameById(map)
        } else {
          setYachtNameById(new Map())
        }
      } else {
        setYachtNameById(new Map())
      }
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
      <div className="screen-title">Tasks</div>
      <div className="screen-subtitle">Tasks assigned to you, or visible to your groups.</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="card card-list">
        {byDue.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>
            No tasks.
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
                  {t.yacht_id ? ` · ${yachtNameById.get(t.yacht_id) || t.yacht_id}` : ""}
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

