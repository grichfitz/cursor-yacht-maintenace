import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"
import { useMyRole } from "../hooks/useMyRole"

type YachtRow = {
  id: string
  name: string
  group_id: string
  archived_at: string | null
}

type IncidentRow = {
  id: string
  yacht_id: string
  status: string
  due_date: string
  assignment_id: string
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const cfg = useMemo(() => {
    const raw = typeof status === "string" ? status : ""
    const pretty = raw ? raw.replace(/_/g, " ") : "Unknown"
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
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  )
}

export default function YachtPage() {
  const { yachtId } = useParams<{ yachtId: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const { role } = useMyRole()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [yacht, setYacht] = useState<YachtRow | null>(null)
  const [incidents, setIncidents] = useState<IncidentRow[]>([])
  const [assignmentNameById, setAssignmentNameById] = useState<Map<string, string>>(new Map())

  const load = useCallback(async () => {
    if (!yachtId) return
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => setLoading(false), 1500)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setYacht(null)
        setIncidents([])
        setAssignmentNameById(new Map())
        setLoading(false)
        return
      }

      const { data: yachtRow, error: yErr } = await supabase
        .from("yachts")
        .select("id,name,group_id,archived_at")
        .eq("id", yachtId)
        .maybeSingle()

      if (yErr) {
        setError(yErr.message)
        setLoading(false)
        return
      }

      if (!yachtRow) {
        setYacht(null)
        setIncidents([])
        setAssignmentNameById(new Map())
        setLoading(false)
        return
      }

      const { data: incRows, error: iErr } = await supabase
        .from("task_incidents")
        .select("id,assignment_id,status,yacht_id,due_date")
        .eq("yacht_id", yachtId)
        .order("due_date", { ascending: true })
        .limit(2000)

      if (iErr) {
        setError(iErr.message)
        setYacht(yachtRow as YachtRow)
        setIncidents([])
        setAssignmentNameById(new Map())
        setLoading(false)
        return
      }

      setYacht(yachtRow as YachtRow)
      const list = ((incRows as any[]) ?? []) as IncidentRow[]
      setIncidents(list)

      const assignmentIds = Array.from(new Set(list.map((i) => i.assignment_id).filter(Boolean)))
      if (assignmentIds.length > 0) {
        const { data: aRows, error: aErr } = await supabase
          .from("task_assignments")
          .select("id,name")
          .in("id", assignmentIds)
          .limit(5000)
        if (!aErr) {
          const m = new Map<string, string>()
          ;(((aRows as any[]) ?? []) as any[]).forEach((a) => m.set(String(a.id), String(a.name ?? "")))
          setAssignmentNameById(m)
        } else {
          setAssignmentNameById(new Map())
        }
      } else {
        setAssignmentNameById(new Map())
      }
      setLoading(false)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }, [yachtId])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yachtId, session, load])

  if (loading) return <div className="screen">Loading…</div>

  if (!yacht) {
    return (
      <div className="screen">
        <div className="screen-title">Yacht</div>
        <div style={{ opacity: 0.75, fontSize: 13 }}>
          Not found (or not visible for this account).
        </div>
      </div>
    )
  }

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

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="primary-button" onClick={() => navigate(`/yachts/${yachtId}/tasks`)}>
            Yacht Tasks
          </button>
          {role === "admin" || role === "manager" ? (
            <button type="button" className="primary-button" onClick={() => navigate(`/editor/assignments`)}>
              Assignments
            </button>
          ) : null}
        </div>
      </div>

      <hr />

      <div className="screen-title" style={{ marginBottom: 6 }}>
        {yacht.name}
      </div>
      <div className="screen-subtitle">Operational tasks for this yacht.</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Incidents</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{incidents.length}</div>
        </div>

        {incidents.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>
            No incidents.
          </div>
        ) : (
          incidents.map((t) => {
            return (
              <div key={t.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <button
                  type="button"
                  className="list-button"
                  onClick={() => navigate(`/yachts/${yachtId}/tasks`)}
                >
                  <div className="list-button-main">
                    <div className="list-button-title" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span>{assignmentNameById.get(t.assignment_id) || t.assignment_id}</span>
                      <StatusPill status={t.status} />
                    </div>
                    <div className="list-button-subtitle">
                      {`Due ${new Date(t.due_date).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="list-button-chevron">›</div>
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

