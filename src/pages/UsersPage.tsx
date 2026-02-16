import React, { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import EditorNav from "./editor/EditorNav"
import TreeDisplay, { type TreeNode } from "../components/TreeDisplay"
import { useUserGroupTree } from "../hooks/useUserGroupTree"
import { Folder, User as UserIcon } from "lucide-react"
import { pickBadgeVariant } from "../ui/badgeColors"

export default function UsersPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState("")

  const { nodes, loading, error } = useUserGroupTree()

  const visibleNodes = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return nodes as TreeNode[]

    const byId = new Map<string, TreeNode>()
    ;(nodes as TreeNode[]).forEach((n) => byId.set(n.id, n))

    const keep = new Set<string>()
    const matches = (nodes as TreeNode[]).filter((n) => {
      if (n.nodeType !== "user") return false
      const full = String(n.meta?.full_name ?? "")
      const email = String(n.meta?.email ?? "")
      const hay = `${full} ${email} ${n.label} ${n.meta?.user_id ?? ""}`.toLowerCase()
      return hay.includes(q)
    })

    for (const n of matches) {
      keep.add(n.id)
      let cur: TreeNode | undefined = n
      let guard = 0
      while (cur?.parentId && guard < 50) {
        guard++
        keep.add(cur.parentId)
        cur = byId.get(cur.parentId)
      }
    }

    return (nodes as TreeNode[]).filter((n) => keep.has(n.id))
  }, [nodes, filter])

  const defaultExpandedIds = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = visibleNodes as TreeNode[]
    if (q) {
      return list.filter((n) => n.nodeType === "group").map((n) => n.id)
    }
    return list.filter((n) => n.nodeType === "group" && n.parentId === null).map((n) => n.id)
  }, [visibleNodes, filter])

  const userCount = useMemo(() => {
    return (visibleNodes as TreeNode[]).filter((n) => n.nodeType === "user").length
  }, [visibleNodes])

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Editor · Users</div>
      <div className="screen-subtitle">Admin-only.</div>

      {loading ? <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>Loading…</div> : null}
      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div>
      )}

      <div className="card" style={{ paddingBottom: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Directory</div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name or email…"
          style={{ width: "100%" }}
        />
      </div>

      <div className="card card-list">
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Directory</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{userCount}</div>
        </div>

        {!loading && userCount === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No matching users.</div>
        ) : (
          <div style={{ padding: 6 }}>
            <TreeDisplay
              nodes={visibleNodes as TreeNode[]}
              defaultExpandedIds={defaultExpandedIds}
              renderIcon={(node) => {
                if (node.nodeType === "group") {
                  const isVirtual = !!node.meta?.isVirtual
                  const variant = isVirtual ? "gray" : pickBadgeVariant(node.id)
                  return (
                    <span className={`tree-icon-badge tree-icon-badge--${variant}`}>
                      <Folder size={16} />
                    </span>
                  )
                }
                if (node.nodeType === "user") {
                  const variant = pickBadgeVariant(node.parentId ?? node.id)
                  return (
                    <span className={`tree-icon-badge tree-icon-badge--${variant} tree-icon-badge--solid`}>
                      <UserIcon size={16} />
                    </span>
                  )
                }
                return null
              }}
              renderLabel={(node) => {
                if (node.nodeType !== "user") return <span>{node.label}</span>
                const full = String(node.meta?.full_name ?? "").trim()
                const email = String(node.meta?.email ?? "").trim()
                const primary = full || email || String(node.meta?.user_id ?? node.id)
                const secondary = full ? email : ""
                return (
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                    {/* Use <strong> + 700 for consistent bold rendering on Windows fonts */}
                    <strong style={{ fontWeight: 700 }}>{primary}</strong>
                    {secondary ? <div style={{ fontSize: 12, opacity: 0.75 }}>{secondary}</div> : null}
                  </div>
                )
              }}
              renderActions={(node) => {
                if (node.nodeType !== "user") return null
                const userId = String(node.meta?.user_id ?? "")
                if (!userId) return null
                return (
                  <button type="button" className="secondary" onClick={() => navigate(`/users/${userId}`)}>
                    Edit
                  </button>
                )
              }}
              onSelect={(node) => {
                if (node.nodeType !== "user") return
                const userId = String(node.meta?.user_id ?? "")
                if (!userId) return
                navigate(`/users/${userId}`)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

