import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useFocusReload } from "../hooks/useFocusReload"
import { useSession } from "../auth/SessionProvider"

type YachtRow = {
  id: string
  name: string
  group_id: string
}

export default function YachtsPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [yachts, setYachts] = useState<YachtRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => {
      setLoading(false)
    }, 1500)

    try {
      const { data, error: loadErr } = await supabase
        .from("yachts")
        .select("id,name,group_id")
        .order("name")

      if (loadErr) {
        setError(loadErr.message)
        setYachts([])
        setLoading(false)
        return
      }

      setYachts((data as YachtRow[]) ?? [])
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
      <div className="screen-title">Yachts</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="card card-list">
        {yachts.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>
            No yachts visible for this account.
          </div>
        ) : (
          yachts.map((y) => (
            <button
              key={y.id}
              type="button"
              className="list-button"
              onClick={() => navigate(`/yachts/${y.id}`)}
            >
              <div className="list-button-main">
                <div className="list-button-title">{y.name}</div>
              </div>
              <div className="list-button-chevron">›</div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

