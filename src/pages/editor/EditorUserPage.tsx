import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import EditorNav from "./EditorNav"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import { useGroupTree } from "../../hooks/useGroupTree"
import GenericTreeAssignPage from "../GenericTreeAssignPage"

type AppRole = "crew" | "manager" | "admin"

const ROLE_OPTIONS: AppRole[] = ["crew", "manager", "admin"]

function normalizeRole(raw: unknown): AppRole {
  if (raw === "admin" || raw === "manager" || raw === "crew") return raw
  return "crew"
}

export default function EditorUserPage() {
  const { session } = useSession()
  const { userId } = useParams<{ userId: string }>()
  const { nodes, loading: groupsLoading, error: groupsError } = useGroupTree()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  const [role, setRole] = useState<AppRole>("crew")

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    if (!userId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setSaved(null)

      if (cancelled) return

      // No user directory table; show minimal identity.
      setDisplayName("")
      setEmail("")
      setRole("crew")
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session, userId])

  const saveRole = async () => {
    if (!userId) return
    setSaving(true)
    setSaved(null)
    setError(null)

    setSaving(false)
    setError("Role updates are not available.")
  }

  if (!userId) return null

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Editor · User</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error ? (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div>
      ) : null}

      {groupsError ? (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {groupsError}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>Loading…</div>
      ) : (
        <>
          <div className="card">
            <div style={{ fontWeight: 800, marginBottom: 8 }}>User</div>
            <div style={{ fontWeight: 700 }}>{displayName || email || userId}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{email ? email : userId}</div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Role</div>
            <label>Role:</label>
            <select
              value={role}
              onChange={(e) => {
                setRole(normalizeRole(e.target.value))
                setSaved(null)
              }}
              style={{ marginBottom: 12 }}
              disabled={saving}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{saved || ""}</div>
              <button
                type="button"
                onClick={saveRole}
                disabled={saving}
                style={{ opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Groups</div>
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
              Toggle groups in the tree below. Changes apply immediately.
            </div>

            {groupsLoading ? (
              <div style={{ fontSize: 13, opacity: 0.75 }}>Loading groups…</div>
            ) : (
              <GenericTreeAssignPage
                targetId={userId}
                nodes={nodes}
                mapTable="group_members"
                mapTargetField="user_id"
                mapNodeField="group_id"
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

