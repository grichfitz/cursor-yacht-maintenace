import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"
import EditorNav from "./EditorNav"
import { useSession } from "../../auth/SessionProvider"

type GroupRow = { id: string; name: string; parent_group_id: string | null }
type UserRow = { id: string; display_name: string | null; email: string | null; role?: string | null }
type GroupMemberRow = { id: string; user_id: string; group_id: string }

export default function EditorGroupsPage() {
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])

  const [newName, setNewName] = useState("")
  const [newParentId, setNewParentId] = useState<string>("")
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editParentId, setEditParentId] = useState<string>("")
  const [saving, setSaving] = useState(false)

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
      const key =
        g.parent_group_id && groupById.has(g.parent_group_id)
          ? g.parent_group_id
          : null
      const arr = m.get(key) ?? []
      arr.push(g)
      m.set(key, arr)
    }

    // Keep deterministic: sort siblings by name
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

    // Defensive: if any nodes were skipped (bad data), append them at root.
    for (const g of groups) {
      if (!visited.has(g.id)) out.push({ g, depth: 0 })
    }

    return out
  }, [childrenMap, groups])

  const descendantIdsOfEditing = useMemo(() => {
    if (!editingId) return new Set<string>()

    const ids = new Set<string>()
    const stack = [editingId]

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
  }, [editingId, childrenMap])

  const formatTreeLabel = (g: GroupRow) => {
    // Compact "path-ish" label for selects: Parent › Child
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

  const load = async () => {
    setLoading(true)
    setError(null)

    const { data, error: loadErr } = await supabase
      .from("groups")
      .select("id,name,parent_group_id")
      .order("name")

    if (loadErr) {
      setError(loadErr.message)
      setGroups([])
      setLoading(false)
      return
    }

    setGroups((data as GroupRow[]) ?? [])

    // Load user directory for membership bootstrap.
    const { data: u, error: uErr } = await supabase
      .from("users")
      .select("id,display_name,email,role")
      .order("display_name")

    if (uErr) {
      // Non-fatal: still allow group editing even if directory is restricted.
      setUsers([])
    } else {
      setUsers((u as UserRow[]) ?? [])
    }

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
  }, [session])

  const create = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return

    setCreating(true)
    setError(null)

    const { error: insErr } = await supabase.from("groups").insert({
      name: trimmed,
      parent_group_id: newParentId || null,
    })
    if (insErr) {
      setError(insErr.message)
      setCreating(false)
      return
    }

    setNewName("")
    setNewParentId("")
    setCreating(false)
    await load()
  }

  const startEdit = (g: GroupRow) => {
    setEditingId(g.id)
    setEditName(g.name)
    setEditParentId(g.parent_group_id ?? "")
    setAddUserId("")
  }

  const save = async () => {
    if (!editingId) return
    const trimmed = editName.trim()
    if (!trimmed) return

    setSaving(true)
    setError(null)

    const { error: upErr } = await supabase
      .from("groups")
      .update({ name: trimmed, parent_group_id: editParentId || null })
      .eq("id", editingId)

    if (upErr) {
      setError(upErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setEditingId(null)
    await load()
  }

  const del = async (id: string) => {
    const ok = window.confirm("Delete this group? This cannot be undone.")
    if (!ok) return

    setError(null)
    const { error: delErr } = await supabase.from("groups").delete().eq("id", id)
    if (delErr) {
      setError(delErr.message)
      return
    }

    await load()
  }

  const loadMembers = async (groupId: string) => {
    setMembersLoading(true)
    setError(null)

    const { data: gm, error: gmErr } = await supabase
      .from("group_members")
      .select("id,user_id,group_id")
      .eq("group_id", groupId)

    if (gmErr) {
      setError(gmErr.message)
      setMembers([])
      setMembersLoading(false)
      return
    }

    const ids = ((gm as GroupMemberRow[]) ?? []).map((r) => r.user_id)
    const idSet = new Set(ids)
    const resolved = users.filter((u) => idSet.has(u.id))

    // If directory is empty due to RLS, at least show placeholder rows by id.
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
    if (!editingId) {
      setMembers([])
      return
    }

    loadMembers(editingId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, users.length, session])

  const addMember = async (userId: string) => {
    if (!editingId || !userId) return

    setError(null)
    const { error: insErr } = await supabase.from("group_members").insert({
      user_id: userId,
      group_id: editingId,
    })

    if (insErr) {
      setError(insErr.message)
      return
    }

    setAddUserId("")
    await loadMembers(editingId)
  }

  const addMe = async () => {
    if (!editingId) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await addMember(user.id)
  }

  const removeMember = async (userId: string) => {
    if (!editingId) return

    setError(null)
    const { error: delErr } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", editingId)
      .eq("user_id", userId)

    if (delErr) {
      setError(delErr.message)
      return
    }

    await loadMembers(editingId)
  }

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Editor · Groups</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Create group</div>
        <label>Name:</label>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ marginBottom: 12 }}
          disabled={creating}
        />
        <label>Parent group (optional):</label>
        <select
          value={newParentId}
          onChange={(e) => setNewParentId(e.target.value)}
          style={{ marginBottom: 12 }}
          disabled={creating}
        >
          <option value="">—</option>
          {orderedGroups.map(({ g }) => (
            <option key={g.id} value={g.id}>
              {formatTreeLabel(g)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="cta-button"
          onClick={create}
          disabled={creating || !newName.trim()}
          style={{ opacity: creating || !newName.trim() ? 0.6 : 1 }}
        >
          {creating ? "Creating…" : "Create"}
        </button>
      </div>

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Groups</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{groups.length}</div>
        </div>

        {orderedGroups.map(({ g, depth }) => (
          <div key={g.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            {editingId === g.id ? (
              <div style={{ padding: 12 }}>
                <label>Name:</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ marginBottom: 12 }}
                  disabled={saving}
                />
                <label>Parent group:</label>
                <select
                  value={editParentId}
                  onChange={(e) => setEditParentId(e.target.value)}
                  style={{ marginBottom: 12 }}
                  disabled={saving}
                >
                  <option value="">—</option>
                  {orderedGroups
                    .map((x) => x.g)
                    .filter((p) => p.id !== g.id && !descendantIdsOfEditing.has(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatTreeLabel(p)}
                      </option>
                    ))}
                </select>

                <hr />

                <div style={{ fontWeight: 800, marginBottom: 8 }}>Members (bootstrap)</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <button type="button" className="secondary" onClick={addMe} disabled={saving}>
                    + Add me
                  </button>

                  <select
                    value={addUserId}
                    onChange={(e) => setAddUserId(e.target.value)}
                    disabled={saving || users.length === 0}
                    style={{ flex: 1, minWidth: 180 }}
                  >
                    <option value="">
                      {users.length === 0 ? "User directory unavailable" : "Select user…"}
                    </option>
                    {users
                      .filter((u) => !members.some((m) => m.id === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {(u.display_name || u.email || "Unnamed user") +
                            (u.role ? ` (${u.role})` : "")}
                        </option>
                      ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => addMember(addUserId)}
                    disabled={saving || !addUserId}
                    style={{ opacity: saving || !addUserId ? 0.6 : 1 }}
                  >
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
                          <div style={{ fontWeight: 700 }}>
                            {m.display_name || m.email || m.id}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            {m.email ? m.email : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => removeMember(m.id)}
                          disabled={saving}
                          style={{ color: "var(--accent-red)" }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !editName.trim()}
                    style={{ opacity: saving || !editName.trim() ? 0.6 : 1 }}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditingId(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="list-row"
                style={{
                  justifyContent: "space-between",
                  gap: 10,
                  paddingLeft: 10 + depth * 18,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: depth === 0 ? 800 : 700 }}>
                    {depth === 0 ? g.name : `↳ ${g.name}`}
                  </div>
                  {g.parent_group_id ? (
                    <div style={{ fontSize: 12, opacity: 0.65 }}>
                      {groupById.get(g.parent_group_id)?.name ?? "—"}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="secondary" onClick={() => startEdit(g)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => del(g.id)}
                    style={{ color: "var(--accent-red)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

