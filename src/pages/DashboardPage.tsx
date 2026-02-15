import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BarChart2, CheckSquare, Ship, Wrench } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useMyRole } from "../hooks/useMyRole"
import { useSession } from "../auth/SessionProvider"

type YachtTaskRow = {
  id: string
  yacht_id: string
  status: "open" | "pending_review" | "approved"
  due_date: string | null
  title: string
  owner_user_id?: string | null
}

type DashboardCountKey = "open" | "pending_review" | "approved" | "assigned_to_me"

function StatusPill({ status }: { status: DashboardCountKey }) {
  const cfg = useMemo(() => {
    switch (status) {
      case "open":
        return { bg: "rgba(110,110,115,0.12)", fg: "rgba(60,60,67,0.95)", label: "Open" }
      case "assigned_to_me":
        return { bg: "rgba(10,132,255,0.14)", fg: "rgba(10,132,255,0.95)", label: "Assigned to me" }
      case "pending_review":
        return { bg: "rgba(52,199,89,0.14)", fg: "rgba(28,110,50,1)", label: "Pending review" }
      case "approved":
        return { bg: "rgba(34,199,184,0.16)", fg: "rgba(10,140,130,1)", label: "Approved" }
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

  const [counts, setCounts] = useState<Record<DashboardCountKey, number>>({
    open: 0,
    assigned_to_me: 0,
    pending_review: 0,
    approved: 0,
  })

  const [assigned, setAssigned] = useState<YachtTaskRow[]>([])
  const [overdue, setOverdue] = useState<YachtTaskRow[]>([])

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const countStatus = async (status: YachtTaskRow["status"]) => {
      let q = supabase.from("yacht_tasks").select("id", { count: "exact", head: true })
      q = q.eq("status", status)

      const { count, error: cErr } = await q
      if (cErr) throw cErr
      return count ?? 0
    }

    const countAssignedToMe = async () => {
      const { count, error: cErr } = await supabase
        .from("yacht_tasks")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("owner_user_id", session.user.id)
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
        const [openC, assignedToMeC, pendingReviewC, approvedC] = await Promise.all([
          countStatus("open"),
          countAssignedToMe(),
          countStatus("pending_review"),
          countStatus("approved"),
        ])

        const nowIso = new Date().toISOString()

        const { data: assignedRows, error: aErr } = await supabase
          .from("yacht_tasks")
          .select("id,yacht_id,status,due_date,title")
          .eq("status", "open")
          .eq("owner_user_id", session.user.id)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(8)

        if (aErr) throw aErr

        const { data: overdueRows, error: oErr } = await supabase
          .from("yacht_tasks")
          .select("id,yacht_id,status,due_date,title")
          .lt("due_date", nowIso)
          .neq("status", "approved")
          .order("due_date", { ascending: true })
          .limit(8)

        if (oErr) throw oErr

        if (!cancelled) {
          setCounts({
            open: openC,
            assigned_to_me: assignedToMeC,
            pending_review: pendingReviewC,
            approved: approvedC,
          })
          setAssigned((assignedRows as YachtTaskRow[]) ?? [])
          setOverdue((overdueRows as YachtTaskRow[]) ?? [])
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
            <div className="quicklink-label">My Tasks</div>
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

          {role === "admin" && (
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
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Task counts</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {(["open", "assigned_to_me", "pending_review", "approved"] as const).map((s) => (
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

