import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BarChart2, CheckSquare, Ship, Wrench } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useMyRole } from "../hooks/useMyRole"
import { useSession } from "../auth/SessionProvider"

type IncidentRow = {
  id: string
  yacht_id: string
  status: string
  due_date: string
  assignment_id: string
}

function StatusPill({ status }: { status: string }) {
  const cfg = useMemo(() => {
    const pretty = status ? status.replace(/_/g, " ") : "Unknown"
    const label = pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : "Unknown"
    return { bg: "rgba(110,110,115,0.12)", fg: "rgba(60,60,67,0.95)", label }
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
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { role, loading: roleLoading } = useMyRole()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [countsByStatus, setCountsByStatus] = useState<Array<{ status: string; count: number }>>([])
  const [upcoming, setUpcoming] = useState<IncidentRow[]>([])
  const [overdue, setOverdue] = useState<IncidentRow[]>([])
  const [yachtNameById, setYachtNameById] = useState<Map<string, string>>(new Map())
  const [assignmentNameById, setAssignmentNameById] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      const timeoutId = window.setTimeout(() => {
        if (!cancelled) setLoading(false)
      }, 1500)

      try {
        const today = new Date().toISOString().slice(0, 10)

        const [countRes, overdueRes, upcomingRes] = await Promise.all([
          supabase.from("task_incidents").select("id,status,yacht_id,assignment_id").limit(5000),
          supabase
            .from("task_incidents")
            .select("id,assignment_id,status,yacht_id,due_date")
            .lt("due_date", today)
            .eq("status", "pending")
            .order("due_date", { ascending: true })
            .limit(8),
          supabase
            .from("task_incidents")
            .select("id,assignment_id,status,yacht_id,due_date")
            .gte("due_date", today)
            .eq("status", "pending")
            .order("due_date", { ascending: true })
            .limit(8),
        ])

        const firstErr = countRes.error || overdueRes.error || upcomingRes.error
        if (firstErr) throw firstErr

        const countsMap = new Map<string, number>()
        ;(((countRes.data as any[]) ?? []) as any[]).forEach((r) => {
          const status = String(r?.status ?? "")
          if (!status) return
          countsMap.set(status, (countsMap.get(status) ?? 0) + 1)
        })

        const sortedCounts = Array.from(countsMap.entries())
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status))

        const overdueList = ((overdueRes.data as any[]) ?? []) as IncidentRow[]
        const upcomingList = ((upcomingRes.data as any[]) ?? []) as IncidentRow[]

        const uniqYachtIds = Array.from(new Set([...overdueList, ...upcomingList].map((i) => i.yacht_id).filter(Boolean)))
        const uniqAssignmentIds = Array.from(new Set([...overdueList, ...upcomingList].map((i) => i.assignment_id).filter(Boolean)))

        const [yRes, aRes] = await Promise.all([
          uniqYachtIds.length ? supabase.from("yachts").select("id,name").in("id", uniqYachtIds).limit(5000) : Promise.resolve({ data: [], error: null } as any),
          uniqAssignmentIds.length ? supabase.from("task_assignments").select("id,name").in("id", uniqAssignmentIds).limit(5000) : Promise.resolve({ data: [], error: null } as any),
        ])

        const yMap = new Map<string, string>()
        if (!yRes.error) {
          ;(((yRes.data as any[]) ?? []) as any[]).forEach((y) => yMap.set(String(y.id), String(y.name ?? "")))
        }
        const aMap = new Map<string, string>()
        if (!aRes.error) {
          ;(((aRes.data as any[]) ?? []) as any[]).forEach((a) => aMap.set(String(a.id), String(a.name ?? "")))
        }

        if (!cancelled) {
          setCountsByStatus(sortedCounts)
          setOverdue(overdueList)
          setUpcoming(upcomingList)
          setYachtNameById(yMap)
          setAssignmentNameById(aMap)
          setLoading(false)
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load dashboard.")
          setLoading(false)
        }
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    load()
    const sub = supabase.auth.onAuthStateChange((event) => {
      // Avoid resume lag: token refresh fires on app resume; don't flip UI back to loading.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load()
      }
    })

    return () => {
      cancelled = true
      sub.data.subscription.unsubscribe()
    }
  }, [session])

  if (loading || roleLoading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <div className="screen-title">Dashboard</div>

      <div className="card">
        <div className="quicklinks-grid">
          <button type="button" className="quicklink" onClick={() => navigate("/tasks")}>
            <div className="quicklink-icon" aria-hidden="true">
              <CheckSquare size={22} />
            </div>
            <div className="quicklink-label">Tasks</div>
          </button>

          <button type="button" className="quicklink" onClick={() => navigate("/yachts")}>
            <div className="quicklink-icon" aria-hidden="true">
              <Ship size={22} />
            </div>
            <div className="quicklink-label">Yachts</div>
          </button>

          {(role === "manager" || role === "admin") && (
            <button type="button" className="quicklink" onClick={() => navigate("/reports")}>
              <div className="quicklink-icon" aria-hidden="true">
                <BarChart2 size={22} />
              </div>
              <div className="quicklink-label">Reports</div>
            </button>
          )}

          {(role === "admin" || role === "manager") && (
            <button type="button" className="quicklink" onClick={() => navigate("/editor")}>
              <div className="quicklink-icon" aria-hidden="true">
                <Wrench size={22} />
              </div>
              <div className="quicklink-label">Editor</div>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(255,0,0,0.08)",
            border: "1px solid rgba(255,0,0,0.2)",
            color: "var(--text-primary)",
            padding: "10px 12px",
            borderRadius: 12,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Task counts (by status)</div>
        {countsByStatus.length === 0 ? (
          <div style={{ padding: 2, fontSize: 13, opacity: 0.75 }}>No tasks.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {countsByStatus.slice(0, 6).map((s) => (
              <div
                key={s.status}
                style={{
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 14,
                  padding: 10,
                  background: "rgba(255,255,255,0.7)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <StatusPill status={s.status} />
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{s.count}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700 }}>Upcoming</div>
          <button className="secondary" type="button" onClick={() => navigate("/tasks")}>
            View
          </button>
        </div>

        {upcoming.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No upcoming tasks.</div>
        ) : (
          upcoming.map((t) => (
            <button
              key={t.id}
              type="button"
              className="list-button"
              onClick={() => navigate(`/yachts/${t.yacht_id}/tasks`)}
            >
              <div className="list-button-main">
                <div className="list-button-title">{assignmentNameById.get(t.assignment_id) || t.assignment_id}</div>
                <div className="list-button-subtitle">
                  {`Due ${new Date(t.due_date).toLocaleDateString()}`} · {yachtNameById.get(t.yacht_id) || t.yacht_id}
                </div>
              </div>
              <div className="list-button-chevron">›</div>
            </button>
          ))
        )}
      </div>

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700 }}>Overdue</div>
          <button className="secondary" type="button" onClick={() => navigate("/tasks")}>
            View
          </button>
        </div>

        {overdue.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No overdue tasks.</div>
        ) : (
          overdue.map((t) => (
            <button
              key={t.id}
              type="button"
              className="list-button"
              onClick={() => navigate(`/yachts/${t.yacht_id}/tasks`)}
            >
              <div className="list-button-main">
                <div className="list-button-title">{assignmentNameById.get(t.assignment_id) || t.assignment_id}</div>
                <div className="list-button-subtitle">
                  {`Due ${new Date(t.due_date).toLocaleDateString()}`} · {yachtNameById.get(t.yacht_id) || t.yacht_id}
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

