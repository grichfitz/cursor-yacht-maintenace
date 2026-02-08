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
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  const handleDelete = async () => {
    if (!userId) return

    setDeleteError(null)

    const ok = window.confirm(
      "Delete this user?\n\nThis cannot be undone."
    )
    if (!ok) return

    setDeleting(true)

    // Block deletion if user is referenced by execution/history tables.
    const { data: results, error: resultsErr } = await supabase
      .from("task_results")
      .select("id")
      .eq("performed_by", userId)
      .limit(1)

    if (resultsErr) {
      setDeleteError(resultsErr.message)
      setDeleting(false)
      return
    }

    const { data: assignees, error: assigneeErr } = await supabase
      .from("task_context_assignees")
      .select("task_context_id")
      .eq("assignee_id", userId)
      .limit(1)

    if (assigneeErr) {
      setDeleteError(assigneeErr.message)
      setDeleting(false)
      return
    }

    const isReferenced =
      (results?.length ?? 0) > 0 || (assignees?.length ?? 0) > 0

    if (isReferenced) {
      setDeleteError(
        "This user cannot be deleted because they are referenced by execution/history (task_results or task_context_assignees)."
      )
      setDeleting(false)
      return
    }

    // Remove non-historical links first.
    const linkDeletes = await Promise.all([
      supabase.from("user_group_links").delete().eq("user_id", userId),
      supabase.from("user_role_links").delete().eq("user_id", userId),
      supabase.from("app_user_links").delete().eq("user_id", userId),
      supabase.from("yacht_user_links").delete().eq("user_id", userId),
    ])

    const linkError = linkDeletes.find((r) => r.error)?.error
    if (linkError) {
      setDeleteError(linkError.message)
      setDeleting(false)
      return
    }

    const { error: delErr } = await supabase.from("users").delete().eq("id", userId)

    if (delErr) {
      setDeleteError(delErr.message)
      setDeleting(false)
      return
    }

    setDeleting(false)
    navigate("/apps/users", { replace: true })
  }

  if (!userId) return null

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
      <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
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

        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            background: "rgba(255, 59, 48, 0.12)",
            border: "none",
            borderRadius: 12,
            padding: "4px 10px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--accent-red)",
            cursor: deleting ? "default" : "pointer",
          }}
        >
          {deleting ? "Deleting…" : "Delete User"}
        </button>
      </div>

      {deleteError && (
        <div style={{ marginTop: 10, color: "var(--accent-red)", fontSize: 13 }}>
          {deleteError}
        </div>
      )}
    </div>
  )
}

