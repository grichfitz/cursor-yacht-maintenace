import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"
import EditorNav from "./editor/EditorNav"

type UserRow = {
  id: string
  display_name: string | null
  email: string | null
  role: string | null
}

export default function UsersPage() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [users, setUsers] = useState<UserRow[]>([])
  const [groupCountByUserId, setGroupCountByUserId] = useState<Record<string, number>>({})

  const [filter, setFilter] = useState("")

  const load = async () => {
    setLoading(true)
    setError(null)

    // No user directory table to list users from.
    setError("User directory is not available.")
    setUsers([])
    setGroupCountByUserId({})
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const filteredUsers = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const hay = `${u.display_name ?? ""} ${u.email ?? ""} ${u.id}`.toLowerCase()
      return hay.includes(q)
    })
  }, [users, filter])

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Editor · Users</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div>
      )}

      <div className="card" style={{ paddingBottom: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Directory</div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name or email…"
          style={{ width: "100%" }}
        />
      </div>

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Users</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{filteredUsers.length}</div>
        </div>

        {filteredUsers.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No matching users.</div>
        ) : (
          filteredUsers.map((u) => (
            <div key={u.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="list-row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: 700 }}>{u.display_name || u.email || u.id}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {(u.email ? u.email : "") +
                      (u.email ? " · " : "") +
                      String(u.role || "crew") +
                      ` · ${groupCountByUserId[u.id] ?? 0} groups`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => navigate(`/users/${u.id}`)}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

