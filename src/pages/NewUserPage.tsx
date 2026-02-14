import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"

export default function NewUserPage() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [groupId, setGroupId] = useState("")
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const loadGroups = async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id,name")
        .order("name")

      if (error) {
        setError(error.message)
        return
      }

      const rows = (data as any[]) ?? []
      const list = rows
        .map((r) => ({ id: r.id as string, name: r.name as string }))
        .filter((g) => !!g.id && !!g.name)

      setGroups(list)
      if (!groupId && list.length === 1) {
        setGroupId(list[0].id)
      }
    }

    loadGroups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const handleCreate = async () => {
    setError(null)
    setInfo(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError("Email is required.")
      return
    }

    if (!groupId) {
      setError("Group is required.")
      return
    }

    setSaving(true)

    try {
      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession()

      if (sessionErr) {
        setSaving(false)
        setError(sessionErr.message)
        return
      }

      const token = session?.access_token
      if (!token) {
        setSaving(false)
        setError("You must be signed in to invite users.")
        return
      }

      const res = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: trimmedEmail,
          displayName: displayName.trim() || undefined,
          redirectTo: `${window.location.origin}/desktop`,
          groupId,
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
      const action = body?.action as string | undefined
      if (!newId) {
        setError("User invited, but no ID returned.")
        return
      }

      if (action === "synced_existing") {
        setInfo("User already exists — synced into the directory.")
      } else {
        setInfo("Invite sent — user will receive an email to set their password.")
      }

      // Replace New User page in history so Back goes to users list.
      navigate(`/users/${newId}`, { replace: true })
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
    <div className="screen">
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
          type="button"
          onClick={() => navigate(-1)}
          className="primary-button"
        >
          ← Back
        </button>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>New User</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 12 }}>
          {error}
        </div>
      )}

      {info && (
        <div style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
          {info}
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

      <label>Group:</label>
      <select
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        style={{ marginBottom: 12 }}
      >
        <option value="">Select a group…</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

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

