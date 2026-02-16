import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"
import { buildGroupParentSelectOptions } from "../../utils/groupTreeUi"
import { useMyRole } from "../../hooks/useMyRole"
import { loadManagerScopeGroupIds } from "../../utils/groupScope"

type GroupRow = { id: string; name: string; parent_group_id: string | null; archived_at?: string | null }
type UserRow = { id: string; full_name: string | null; email: string | null }
type GroupMemberRow = { user_id: string; group_id: string }

export default function EditorEditGroupPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { groupId } = useParams<{ groupId: string }>()
  const { role, loading: roleLoading } = useMyRole()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [supportsArchive, setSupportsArchive] = useState(true)
  const [archivedAt, setArchivedAt] = useState<string | null>(null)

  const [groups, setGroups] = useState<GroupRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])

  const [name, setName] = useState("")
  const [parentId, setParentId] = useState<string>("")

  const [members, setMembers] = useState<UserRow[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [addUserId, setAddUserId] = useState("")
  const [addUserIdManual, setAddUserIdManual] = useState("")

  const descendantIdsOfEditing = useMemo(() => new Set<string>(), [])
  const parentOptions = useMemo(() => buildGroupParentSelectOptions(groups), [groups])

  const loadMembers = async (gid: string, directory: UserRow[]) => {
    setMembersLoading(true)
    const { data: gm, error: gmErr } = await supabase
      .from("group_members")
      .select("user_id,group_id")
      .eq("group_id", gid)

    if (gmErr) {
      setMembers([])
      setMembersLoading(false)
      setError(gmErr.message)
      return
    }

    const ids = Array.from(new Set(((gm as GroupMemberRow[]) ?? []).map((r) => r.user_id).filter(Boolean)))
    const idSet = new Set(ids)

    // Resolve labels from the provided directory, then (optionally) by direct lookup.
    const resolvedFromDirectory = directory.filter((u) => idSet.has(u.id))

    let resolvedFromLookup: UserRow[] = []
    const unresolvedIds = ids.filter((id) => !resolvedFromDirectory.some((u) => u.id === id))
    if (unresolvedIds.length > 0) {
      const { data: u, error: uErr } = await supabase
        .from("users")
        .select("id,full_name,email")
        .in("id", unresolvedIds)

      if (!uErr) {
        resolvedFromLookup = ((u as any[]) ?? []).map((r) => ({
          id: String(r.id),
          full_name: (r.full_name ?? null) as string | null,
          email: (r.email ?? null) as string | null,
        }))
      }
    }

    const resolved = [...resolvedFromDirectory, ...resolvedFromLookup]

    const placeholders: UserRow[] =
      resolved.length === ids.length
        ? []
        : ids
            .filter((id) => !resolved.some((u) => u.id === id))
            .map((id) => ({ id, full_name: null, email: null }))

    setMembers([...resolved, ...placeholders])
    setMembersLoading(false)
  }

  useEffect(() => {
    if (!session) return
    if (!groupId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setNotice(null)
      setSupportsArchive(true)

      try {
        let scopeIds: string[] | null = null
        if (role === "manager") scopeIds = await loadManagerScopeGroupIds(session.user.id)

        if (scopeIds && scopeIds.length === 0) {
          setError("No groups are visible for this account.")
          setGroups([])
          setUsers([])
          setLoading(false)
          return
        }

        const groupListQuery = scopeIds && scopeIds.length > 0
          ? supabase.from("groups").select("id,name,parent_group_id").in("id", scopeIds).order("name")
          : supabase.from("groups").select("id,name,parent_group_id").order("name")

        // Try to load archived_at (graceful fallback if column doesn't exist).
        const groupRowQuery = scopeIds && scopeIds.length > 0
          ? supabase.from("groups").select("id,name,parent_group_id,archived_at").eq("id", groupId).in("id", scopeIds).maybeSingle()
          : supabase.from("groups").select("id,name,parent_group_id,archived_at").eq("id", groupId).maybeSingle()

        const [{ data: g, error: gErr }, { data: row, error: rowErr }] = await Promise.all([
          groupListQuery,
          groupRowQuery,
        ])

      if (cancelled) return

      const firstErr = gErr || rowErr
      if (firstErr) {
        const msg = String(firstErr.message || "")
        const missingArchivedCol = msg.includes("archived_at") && msg.toLowerCase().includes("does not exist")
        if (missingArchivedCol) {
          setSupportsArchive(false)
          // Retry without archived_at
          const groupRowQuery2 = scopeIds && scopeIds.length > 0
            ? supabase.from("groups").select("id,name,parent_group_id").eq("id", groupId).in("id", scopeIds).maybeSingle()
            : supabase.from("groups").select("id,name,parent_group_id").eq("id", groupId).maybeSingle()
          const [{ data: g2, error: g2Err }, { data: row2, error: row2Err }] = await Promise.all([groupListQuery, groupRowQuery2])
          if (cancelled) return
          const retryErr = g2Err || row2Err
          if (retryErr) {
            setError(retryErr.message)
            setGroups((g2 as GroupRow[]) ?? [])
            setUsers([])
            setLoading(false)
            return
          }
          setGroups((g2 as GroupRow[]) ?? [])
          const grp2 = row2 as GroupRow | null
          if (!grp2?.id) {
            setError("Group not found (or not visible).")
            setLoading(false)
            return
          }
          setName(grp2.name ?? "")
          setParentId(grp2.parent_group_id ?? "")
          setArchivedAt(null)
        } else {
        setError(firstErr.message)
        setGroups((g as GroupRow[]) ?? [])
        setUsers([])
        setLoading(false)
        return
        }
      }

      setGroups((g as GroupRow[]) ?? [])

      const grp = row as GroupRow | null
      if (!grp?.id) {
        setError("Group not found (or not visible).")
        setLoading(false)
        return
      }

      // Optional user directory (if exposed by RLS): users(id,email,full_name)
      let directory: UserRow[] = []
      try {
        const { data: u, error: uErr } = await supabase
          .from("users")
          .select("id,full_name,email")
          .order("email")
          .limit(500)

        if (!uErr) {
          directory = ((u as any[]) ?? []).map((r) => ({
            id: String(r.id),
            full_name: (r.full_name ?? null) as string | null,
            email: (r.email ?? null) as string | null,
          }))
        }
      } catch {
        directory = []
      }

      setUsers(directory)

      setName(grp.name ?? "")
      setParentId(grp.parent_group_id ?? "")
      setArchivedAt((grp as any)?.archived_at ?? null)
      setAddUserId("")
      setAddUserIdManual("")

      await loadMembers(groupId, directory)
      setLoading(false)
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message || "Failed to load group.")
        setGroups([])
        setUsers([])
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session, groupId, role])

  const save = async () => {
    if (!groupId) return
    setError(null)
    setNotice(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Group name is required.")
      return
    }

    setSaving(true)
    const { error: upErr } = await supabase
      .from("groups")
      .update({ name: trimmed, parent_group_id: parentId ? parentId : null })
      .eq("id", groupId)
    setSaving(false)

    if (upErr) {
      setError(upErr.message)
      return
    }

    navigate("/editor/groups", { replace: true })
  }

  const addMember = async (userId: string) => {
    if (!groupId || !userId) return
    setError(null)

    const { error: insErr } = await supabase.from("group_members").insert({ user_id: userId, group_id: groupId })
    if (insErr) {
      setError(insErr.message)
      return
    }

    setAddUserId("")
    setAddUserIdManual("")
    await loadMembers(groupId, users)
  }

  const addMe = async () => {
    if (!groupId) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await addMember(user.id)
  }

  const removeMember = async (userId: string) => {
    if (!groupId) return
    setError(null)
    const { error: delErr } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId)
    if (delErr) {
      setError(delErr.message)
      return
    }
    await loadMembers(groupId, users)
  }

  const toggleArchive = async () => {
    if (!groupId) return
    if (!supportsArchive) {
      setNotice("Archiving is not enabled in the database yet (missing `groups.archived_at`).")
      return
    }

    setError(null)
    setNotice(null)

    const nextIsArchived = !archivedAt
    const ok = window.confirm(
      nextIsArchived
        ? "Archive this group?\n\nIt will be hidden from lists."
        : "Unarchive this group?\n\nIt will reappear in lists."
    )
    if (!ok) return

    setArchiving(true)
    const nextArchivedAt = nextIsArchived ? new Date().toISOString() : null

    const { error: upErr } = await supabase
      .from("groups")
      .update({ archived_at: nextArchivedAt })
      .eq("id", groupId)

    setArchiving(false)

    if (upErr) {
      const msg = String(upErr.message || "")
      const missingArchivedCol = msg.includes("archived_at") && msg.toLowerCase().includes("does not exist")
      if (missingArchivedCol) {
        setSupportsArchive(false)
        setNotice("Archiving is not enabled in the database yet (missing `groups.archived_at`).")
      }
      setError(upErr.message)
      return
    }

    setArchivedAt(nextArchivedAt)
    setNotice(nextIsArchived ? "Group archived." : "Group unarchived.")
  }

  if (!groupId) return null
  if (loading || roleLoading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Edit group</div>
      <div className="screen-subtitle">Admin or manager.</div>

      {error ? <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div> : null}
      {notice && !error ? <div style={{ color: "var(--text-secondary)", marginBottom: 10, fontSize: 13 }}>{notice}</div> : null}

      <div className="card">
        <label>Name:</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || archiving} />

        <label>Parent group:</label>
        <select value={parentId} onChange={(e) => setParentId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || archiving}>
          <option value="">—</option>
          {parentOptions
            .filter((o) => o.id !== groupId && !descendantIdsOfEditing.has(o.id))
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
        </select>

        <hr />

        <div style={{ fontWeight: 800, marginBottom: 8 }}>Members (bootstrap)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button type="button" className="secondary" onClick={addMe} disabled={saving || archiving}>
            + Add me
          </button>

          <select
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            disabled={saving || archiving || users.length === 0}
            style={{ flex: 1, minWidth: 180 }}
          >
            <option value="">{users.length === 0 ? "User directory unavailable" : "Select user…"}</option>
            {users
              .filter((u) => !members.some((m) => m.id === u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email || u.id}
                </option>
              ))}
          </select>

          <button type="button" onClick={() => addMember(addUserId)} disabled={saving || archiving || !addUserId} style={{ opacity: saving || archiving || !addUserId ? 0.6 : 1 }}>
            Add
          </button>
        </div>

        {users.length === 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <input
              value={addUserIdManual}
              onChange={(e) => setAddUserIdManual(e.target.value)}
              placeholder="Paste user UUID…"
              disabled={saving || archiving}
              style={{ flex: 1, minWidth: 180 }}
            />
            <button
              type="button"
              onClick={() => addMember(addUserIdManual.trim())}
              disabled={saving || archiving || !addUserIdManual.trim()}
              style={{ opacity: saving || archiving || !addUserIdManual.trim() ? 0.6 : 1 }}
            >
              Add
            </button>
          </div>
        ) : null}

        {membersLoading ? (
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>Loading members…</div>
        ) : members.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>No members.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.7)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: 700 }}>{m.full_name || m.email || m.id}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{m.email ? m.email : ""}</div>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => removeMember(m.id)}
                  disabled={saving || archiving}
                  style={{ color: "var(--accent-red)" }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <button type="button" className="cta-button" onClick={save} disabled={saving || archiving}>
          {saving ? "Saving…" : "Save"}
        </button>

        <hr />

        <div style={{ fontWeight: 800, marginBottom: 6 }}>Archive</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
          Archived groups are hidden from lists.
        </div>
        {!supportsArchive ? (
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Archiving is not available (missing `groups.archived_at`).
          </div>
        ) : (
          <>
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
              {archiving ? (archivedAt ? "Unarchiving…" : "Archiving…") : archivedAt ? "Unarchive group" : "Archive group"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

