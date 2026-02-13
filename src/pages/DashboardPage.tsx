import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useMyRole } from "../hooks/useMyRole"
import { useSession } from "../auth/SessionProvider"

type TaskInstanceRow = {
  id: string
  yacht_id: string
  status: "pending" | "assigned" | "completed" | "verified"
  due_at: string | null
  template_name: string
}

function StatusPill({ status }: { status: TaskInstanceRow["status"] }) {
  const cfg = useMemo(() => {
    switch (status) {
      case "pending":
        return { bg: "rgba(110,110,115,0.12)", fg: "rgba(60,60,67,0.95)", label: "Pending" }
      case "assigned":
        return { bg: "rgba(10,132,255,0.14)", fg: "rgba(10,132,255,0.95)", label: "Assigned" }
      case "completed":
        return { bg: "rgba(52,199,89,0.14)", fg: "rgba(28,110,50,1)", label: "Completed" }
      case "verified":
        return { bg: "rgba(34,199,184,0.16)", fg: "rgba(10,140,130,1)", label: "Verified" }
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

  const [counts, setCounts] = useState<Record<string, number>>({
    pending: 0,
    assigned: 0,
    completed: 0,
    verified: 0,
  })

  const [assigned, setAssigned] = useState<TaskInstanceRow[]>([])
  const [overdue, setOverdue] = useState<TaskInstanceRow[]>([])

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const countStatus = async (status: TaskInstanceRow["status"]) => {
      const { count, error: cErr } = await supabase
        .from("task_instances")
        .select("id", { count: "exact", head: true })
        .eq("status", status)
      if (cErr) throw cErr
      return count ?? 0
    }

    const load = async () => {
      setLoading(true)
      setError(null)

      const timeoutId = window.setTimeout(() => {
        if (!cancelled) setLoading(false)
      }, 1500)

      try {
        const [pending, assignedC, completed, verified] = await Promise.all([
          countStatus("pending"),
          countStatus("assigned"),
          countStatus("completed"),
          countStatus("verified"),
        ])

        const nowIso = new Date().toISOString()

        const { data: assignedRows, error: aErr } = await supabase
          .from("task_instances")
          .select("id,yacht_id,status,due_at,template_name")
          .eq("status", "assigned")
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(8)

        if (aErr) throw aErr

        const { data: overdueRows, error: oErr } = await supabase
          .from("task_instances")
          .select("id,yacht_id,status,due_at,template_name")
          .lt("due_at", nowIso)
          .neq("status", "verified")
          .order("due_at", { ascending: true })
          .limit(8)

        if (oErr) throw oErr

        if (!cancelled) {
          setCounts({ pending, assigned: assignedC, completed, verified })
          setAssigned((assignedRows as TaskInstanceRow[]) ?? [])
          setOverdue((overdueRows as TaskInstanceRow[]) ?? [])
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
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Quick links</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="secondary" onClick={() => navigate("/tasks")}>
            Tasks
          </button>
          <button type="button" className="secondary" onClick={() => navigate("/yachts")}>
            Yachts
          </button>
          {(role === "manager" || role === "admin") && (
            <button type="button" className="secondary" onClick={() => navigate("/reports")}>
              Reports
            </button>
          )}
          {role === "admin" && (
            <button type="button" className="secondary" onClick={() => navigate("/editor")}>
              Editor
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
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Task counts</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {(["pending", "assigned", "completed", "verified"] as const).map((s) => (
            <div
              key={s}
              style={{
                border: "1px solid var(--border-subtle)",
                borderRadius: 14,
                padding: 10,
                background: "rgba(255,255,255,0.7)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <StatusPill status={s} />
                <div style={{ fontSize: 18, fontWeight: 800 }}>{counts[s]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700 }}>Assigned</div>
          <button className="secondary" type="button" onClick={() => navigate("/tasks")}>
            View
          </button>
        </div>

        {assigned.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No assigned tasks.</div>
        ) : (
          assigned.map((t) => (
            <button
              key={t.id}
              type="button"
              className="list-button"
              onClick={() => navigate(`/tasks/${t.id}`)}
            >
              <div className="list-button-main">
                <div className="list-button-title">{t.template_name}</div>
                <div className="list-button-subtitle">
                  {t.due_at ? `Due ${new Date(t.due_at).toLocaleDateString()}` : "No due date"}
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
                <div className="list-button-title">{t.template_name}</div>
                <div className="list-button-subtitle">
                  {t.due_at ? `Due ${new Date(t.due_at).toLocaleDateString()}` : "No due date"}
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

