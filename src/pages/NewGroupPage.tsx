import React, { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import TreeDisplay from "../components/TreeDisplay"
import { useGroupTree } from "../hooks/useGroupTree"

const ROOT_ID = "__root__"

export default function NewGroupPage() {
  const navigate = useNavigate()
  const { nodes, ARCHIVE_ID } = useGroupTree()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedParentId, setSelectedParentId] = useState<string | null>(ROOT_ID)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const treeWithRoot = useMemo(() => {
    return [
      ...nodes.map((n) => ({ id: n.id, label: n.label, parentId: n.parentId })),
      { id: ROOT_ID, label: "Top Level", parentId: null },
    ]
  }, [nodes])

  const isArchivedNode = (node: { id: string; parentId: string | null }) =>
    node.id === ARCHIVE_ID || node.parentId === ARCHIVE_ID

  const handleCreate = async () => {
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Group name is required.")
      return
    }

    const parentToSave = selectedParentId === ROOT_ID ? null : selectedParentId

    setSaving(true)

    const { data, error: insertError } = await supabase
      .from("groups")
      .insert({
        name: trimmed,
        description: description.trim() ? description.trim() : null,
        parent_group_id: parentToSave,
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
      setError("Group created, but no ID returned.")
      return
    }

    // Replace New Group page so Back returns to the assignment screen.
    navigate(`/groups/${newId}`, { replace: true })
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

      <div style={{ fontWeight: 600, marginBottom: 8 }}>New Group</div>

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

      <label>Description:</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        style={{ marginBottom: 12 }}
      />

      <hr />

      <div style={{ marginBottom: 8, fontWeight: 500 }}>Parent Group</div>

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

