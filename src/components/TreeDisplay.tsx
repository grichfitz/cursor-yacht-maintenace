import { useState, useMemo } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

export type TreeNode = {
  id: string
  parentId: string | null
  label: string
  nodeType?: string
  meta?: any
}

type TreeDisplayProps = {
  nodes: TreeNode[]
  selectedId?: string
  onSelect?: (node: TreeNode) => void
  renderActions?: (node: TreeNode) => React.ReactNode
  renderIcon?: (node: TreeNode) => React.ReactNode
  className?: string
}

export default function TreeDisplay({
  nodes,
  selectedId,
  onSelect,
  renderActions,
  renderIcon,
  className,
}: TreeDisplayProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  /* ---------- Build adjacency list ---------- */
  const childrenMap = useMemo(() => {
    const map: Record<string, TreeNode[]> = {}

    for (const node of nodes) {
      const key = node.parentId ?? "__root__"
      if (!map[key]) map[key] = []
      map[key].push(node)
    }

    return map
  }, [nodes])

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const renderNode = (node: TreeNode, depth = 0) => {
    const children = childrenMap[node.id] || []
    const hasChildren = children.length > 0
    const isExpanded = expanded[node.id]
    const isSelected = node.id === selectedId

    return (
      <div key={node.id}>
        <div
          className={`tree-row ${isSelected ? "selected" : ""}`}
          style={{ paddingLeft: depth * 16 }}
        >
          {/* ---------- Chevron / spacer ---------- */}
          {hasChildren ? (
            <div
              className="tree-chevron"
              onClick={(e) => {
                e.stopPropagation()
                toggle(node.id)
              }}
              aria-label="Toggle"
            >
              {isExpanded ? (
                <ChevronDown size={16} strokeWidth={2} />
              ) : (
                <ChevronRight size={16} strokeWidth={2} />
              )}
            </div>
          ) : (
            <div className="tree-chevron spacer" />
          )}

          {/* ---------- Label ---------- */}
          <div
            className="tree-label"
            onClick={() => {
              if (hasChildren) toggle(node.id)
              onSelect?.(node)
            }}
          >
            {renderIcon?.(node)}
            <span>{node.label}</span>
          </div>

          {/* ---------- Actions ---------- */}
          {renderActions && (
            <div className="tree-actions">
              {renderActions(node)}
            </div>
          )}
        </div>

        {/* ---------- Children ---------- */}
        {hasChildren && isExpanded &&
          children.map((child) =>
            renderNode(child, depth + 1)
          )}
      </div>
    )
  }

  return (
    <div className={`tree-container ${className ?? ""}`}>
      {(childrenMap["__root__"] || []).map((node) =>
        renderNode(node)
      )}
    </div>
  )
}
