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
  const [notice, setNotice] = useState<string | null>(null)

  const [fullName, setFullName] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  const [shortDescription, setShortDescription] = useState<string>("")
  const [role, setRole] = useState<AppRole>("crew")
  const [roleIdByName, setRoleIdByName] = useState<Record<string, string>>({})

  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [archivedAt, setArchivedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    if (!userId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setSaved(null)

      if (cancelled) return

      try {
        const [{ data: u, error: uErr }, urRes, rolesRes] = await Promise.all([
          supabase.from("users").select("id,full_name,email,short_description,archived_at").eq("id", userId).maybeSingle(),
          supabase.from("user_roles").select("user_id,role_id").eq("user_id", userId).maybeSingle(),
          supabase.from("roles").select("id,name").limit(100),
        ])

        if (uErr) throw uErr

        const roleIdByNameNext: Record<string, string> = {}
        const roleNameById = new Map<string, string>()
        if (!rolesRes.error) {
          ;((rolesRes.data as any[]) ?? []).forEach((r) => {
            const id = String(r?.id ?? "")
            const name = String(r?.name ?? "")
            if (!id || !name) return
            roleIdByNameNext[name] = id
            roleNameById.set(id, name)
          })
        }

        const currentRoleId = (urRes as any)?.error ? "" : String((urRes as any)?.data?.role_id ?? "")
        const currentRoleName = currentRoleId ? roleNameById.get(currentRoleId) ?? "" : ""

        setFullName(String((u as any)?.full_name ?? ""))
        setEmail(String((u as any)?.email ?? ""))
        setShortDescription(String((u as any)?.short_description ?? ""))
        setArchivedAt(((u as any)?.archived_at ?? null) as string | null)
        setRole(normalizeRole(currentRoleName))
        setRoleIdByName(roleIdByNameNext)
        setLoading(false)
      } catch (e: any) {
        setError(e?.message || "Failed to load user.")
        setNotice(null)
        setFullName("")
        setEmail("")
        setShortDescription("")
        setRole("crew")
        setRoleIdByName({})
        setArchivedAt(null)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session, userId])

  const saveProfile = async () => {
    if (!userId) return
    setSaving(true)
    setSaved(null)
    setError(null)
    setNotice(null)

    try {
      const nextName = fullName.trim()
      const nextDesc = shortDescription.trim()

      // Name is optional in schema; allow blank. (Still show something in UI via email fallback.)
      const { error: upErr } = await supabase
        .from("users")
        .update({
          full_name: nextName ? nextName : null,
          short_description: nextDesc ? nextDesc : null,
        })
        .eq("id", userId)

      if (upErr) throw upErr

      setSaved("Saved.")
    } catch (e: any) {
      setError(e?.message || "Failed to save user profile.")
    } finally {
      setSaving(false)
    }
  }

  const saveRole = async () => {
    if (!userId) return
    setSaving(true)
    setSaved(null)
    setError(null)
    setNotice(null)

    try {
      const roleId = roleIdByName[role]
      if (!roleId) {
        setSaving(false)
        setError("Roles table is not available (cannot resolve role ID).")
        return
      }

      const { error: upErr } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role_id: roleId }, { onConflict: "user_id" })

      if (upErr) throw upErr
      setSaving(false)
      setSaved("Saved.")
    } catch (e: any) {
      setSaving(false)
      setError(e?.message || "Failed to save role.")
    }
  }

  const toggleArchive = async () => {
    if (!userId) return
    setError(null)
    setNotice(null)
    setSaved(null)

    const nextIsArchived = !archivedAt
    const ok = window.confirm(nextIsArchived ? "Archive this user?\n\nThey will be hidden from the directory." : "Unarchive this user?\n\nThey will reappear in the directory.")
    if (!ok) return

    setArchiving(true)
    const nextArchivedAt = nextIsArchived ? new Date().toISOString() : null

    const { error: upErr } = await supabase
      .from("users")
      .update({ archived_at: nextArchivedAt })
      .eq("id", userId)

    setArchiving(false)

    if (upErr) {
      setError(upErr.message)
      return
    }

    setArchivedAt(nextArchivedAt)
    setNotice(nextIsArchived ? "User archived." : "User unarchived.")
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

      {notice && !error ? (
        <div style={{ color: "var(--text-secondary)", marginBottom: 10, fontSize: 13 }}>{notice}</div>
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
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Profile</div>

            <label>Email (read-only):</label>
            <input value={email || userId} disabled style={{ marginBottom: 12, opacity: 0.85 }} />

            <label>Name:</label>
            <input
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                setSaved(null)
              }}
              style={{ marginBottom: 12 }}
              disabled={saving}
              placeholder="Full name (optional)"
            />

            <label>Description (2 lines):</label>
            <textarea
              value={shortDescription}
              onChange={(e) => {
                setShortDescription(e.target.value)
                setSaved(null)
              }}
              rows={2}
              style={{ marginBottom: 12 }}
              disabled={saving}
              placeholder="Short description…"
            />

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{saved || ""}</div>
              <button type="button" onClick={saveProfile} disabled={saving} style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Save profile"}
              </button>
            </div>
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

          <div className="card">
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Archive</div>
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
              Archived users are hidden from the directory.
            </div>
            {archivedAt ? (
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
                Archived {new Date(archivedAt).toLocaleDateString()}
              </div>
            ) : null}

            <button
              type="button"
              className="secondary"
              onClick={toggleArchive}
              disabled={saving || archiving}
              style={{
                width: "100%",
                opacity: saving || archiving ? 0.6 : 1,
                color: archivedAt ? "var(--accent-blue)" : "var(--accent-orange)",
                background: archivedAt ? "rgba(10, 132, 255, 0.10)" : "rgba(255, 159, 10, 0.12)",
              }}
            >
              {archiving ? (archivedAt ? "Unarchiving…" : "Archiving…") : archivedAt ? "Unarchive user" : "Archive user"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

