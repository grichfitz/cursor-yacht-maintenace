import React, { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"

type UserRow = {
  id: string
  display_name: string | null
  email: string | null
}

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return

    supabase
      .from("users")
      .select("id, display_name, email")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        const row = data as UserRow | null
        if (!row) return

        setDisplayName(row.display_name ?? "")
        setEmail(row.email ?? "")
      })
  }, [userId])

  const save = async () => {
    if (!userId) return
    setSaving(true)

    await supabase
      .from("users")
      .update({
        display_name: displayName || null,
      })
      .eq("id", userId)

    setSaving(false)
  }

  if (!userId) return null

  return (
    <div className="app-content">
      {/* Top Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          marginTop: -6,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          ← Back
        </button>

        <button
          onClick={() => navigate("/desktop")}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          Home
        </button>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>User Editor</div>

      <label>Display name:</label>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <label>Email (read-only):</label>
      <input value={email} readOnly style={{ marginBottom: 12 }} />

      <hr />

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            color: "var(--text-primary)",
            padding: 0,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <hr />

      {/* Assigned Groups — subtle pill */}
      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => navigate(`/users/${userId}/groups`)}
          style={{
            background: "var(--border-subtle)",
            border: "none",
            borderRadius: 12,
            padding: "4px 10px",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          Assigned Groups
        </button>
      </div>
    </div>
  )
}

