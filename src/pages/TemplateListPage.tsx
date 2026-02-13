import React, { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"

type TemplateRow = {
  id: string
  name: string
  interval_days: number | null
  category_id: string | null
}

export default function TemplateListPage() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<TemplateRow[]>([])

  const totalTemplates = templates.length

  const load = async () => {
    setLoading(true)
    setError(null)

    const { data: t, error: tErr } = await supabase
      .from("task_templates")
      .select("id,name,interval_days,category_id")
      .order("name")

    if (tErr) {
      setError(tErr.message)
      setLoading(false)
      return
    }

    setTemplates((t as TemplateRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await load()
    }
    run()
    return () => {
      cancelled = true
    }
  }, [session])

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          marginTop: -6,
          gap: 10,
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="primary-button"
        >
          ← Back
        </button>

        <button
          type="button"
          className="cta-button"
          onClick={() => navigate("/templates/new")}
        >
          Create Template
        </button>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Templates</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Templates</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{totalTemplates}</div>
        </div>

        {templates.map((t) => (
          <div key={t.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <div
              className="list-row"
              style={{ justifyContent: "space-between", gap: 10 }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontWeight: 800 }}>{t.name}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {t.interval_days ? `Every ${t.interval_days}d` : "No interval"}
                  {t.category_id ? ` · Category: ${t.category_id}` : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Link to={`/templates/${t.id}`} className="secondary">
                  Edit
                </Link>
              </div>
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>
            No templates yet.
          </div>
        )}
      </div>
    </div>
  )
}

