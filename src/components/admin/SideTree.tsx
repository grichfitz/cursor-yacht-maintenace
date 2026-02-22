import React, { useCallback, useMemo, useRef } from "react"

export type SideTreeNode = {
  id: string
  parentId: string | null
  label: string
  meta?: React.ReactNode
}

type FlatNode = SideTreeNode & { depth: number }

function buildChildrenMap(nodes: SideTreeNode[]) {
  const m = new Map<string, SideTreeNode[]>()
  for (const n of nodes) {
    const key = n.parentId ?? "__root__"
    const arr = m.get(key) ?? []
    arr.push(n)
    m.set(key, arr)
  }
  for (const [k, arr] of m) {
    arr.sort((a, b) => a.label.localeCompare(b.label))
    m.set(k, arr)
  }
  return m
}

function flattenTree(nodes: SideTreeNode[]) {
  const childrenMap = buildChildrenMap(nodes)
  const out: FlatNode[] = []

  const visit = (n: SideTreeNode, depth: number) => {
    out.push({ ...n, depth })
    const children = childrenMap.get(n.id) ?? []
    for (const c of children) visit(c, depth + 1)
  }

  for (const root of childrenMap.get("__root__") ?? []) visit(root, 0)
  return out
}

type SideTreeProps = {
  nodes: SideTreeNode[]
  selectedId?: string
  onSelectId?: (id: string) => void
  emptyLabel?: string
}

export default function SideTree({ nodes, selectedId, onSelectId, emptyLabel }: SideTreeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const flat = useMemo(() => flattenTree(nodes), [nodes])
  const selectedIndex = useMemo(() => flat.findIndex((n) => n.id === selectedId), [flat, selectedId])

  const selectByIndex = useCallback(
    (idx: number) => {
      const n = flat[idx]
      if (!n) return
      onSelectId?.(n.id)
      const row = containerRef.current?.querySelector(`[data-node-id="${n.id}"]`) as HTMLElement | null
      row?.scrollIntoView({ block: "nearest" })
    },
    [flat, onSelectId]
  )

  if (flat.length === 0) {
    return <div className="admin-empty">{emptyLabel ?? "No items returned by RLS."}</div>
  }

  return (
    <div
      ref={containerRef}
      className="side-tree"
      tabIndex={0}
      role="listbox"
      aria-label="Tree"
      onKeyDown={(e) => {
        if (flat.length === 0) return
        if (e.key === "ArrowDown") {
          e.preventDefault()
          selectByIndex(Math.min(flat.length - 1, Math.max(0, selectedIndex) + 1))
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          selectByIndex(Math.max(0, Math.max(0, selectedIndex) - 1))
        } else if (e.key === "Home") {
          e.preventDefault()
          selectByIndex(0)
        } else if (e.key === "End") {
          e.preventDefault()
          selectByIndex(flat.length - 1)
        } else if (e.key === "Enter" && selectedIndex >= 0) {
          e.preventDefault()
          selectByIndex(selectedIndex)
        }
      }}
    >
      {flat.map((n) => {
        const selected = n.id === selectedId
        return (
          <div
            key={`${n.id}:${n.parentId ?? "root"}`}
            data-node-id={n.id}
            className={`side-tree-row ${selected ? "selected" : ""}`.trim()}
            role="option"
            aria-selected={selected}
            style={{ paddingLeft: 10 + n.depth * 16 }}
            onClick={() => onSelectId?.(n.id)}
          >
            <div className="side-tree-label">{n.label}</div>
            {n.meta ? <div className="side-tree-meta">{n.meta}</div> : null}
          </div>
        )
      })}
    </div>
  )
}

