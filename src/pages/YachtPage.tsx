import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"
import { loadAccessibleYachtIds } from "../utils/taskAccess"

type YachtRow = {
  id: string
  name: string
  group_id: string
  archived_at: string | null
}

type TaskRow = {
  id: string
  yacht_id: string
  status: string
  due_date: string | null
  title: string
  category_id: string | null
  template_id: string | null
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

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [yacht, setYacht] = useState<YachtRow | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])

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
        setTasks([])
        setLoading(false)
        return
      }

      const yachtIds = await loadAccessibleYachtIds(user.id)
      if (!yachtIds.includes(yachtId)) {
        setYacht(null)
        setTasks([])
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
        setTasks([])
        setLoading(false)
        return
      }

      const { data: taskRows, error: tErr } = await supabase
        .from("tasks")
        .select("id,title,status,yacht_id,category_id,due_date,template_id")
        .eq("yacht_id", yachtId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })

      if (tErr) {
        setError(tErr.message)
        setYacht(yachtRow as YachtRow)
        setTasks([])
        setLoading(false)
        return
      }

      setYacht(yachtRow as YachtRow)
      setTasks((taskRows as TaskRow[]) ?? [])
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

  const yachtPhotoUrl: string | null = null
  const yachtMakeModel: string | null = null
  const yachtLocation: string | null = null
  const yachtEngineerHours: number | null = null

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

        <button
          type="button"
          className="primary-button"
          onClick={() => navigate("/tasks")}
        >
          Tasks
        </button>
      </div>

      <hr />

      <div className="screen-title" style={{ marginBottom: 6 }}>
        {yacht.name}
      </div>
      <div className="screen-subtitle">Operational tasks for this yacht.</div>

      <div className="card" style={{ paddingBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Yacht info</div>
        {yachtPhotoUrl ? (
          <img
            src={yachtPhotoUrl}
            alt=""
            style={{
              width: "100%",
              height: 160,
              objectFit: "cover",
              borderRadius: 14,
              border: "1px solid var(--border-subtle)",
              marginBottom: 10,
            }}
          />
        ) : null}
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          <div>
            <strong style={{ color: "var(--text-primary)" }}>Make / model:</strong>{" "}
            {yachtMakeModel || "—"}
          </div>
          <div>
            <strong style={{ color: "var(--text-primary)" }}>Location:</strong>{" "}
            {yachtLocation || "—"}
          </div>
          {typeof yachtEngineerHours === "number" ? (
            <div>
              <strong style={{ color: "var(--text-primary)" }}>Engineer hours:</strong>{" "}
              {yachtEngineerHours}
            </div>
          ) : null}
        </div>
      </div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Tasks</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{tasks.length}</div>
        </div>

        {tasks.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>
            No tasks.
          </div>
        ) : (
          tasks.map((t) => {
            return (
              <div key={t.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <button
                  type="button"
                  className="list-button"
                  onClick={() => navigate(`/tasks/${t.id}`)}
                >
                  <div className="list-button-main">
                    <div className="list-button-title" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span>{t.title}</span>
                      <StatusPill status={t.status} />
                    </div>
                    <div className="list-button-subtitle">
                      {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : "No due date"}
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

