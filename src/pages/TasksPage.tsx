import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useFocusReload } from "../hooks/useFocusReload"
import { useSession } from "../auth/SessionProvider"

type IncidentRow = {
  id: string
  assignment_id: string
  yacht_id: string
  due_date: string
  status: "pending" | "completed" | "cancelled"
  completed_by: string | null
  completed_at: string | null
  created_at: string
}

type YachtRow = { id: string; name: string }
type AssignmentRow = { id: string; name: string }

export default function TasksPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [incidents, setIncidents] = useState<IncidentRow[]>([])
  const [yachtNameById, setYachtNameById] = useState<Map<string, string>>(new Map())
  const [assignmentNameById, setAssignmentNameById] = useState<Map<string, string>>(new Map())

  const byDue = useMemo(() => {
    return [...incidents].sort((a, b) => {
      const ad = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY
      const bd = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY
      return ad - bd || a.created_at.localeCompare(b.created_at)
    })
  }, [incidents])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => setLoading(false), 1500)
    try {
      const { data, error: incErr } = await supabase
        .from("task_incidents")
        .select("id,assignment_id,yacht_id,due_date,status,completed_by,completed_at,created_at")
        .order("due_date", { ascending: true })
        .limit(500)

      if (incErr) throw incErr

      const list = ((data as any[]) ?? []) as IncidentRow[]
      setIncidents(list)

      const uniqYachtIds = Array.from(new Set(list.map((i) => i.yacht_id).filter(Boolean)))
      const uniqAssignmentIds = Array.from(new Set(list.map((i) => i.assignment_id).filter(Boolean)))

      const [yRes, aRes] = await Promise.all([
        uniqYachtIds.length
          ? supabase.from("yachts").select("id,name").in("id", uniqYachtIds).limit(5000)
          : Promise.resolve({ data: [], error: null } as any),
        uniqAssignmentIds.length
          ? supabase.from("task_assignments").select("id,name").in("id", uniqAssignmentIds).limit(5000)
          : Promise.resolve({ data: [], error: null } as any),
      ])

      if (yRes.error) setYachtNameById(new Map())
      else {
        const m = new Map<string, string>()
        ;(((yRes.data as any[]) ?? []) as YachtRow[]).forEach((y) => m.set(String(y.id), String(y.name ?? "")))
        setYachtNameById(m)
      }

      if (aRes.error) setAssignmentNameById(new Map())
      else {
        const m = new Map<string, string>()
        ;(((aRes.data as any[]) ?? []) as AssignmentRow[]).forEach((a) => m.set(String(a.id), String(a.name ?? "")))
        setAssignmentNameById(m)
      }

      setLoading(false)
    } catch (e: any) {
      setError(e?.message || "Failed to load incidents.")
      setIncidents([])
      setYachtNameById(new Map())
      setAssignmentNameById(new Map())
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
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") run()
    })
    return () => {
      cancelled = true
      sub.data.subscription.unsubscribe()
    }
  }, [session, load])

  useFocusReload(() => void load(), true)

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <div className="screen-title">My Tasks</div>
      <div className="screen-subtitle">Task incidents visible to this account (RLS-enforced).</div>

      {error ? (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      <div className="card card-list">
        {byDue.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No incidents.</div>
        ) : (
          byDue.map((i) => {
            const yachtName = yachtNameById.get(i.yacht_id) || i.yacht_id
            const assignmentName = assignmentNameById.get(i.assignment_id) || i.assignment_id
            return (
              <button
                key={i.id}
                type="button"
                className="list-button"
                onClick={() => navigate(`/yachts/${i.yacht_id}/tasks`)}
              >
                <div className="list-button-main">
                  <div className="list-button-title">{assignmentName}</div>
                  <div className="list-button-subtitle">
                    Due {new Date(i.due_date).toLocaleDateString()} · {i.status} · {yachtName}
                  </div>
                </div>
                <div className="list-button-chevron">›</div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

