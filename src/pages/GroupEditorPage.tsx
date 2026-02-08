import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import TreeDisplay from "../components/TreeDisplay"
import { useGroupTree } from "../hooks/useGroupTree"

const ROOT_ID = "__root__"

type GroupRow = {
  id: string
  name: string
  description: string | null
  parent_group_id: string | null
  is_archived: boolean | null
}

export default function GroupEditorPage() {
  const navigate = useNavigate()
  const { groupId } = useParams<{ groupId: string }>()
  const { nodes } = useGroupTree()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [isArchived, setIsArchived] = useState(false)

  useEffect(() => {
    if (!groupId) return

    supabase
      .from("groups")
      .select("id,name,description,parent_group_id,is_archived")
      .eq("id", groupId)
      .single()
      .then(({ data }) => {
        const row = data as GroupRow | null
        if (!row) return

        setName(row.name)
        setDescription(row.description ?? "")
        setSelectedParentId(row.parent_group_id ?? ROOT_ID)
        setIsArchived(!!row.is_archived)
      })
  }, [groupId])

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

    const parentToSave = selectedParentId === ROOT_ID ? null : selectedParentId

    await supabase
      .from("groups")
      .update({
        name,
        description: description || null,
        parent_group_id: parentToSave,
      })
      .eq("id", groupId)

    navigate(-1)
  }

  const toggleArchive = async () => {
    if (!groupId) return

    await supabase
      .from("groups")
      .update({ is_archived: !isArchived })
      .eq("id", groupId)

    navigate(-1)
  }

  if (!groupId) return null

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

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Group Editor</div>

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

      <div style={{ marginBottom: 8, fontWeight: 500 }}>Move Group</div>

      <div style={{ maxHeight: "40vh", overflowY: "auto", marginBottom: 12 }}>
        <TreeDisplay
          nodes={treeWithRoot}
          renderActions={(node) => {
            const disabled = forbiddenTargets.has(node.id)
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

      <div style={{ marginTop: 20 }}>
        <button
          onClick={save}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: 8,
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            fontWeight: 600,
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          Save
        </button>
      </div>

      <hr />

      <div style={{ marginBottom: 20 }}>
        <button
          onClick={toggleArchive}
          style={{
            background: "var(--border-subtle)",
            border: "none",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          {isArchived ? "Un-archive Group" : "Archive Group"}
        </button>
      </div>
    </div>
  )
}

