import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import TreeDisplay from "../components/TreeDisplay"
import { useGroupTree } from "../hooks/useGroupTree"
import { useSession } from "../auth/SessionProvider"

const ROOT_ID = "__root__"

type GroupRow = {
  id: string
  name: string
  description: string | null
  is_archived: boolean | null
}

export default function GroupEditorPage() {
  const navigate = useNavigate()
  const { groupId } = useParams<{ groupId: string }>()
  const { session } = useSession()
  const { nodes } = useGroupTree()
  const isVirtualGroup = !!groupId?.startsWith("__")

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [isArchived, setIsArchived] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    if (!groupId) return
    if (groupId.startsWith("__")) {
      setLoading(false)
      setIsAdmin(false)
      return
    }
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      // Determine admin status (UI gate; RLS remains authoritative).
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { data: rolesData } = await supabase
            .from("user_role_links")
            .select("roles(name)")
            .eq("user_id", user.id)

          const hasAdminRole =
            (rolesData as any[])?.some(
              (r: any) => r?.roles?.name?.toLowerCase() === "admin"
            ) ?? false

          if (!cancelled) setIsAdmin(hasAdminRole)
        } else {
          if (!cancelled) setIsAdmin(false)
        }
      } catch {
        if (!cancelled) setIsAdmin(false)
      }

      const { data, error: loadErr } = await supabase
        .from("groups")
        .select("id,name,description,is_archived")
        .eq("id", groupId)
        .single()

      if (cancelled) return

      if (loadErr) {
        setError(loadErr.message)
        setLoading(false)
        return
      }

      const row = data as GroupRow | null
      if (!row) {
        setError("Group not found.")
        setLoading(false)
        return
      }

      setName(row.name)
      setDescription(row.description ?? "")
      setSelectedParentId(ROOT_ID)
      setIsArchived(!!row.is_archived)
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [groupId, session])

  /* ---------- Circular move prevention ---------- */

  const childrenMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    nodes.forEach((n) => {
      if (!n.parentId) return
      if (!map[n.parentId]) map[n.parentId] = []
      map[n.parentId].push(n.id)
    })
    return map
  }, [nodes])

  const getDescendants = (id: string): string[] => {
    const kids = childrenMap[id] || []
    return kids.flatMap((k) => [k, ...getDescendants(k)])
  }

  const forbiddenTargets = useMemo(() => {
    if (!groupId) return new Set<string>()
    return new Set([groupId, ...getDescendants(groupId)])
  }, [groupId, childrenMap])

  /* ---------- Virtual Top Level ---------- */

  const treeWithRoot = useMemo(() => {
    return [
      ...nodes.map((n) => ({
        id: n.id,
        label: n.label,
        parentId: n.parentId,
      })),
      { id: ROOT_ID, label: "Top Level", parentId: null },
    ]
  }, [nodes])

  /* ---------- Save ---------- */

  const save = async () => {
    if (!groupId) return
    setError(null)

    if (!isAdmin) {
      setError("Only administrators can edit groups.")
      return
    }

    if (isArchived) {
      setError("This group is archived. Unarchive it before editing.")
      return
    }

    if (!name.trim()) {
      setError("Group name is required.")
      return
    }

    setSaving(true)

    // IMPORTANT:
    // PostgREST can return 204 success even when RLS filters the row (0 rows updated).
    // Force a return payload so we can detect "no rows" as a real failure mode.
    const { data: updated, error: updateErr } = await supabase
      .from("groups")
      .update({
        name: name.trim(),
        description: description || null,
      })
      .eq("id", groupId)
      .select("id,name,description,is_archived")
      .maybeSingle()

    if (updateErr) {
      setError(updateErr.message)
      setSaving(false)
      return
    }

    if (!updated?.id) {
      setError("Save failed (no rows updated). This is usually RLS blocking the update.")
      setSaving(false)
      return
    }

    setSaving(false)
    navigate(-1)
  }

  const unarchiveToTopLevel = async () => {
    if (!groupId) return
    setError(null)

    if (!isAdmin) {
      setError("Only administrators can un-archive groups.")
      return
    }

    setSaving(true)

    const { data: updated, error: updateErr } = await supabase
      .from("groups")
      .update({ is_archived: false })
      .eq("id", groupId)
      .select("id,name,description,is_archived")
      .maybeSingle()

    if (updateErr) {
      setError(updateErr.message)
      setSaving(false)
      return
    }

    if (!updated?.id) {
      setError("Unarchive failed (no rows updated). This is usually RLS blocking the update.")
      setSaving(false)
      return
    }

    // Switch the page back into editable mode without navigation.
    setIsArchived(false)
    setSelectedParentId(ROOT_ID)
    setName((updated as any)?.name ?? name)
    setDescription((updated as any)?.description ?? "")
    setSaving(false)
  }

  const toggleArchive = async () => {
    if (!groupId) return
    setError(null)

    if (!isAdmin) {
      setError("Only administrators can archive/un-archive groups.")
      return
    }

    if (isArchived) {
      // Prefer the explicit unarchive behavior (top-level restore).
      await unarchiveToTopLevel()
      return
    }

    setSaving(true)

    const { data: updated, error: updateErr } = await supabase
      .from("groups")
      .update({ is_archived: !isArchived })
      .eq("id", groupId)
      .select("id,is_archived")
      .maybeSingle()

    if (updateErr) {
      setError(updateErr.message)
      setSaving(false)
      return
    }

    if (!updated?.id) {
      setError("Archive failed (no rows updated). This is usually RLS blocking the update.")
      setSaving(false)
      return
    }

    // Switch immediately into the archived read-only view on this page.
    setIsArchived(true)
    setSaving(false)
  }

  if (!groupId) return null
  if (loading) return <div className="screen">Loading…</div>

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

      {isVirtualGroup ? (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: "rgba(255, 193, 7, 0.1)",
            border: "1px solid rgba(255, 193, 7, 0.3)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        >
          <strong>Note:</strong> This is a virtual group and cannot be edited.
        </div>
      ) : null}

      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        Group Editor{name ? ` — ${name}` : ""}
      </div>

      {!isAdmin && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: "rgba(255, 193, 7, 0.1)",
            border: "1px solid rgba(255, 193, 7, 0.3)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        >
          <strong>Note:</strong> Group editing is restricted to administrators.
        </div>
      )}

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

      <label>Name:</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 12 }}
        disabled={isVirtualGroup || !isAdmin || saving || isArchived}
        readOnly={isArchived}
        {...(isArchived
          ? {
              style: {
                marginBottom: 12,
                background: "var(--border-subtle)",
                color: "var(--text-secondary)",
                cursor: "not-allowed",
              },
            }
          : { style: { marginBottom: 12 } })}
      />

      <label>Description:</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        style={
          isArchived
            ? {
                marginBottom: 12,
                background: "var(--border-subtle)",
                color: "var(--text-secondary)",
                cursor: "not-allowed",
              }
            : { marginBottom: 12 }
        }
        disabled={isVirtualGroup || !isAdmin || saving || isArchived}
        readOnly={isArchived}
      />

      {/* Archived groups: read-only details + single Unarchive button */}
      {!isVirtualGroup && isAdmin && isArchived ? (
        <button
          type="button"
          className="cta-button"
          onClick={unarchiveToTopLevel}
          disabled={saving}
          style={{ opacity: saving ? 0.6 : 1, marginBottom: 12 }}
        >
          {saving ? "Unarchiving…" : "Unarchive"}
        </button>
      ) : null}

      {!isVirtualGroup && isAdmin && !isArchived ? (
        <button
          type="button"
          className="cta-button"
          onClick={save}
          disabled={saving}
          style={{ opacity: saving ? 0.6 : 1, marginBottom: 12 }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      ) : null}

      {/* Assigned Tasks (canonical: group-scoped assignments with downward propagation) */}
      {!isVirtualGroup ? (
        <div style={{ marginTop: 4, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => navigate(`/groups/${groupId}/tasks`)}
            style={{
              background: "var(--border-subtle)",
              border: "none",
              borderRadius: 12,
              padding: "4px 10px",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-primary)",
              cursor: "pointer",
              opacity: saving ? 0.6 : 1,
            }}
            disabled={saving}
            title="Assign tasks to this group (propagates downward)"
          >
            Assigned Tasks
          </button>
        </div>
      ) : null}

      {!isVirtualGroup && isAdmin && !isArchived ? (
        <>
          <hr />

          <div style={{ marginBottom: 8, fontWeight: 500 }}>Move Group</div>

          <div style={{ maxHeight: "40vh", overflowY: "auto", marginBottom: 12 }}>
            <TreeDisplay
              nodes={treeWithRoot}
              renderActions={(node) => {
                // Allow selecting the special "__root__" (Top Level) option.
                // Block other virtual nodes (e.g. "__archive__", "__unassigned_*__").
                const isVirtual = node.id.startsWith("__") && node.id !== ROOT_ID
                const disabled = forbiddenTargets.has(node.id) || isVirtual
                return (
                  <input
                    type="radio"
                    disabled={disabled || saving}
                    checked={selectedParentId === node.id}
                    onChange={() => setSelectedParentId(node.id)}
                    style={{ transform: "scale(1.2)" }}
                  />
                )
              }}
            />
          </div>

          <button
            type="button"
            className="cta-button"
            onClick={save}
            disabled={saving}
            style={{ opacity: saving ? 0.6 : 1, marginBottom: 12 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>

          <hr />

          <div style={{ marginBottom: 20 }}>
            <button
              onClick={toggleArchive}
              disabled={saving}
              style={{
                background: "var(--border-subtle)",
                border: "none",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-primary)",
                cursor: "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              Archive Group
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

