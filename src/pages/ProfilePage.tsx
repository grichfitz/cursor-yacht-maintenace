import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"

type UserRow = {
  id: string
  display_name: string | null
  email: string | null
}

type GroupLinkRow = {
  group_id: string
  groups?: { name: string | null } | null
}

type GroupRow = {
  id: string
  name: string
}

const GLOBAL_GROUP_NAME = "Global Library"

export default function ProfilePage() {
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [description, setDescription] = useState("")
  const [groups, setGroups] = useState<string[]>([])
  const [globalGroups, setGlobalGroups] = useState<string[]>([])

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setSaved(false)

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser()

      if (userErr) {
        if (!cancelled) {
          setError(userErr.message)
          setLoading(false)
        }
        return
      }

      if (!user) {
        if (!cancelled) {
          setError("Not signed in.")
          setLoading(false)
        }
        return
      }

      // Description lives in auth user metadata (no schema changes).
      const metaDescription =
        (user.user_metadata as any)?.profile_description ??
        (user.user_metadata as any)?.description ??
        ""

      // Memberships (exclude Global Library in display).
      const { data: links, error: linksErr } = await supabase
        .from("group_memberships")
        .select("group_id, groups(name)")
        .eq("user_id", user.id)

      if (linksErr) {
        if (!cancelled) {
          setError(linksErr.message)
          setLoading(false)
        }
        return
      }

      const memberships = (links as GroupLinkRow[]) ?? []

      const globalMembershipNames = memberships
        .map((l) => l.groups?.name ?? "")
        .filter((n) => n === GLOBAL_GROUP_NAME)

      const operationalMembershipNames = memberships
        .map((l) => l.groups?.name ?? "")
        .filter(Boolean)
        .filter((n) => n !== GLOBAL_GROUP_NAME)

      // YM v2: groups are flat (no parent hierarchy).
      const operationalGroupNames = Array.from(new Set(operationalMembershipNames)).sort((a, b) =>
        a.localeCompare(b)
      )

      if (!cancelled) {
        setName(String(((user.user_metadata as any)?.display_name ?? "") as string))
        setEmail(String(user.email ?? ""))
        setDescription(String(metaDescription ?? ""))
        setGroups(operationalGroupNames)
        setGlobalGroups(globalMembershipNames)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session])

  const canSave = useMemo(() => {
    return !loading && !saving && !!name.trim()
  }, [loading, saving, name])

  const save = async () => {
    setError(null)
    setSaved(false)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Name is required.")
      return
    }

    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError("Not signed in.")
      setSaving(false)
      return
    }

    // v2: no public.users table; persist profile fields in auth metadata.
    const { error: metaErr } = await supabase.auth.updateUser({
      data: { display_name: trimmedName || "", profile_description: description || "" },
    })

    if (metaErr) {
      setError(metaErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setSaved(true)
  }

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <div className="screen-title">Profile</div>

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: "rgba(255, 0, 0, 0.08)",
            border: "1px solid rgba(255, 0, 0, 0.2)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {saved && !error && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: "rgba(0, 200, 83, 0.10)",
            border: "1px solid rgba(0, 200, 83, 0.25)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        >
          Saved.
        </div>
      )}

      <label>Name:</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 12 }}
        disabled={saving}
      />

      <label>Email:</label>
      <input
        value={email}
        style={{
          marginBottom: 12,
          background: "var(--border-subtle)",
          color: "var(--text-secondary)",
          cursor: "not-allowed",
        }}
        disabled
      />

      <label>Description:</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        style={{ marginBottom: 12 }}
        disabled={saving}
      />

      <button
        type="button"
        className="cta-button"
        onClick={save}
        disabled={!canSave}
        style={{ opacity: canSave ? 1 : 0.6 }}
      >
        {saving ? "Saving…" : "Save"}
      </button>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Groups</div>
      {groups.length === 0 ? (
        <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 12 }}>
          No groups.
        </div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 16, marginBottom: 12 }}>
          {groups.map((g) => (
            <li key={g} style={{ marginBottom: 6 }}>
              {g}
            </li>
          ))}
        </ul>
      )}

      {/* Global Library is intentionally excluded from the list */}

      <div style={{ height: 10 }} />

      <hr />

      <button
        type="button"
        className="list-button"
        onClick={async () => {
          await supabase.auth.signOut()
        }}
      >
        <div className="list-button-main">
          <div className="list-button-title">Logout</div>
        </div>
        <div className="list-button-chevron">›</div>
      </button>
    </div>
  )
}

