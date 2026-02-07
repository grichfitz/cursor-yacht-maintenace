import React, { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function NewUserPage() {
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError("Email is required.")
      return
    }

    setSaving(true)

    try {
      const res = await fetch("/api/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          displayName: displayName.trim() || undefined,
          redirectTo: `${window.location.origin}/desktop`,
        }),
      })

      const body = (await res.json().catch(() => ({}))) as any

      setSaving(false)

      if (!res.ok) {
        setError(
          body?.error ||
            "Failed to invite user. (If you're running locally, this endpoint only exists when deployed to Vercel or using vercel dev.)"
        )
        return
      }

      const newId = body?.userId as string | undefined
      if (!newId) {
        setError("User invited, but no ID returned.")
        return
      }

      // Replace New User page in history so Back goes to users list.
      navigate(`/apps/users/${newId}`, { replace: true })
    } catch (e: any) {
      setSaving(false)
      setError(
        e?.message ||
          "Failed to reach invite endpoint. (If you're running locally, deploy to Vercel or use vercel dev.)"
      )
      return
    }

  }

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

      <div style={{ fontWeight: 600, marginBottom: 8 }}>New User</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 12 }}>
          {error}
        </div>
      )}

      <label>Display name:</label>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <label>Email:</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleCreate}
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
          {saving ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  )
}

