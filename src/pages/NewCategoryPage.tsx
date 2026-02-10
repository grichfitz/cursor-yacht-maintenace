import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import TreeDisplay from "../components/TreeDisplay"
import { useCategoryTree } from "../hooks/useCategoryTree"

const ROOT_ID = "__root__"

export default function NewCategoryPage() {
  const navigate = useNavigate()
  const { nodes, ARCHIVE_ID } = useCategoryTree()

  const [name, setName] = useState("")
  const [selectedParentId, setSelectedParentId] = useState<string | null>(ROOT_ID)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [groupId, setGroupId] = useState<string>("")
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    const loadGroups = async () => {
      // Load visible groups (RLS will filter automatically)
      const { data, error: grpErr } = await supabase
        .from("groups")
        .select("id, name")
        .order("name")

      if (grpErr) {
        setError(grpErr.message)
        return
      }

      const rows = (data as any[]) ?? []
      const list = rows
        .map((r) => ({ id: r.id as string, name: r.name as string }))
        .filter((g) => !!g.id && !!g.name)

      setGroups(list)
      
      // Set default to first visible group (or user's primary group if preferred)
      if (!groupId && list.length > 0) {
        setGroupId(list[0].id)
      }
      
      if (list.length === 0) {
        setError("No groups available. You must be a member of at least one group to create categories.")
      }
    }

    loadGroups()
  }, [])

  const treeWithRoot = useMemo(() => {
    return [
      ...nodes,
      {
        id: ROOT_ID,
        label: "Top Level",
        parentId: null,
      },
    ]
  }, [nodes])

  const isArchivedNode = (node: { id: string; parentId: string | null }) =>
    node.id === ARCHIVE_ID || node.parentId === ARCHIVE_ID

  const handleCreate = async () => {
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Category name is required.")
      return
    }

    if (!groupId) {
      setError("Missing group_id for new category.")
      return
    }

    const parentToSave = selectedParentId === ROOT_ID ? null : selectedParentId

    setSaving(true)

    const { data, error: insertError } = await supabase
      .from("task_categories")
      .insert({
        name: trimmed,
        parent_id: parentToSave,
        is_archived: false,
        group_id: groupId,
      })
      .select("id")
      .single()

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    const newId = (data as any)?.id as string | undefined
    if (!newId) {
      setError("Category created, but no ID returned.")
      return
    }

    // Replace New Category page so Back returns to the assignment screen.
    navigate(`/categories/${newId}`, { replace: true })
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

      <div style={{ fontWeight: 600, marginBottom: 8 }}>New Category</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 12 }}>
          {error}
        </div>
      )}

      <label>Name:</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
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

      <hr />

      <div style={{ marginBottom: 8, fontWeight: 500 }}>Parent Category</div>

      <div style={{ maxHeight: "40vh", overflowY: "auto", marginBottom: 12 }}>
        <TreeDisplay
          nodes={treeWithRoot}
          renderActions={(node) => {
            const disabled = isArchivedNode(node) || node.id === ROOT_ID
            return (
              <input
                type="radio"
                disabled={disabled}
                checked={selectedParentId === node.id}
                onChange={() => setSelectedParentId(node.id)}
                style={{ transform: "scale(1.2)" }}
              />
            )
          }}
        />
      </div>

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

