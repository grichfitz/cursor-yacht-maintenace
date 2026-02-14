import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"

type GroupRow = { id: string; name: string; parent_group_id: string | null; description?: string | null }
type UserRow = { id: string; display_name: string | null; email: string | null; role?: string | null }
type GroupMemberRow = { id: string; user_id: string; group_id: string }

export default function EditorEditGroupPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { groupId } = useParams<{ groupId: string }>()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [groups, setGroups] = useState<GroupRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [parentId, setParentId] = useState<string>("")

  const [members, setMembers] = useState<UserRow[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [addUserId, setAddUserId] = useState("")

  const groupById = useMemo(() => {
    const m = new Map<string, GroupRow>()
    groups.forEach((g) => m.set(g.id, g))
    return m
  }, [groups])

  const childrenMap = useMemo(() => {
    const m = new Map<string | null, GroupRow[]>()
    for (const g of groups) {
      const key = g.parent_group_id && groupById.has(g.parent_group_id) ? g.parent_group_id : null
      const arr = m.get(key) ?? []
      arr.push(g)
      m.set(key, arr)
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => a.name.localeCompare(b.name))
      m.set(k, arr)
    }
    return m
  }, [groups, groupById])

  const orderedGroups = useMemo(() => {
    const out: Array<{ g: GroupRow; depth: number }> = []
    const visited = new Set<string>()

    const walk = (parentId: string | null, depth: number) => {
      const kids = childrenMap.get(parentId) ?? []
      for (const g of kids) {
        if (visited.has(g.id)) continue
        visited.add(g.id)
        out.push({ g, depth })
        walk(g.id, depth + 1)
      }
    }

    walk(null, 0)

    for (const g of groups) {
      if (!visited.has(g.id)) out.push({ g, depth: 0 })
    }

    return out
  }, [childrenMap, groups])

  const descendantIdsOfEditing = useMemo(() => {
    if (!groupId) return new Set<string>()
    const ids = new Set<string>()
    const stack = [groupId]
    while (stack.length) {
      const current = stack.pop()!
      const kids = childrenMap.get(current) ?? []
      for (const k of kids) {
        if (ids.has(k.id)) continue
        ids.add(k.id)
        stack.push(k.id)
      }
    }
    return ids
  }, [groupId, childrenMap])

  const formatTreeLabel = (g: GroupRow) => {
    const parts: string[] = [g.name]
    let cur = g
    let guard = 0
    while (cur.parent_group_id && groupById.has(cur.parent_group_id) && guard < 10) {
      const p = groupById.get(cur.parent_group_id)!
      parts.unshift(p.name)
      cur = p
      guard++
    }
    return parts.join(" › ")
  }

  const loadMembers = async (gid: string, directory: UserRow[]) => {
    setMembersLoading(true)
    const { data: gm, error: gmErr } = await supabase
      .from("group_members")
      .select("id,user_id,group_id")
      .eq("group_id", gid)

    if (gmErr) {
      setMembers([])
      setMembersLoading(false)
      setError(gmErr.message)
      return
    }

    const ids = ((gm as GroupMemberRow[]) ?? []).map((r) => r.user_id)
    const idSet = new Set(ids)
    const resolved = directory.filter((u) => idSet.has(u.id))

    const placeholders: UserRow[] =
      resolved.length === ids.length
        ? []
        : ids
            .filter((id) => !resolved.some((u) => u.id === id))
            .map((id) => ({ id, display_name: null, email: null }))

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

      const [{ data: g, error: gErr }, { data: u, error: uErr }, { data: row, error: rowErr }] = await Promise.all([
        supabase.from("groups").select("id,name,parent_group_id,description").order("name"),
        supabase.from("users").select("id,display_name,email,role").order("display_name"),
        supabase.from("groups").select("id,name,parent_group_id,description").eq("id", groupId).maybeSingle(),
      ])

      if (cancelled) return

      const firstErr = gErr || rowErr
      if (firstErr) {
        setError(firstErr.message)
        setGroups((g as GroupRow[]) ?? [])
        setUsers((uErr ? [] : ((u as UserRow[]) ?? [])) as UserRow[])
        setLoading(false)
        return
      }

      const directory = (uErr ? [] : ((u as UserRow[]) ?? [])) as UserRow[]
      setGroups((g as GroupRow[]) ?? [])
      setUsers(directory)

      const grp = row as GroupRow | null
      if (!grp?.id) {
        setError("Group not found (or not visible).")
        setLoading(false)
        return
      }

      setName(grp.name ?? "")
      setDescription((grp.description ?? "") as string)
      setParentId(grp.parent_group_id ?? "")
      setAddUserId("")

      await loadMembers(groupId, directory)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session, groupId])

  const save = async () => {
    if (!groupId) return
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Group name is required.")
      return
    }

    setSaving(true)
    const { error: upErr } = await supabase
      .from("groups")
      .update({
        name: trimmed,
        description: description.trim() ? description.trim() : null,
        parent_group_id: parentId || null,
      })
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

  const del = async () => {
    if (!groupId) return
    const ok = window.confirm("Delete this group?\n\nThis cannot be undone.")
    if (!ok) return

    setDeleting(true)
    setError(null)

    const { error: delErr } = await supabase.from("groups").delete().eq("id", groupId)
    setDeleting(false)
    if (delErr) {
      setError(delErr.message)
      return
    }

    navigate("/editor/groups", { replace: true })
  }

  if (!groupId) return null
  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Edit group</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error ? <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div> : null}

      <div className="card">
        <label>Name:</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || deleting} />

        <label>Description (optional):</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ marginBottom: 12 }} disabled={saving || deleting} />

        <label>Parent group:</label>
        <select value={parentId} onChange={(e) => setParentId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || deleting}>
          <option value="">—</option>
          {orderedGroups
            .map((x) => x.g)
            .filter((p) => p.id !== groupId && !descendantIdsOfEditing.has(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {formatTreeLabel(p)}
              </option>
            ))}
        </select>

        <hr />

        <div style={{ fontWeight: 800, marginBottom: 8 }}>Members (bootstrap)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button type="button" className="secondary" onClick={addMe} disabled={saving || deleting}>
            + Add me
          </button>

          <select
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            disabled={saving || deleting || users.length === 0}
            style={{ flex: 1, minWidth: 180 }}
          >
            <option value="">{users.length === 0 ? "User directory unavailable" : "Select user…"}</option>
            {users
              .filter((u) => !members.some((m) => m.id === u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {(u.display_name || u.email || "Unnamed user") + (u.role ? ` (${u.role})` : "")}
                </option>
              ))}
          </select>

          <button type="button" onClick={() => addMember(addUserId)} disabled={saving || deleting || !addUserId} style={{ opacity: saving || deleting || !addUserId ? 0.6 : 1 }}>
            Add
          </button>
        </div>

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
                  <div style={{ fontWeight: 700 }}>{m.display_name || m.email || m.id}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{m.email ? m.email : ""}</div>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => removeMember(m.id)}
                  disabled={saving || deleting}
                  style={{ color: "var(--accent-red)" }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <button type="button" className="cta-button" onClick={save} disabled={saving || deleting}>
          {saving ? "Saving…" : "Save"}
        </button>

        <hr />

        <button
          type="button"
          className="secondary"
          onClick={del}
          disabled={saving || deleting}
          style={{ color: "var(--accent-red)", width: "100%" }}
        >
          {deleting ? "Deleting…" : "Delete group"}
        </button>
      </div>
    </div>
  )
}

