import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BarChart2, CheckSquare, Ship, Wrench } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useMyRole } from "../hooks/useMyRole"
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
  const [upcoming, setUpcoming] = useState<TaskRow[]>([])
  const [overdue, setOverdue] = useState<TaskRow[]>([])

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
        const yachtIds = await loadAccessibleYachtIds(session.user.id)
        if (yachtIds.length === 0) {
          setCountsByStatus([])
          setUpcoming([])
          setOverdue([])
          setLoading(false)
          return
        }

        const nowIso = new Date().toISOString()

        const [{ data: countRows, error: cErr }, { data: overdueRows, error: oErr }, { data: upcomingRows, error: uErr }] =
          await Promise.all([
            supabase.from("tasks").select("id,status,yacht_id").in("yacht_id", yachtIds).limit(2000),
            supabase
              .from("tasks")
              .select("id,title,status,yacht_id,category_id,due_date,template_id")
              .in("yacht_id", yachtIds)
              .lt("due_date", nowIso)
              .order("due_date", { ascending: true })
              .limit(8),
            supabase
              .from("tasks")
              .select("id,title,status,yacht_id,category_id,due_date,template_id")
              .in("yacht_id", yachtIds)
              .gte("due_date", nowIso)
              .order("due_date", { ascending: true })
              .limit(8),
          ])

        const firstErr = cErr || oErr || uErr
        if (firstErr) throw firstErr

        const countsMap = new Map<string, number>()
        ;((countRows as any[]) ?? []).forEach((r) => {
          const status = String(r?.status ?? "")
          if (!status) return
          countsMap.set(status, (countsMap.get(status) ?? 0) + 1)
        })

        const sortedCounts = Array.from(countsMap.entries())
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status))

        if (!cancelled) {
          setCountsByStatus(sortedCounts)
          setOverdue((overdueRows as TaskRow[]) ?? [])
          setUpcoming((upcomingRows as TaskRow[]) ?? [])
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
              onClick={() => navigate(`/tasks/${t.id}`)}
            >
              <div className="list-button-main">
                <div className="list-button-title">{t.title}</div>
                <div className="list-button-subtitle">
                  {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : "No due date"}
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
              onClick={() => navigate(`/tasks/${t.id}`)}
            >
              <div className="list-button-main">
                <div className="list-button-title">{t.title}</div>
                <div className="list-button-subtitle">
                  {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : "No due date"}
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

