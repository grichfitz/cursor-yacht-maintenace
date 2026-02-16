import React from "react"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { Pencil } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"
import { useIsAdmin } from "../hooks/useIsAdmin"

type Props = {
  targetId: string
  nodes: TreeNode[]
  mapTable: string
  mapTargetField: string
  mapNodeField: string
  editBasePath?: string
}

export default function GenericTreeAssignPage({
  targetId,
  nodes,
  mapTable,
  mapTargetField,
  mapNodeField,
  editBasePath
}: Props) {
  const navigate = useNavigate()
  const { session } = useSession()
  const [checked, setChecked] = useState<string[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const { isAdmin } = useIsAdmin()

  // Check if this is user-group assignment (admin/service only per RLS_DESIGN.md)
  const isUserGroupAssignment = mapTable === "group_members"

  const checkedSet = useMemo(() => new Set(checked), [checked])

  // For hierarchical trees (e.g. groups), show parents as indeterminate when any descendant is checked.
  // This keeps "checked" meaning *direct* membership/assignment, while reflecting subtree membership visually.
  const descendantAnyCheckedById = useMemo(() => {
    const childrenById: Record<string, string[]> = {}
    for (const n of nodes) {
      if (!n.parentId) continue
      ;(childrenById[n.parentId] ??= []).push(n.id)
    }

    const memo: Record<string, boolean> = {}
    const visiting = new Set<string>()

    const anyChecked = (id: string): boolean => {
      if (memo[id] !== undefined) return memo[id]
      if (visiting.has(id)) return false // safety against cycles
      visiting.add(id)

      const direct = checkedSet.has(id)
      const kids = childrenById[id] ?? []
      const anyKid = kids.some((k) => anyChecked(k))

      visiting.delete(id)
      memo[id] = direct || anyKid
      return memo[id]
    }

    // Fill memo for all nodes
    for (const n of nodes) anyChecked(n.id)

    // Convert to "descendant-only" (exclude direct check on self)
    const out: Record<string, boolean> = {}
    for (const n of nodes) {
      const kids = childrenById[n.id] ?? []
      out[n.id] = kids.some((k) => anyChecked(k))
    }
    return out
  }, [nodes, checkedSet])

  useEffect(() => {
    if (!session) return
    supabase
      .from(mapTable)
      .select(mapNodeField)
      .eq(mapTargetField, targetId)
      .then(({ data, error }) => {
        if (error) {
          console.error("Error loading assignments:", error)
          return
        }
        setChecked((data as any[])?.map(r => r[mapNodeField]) ?? [])
      })
  }, [targetId, mapTable, mapTargetField, mapNodeField, session])

  // Canonical access model is flat; no recursive/descendant assignment logic.

  const toggle = async (id: string) => {
    // Prevent multiple rapid clicks
    if (loading === id) {
      return
    }
    
    // Block user-group assignment for non-admins (admin/service only per RLS_DESIGN.md)
    if (isUserGroupAssignment && !isAdmin) {
      alert("User-group assignment is restricted. Only administrators can modify user-group memberships.")
      return
    }
    
    const shouldCheck = !checked.includes(id)
    const autoAssignChildrenOnCheck = false
    const idsToCheck = [id]

    setLoading(id)
    
    // Checkbox mode
    setChecked((prev) => {
      if (!shouldCheck) return prev.filter((x) => x !== id)
      return [...prev, id]
    })

    if (shouldCheck) {
      // Standard many-to-many upsert
      const payload = [{ [mapTargetField]: targetId, [mapNodeField]: id }]

      const { error } = await supabase.from(mapTable).upsert(payload)

      if (error) {
        console.error("Error upserting assignment:", error)
        // Resync from DB so UI matches server state
        const { data: reloadData } = await supabase
          .from(mapTable)
          .select(mapNodeField)
          .eq(mapTargetField, targetId)
        setChecked((reloadData as any[])?.map((r) => r[mapNodeField]) ?? [])
      }
    } else {
      // Unchecking/unassigning
      // Checkbox mode: delete specific assignment
      const { error } = await supabase
        .from(mapTable)
        .delete()
        .eq(mapTargetField, targetId)
        .eq(mapNodeField, id)

      if (error) {
        console.error("Error deleting assignment:", error)
        setChecked((prev) => [...prev, id])
      }
    }
    
    setLoading(null)
  }

  return (
    <TreeDisplay
      nodes={nodes}
      renderActions={(node) => {
        const isVirtual = node.id.startsWith("__")

        // Checkbox mode: explicit membership only, but show indeterminate when a descendant is checked.
        const isChecked = checkedSet.has(node.id)
        const isIndeterminate = !isChecked && !!descendantAnyCheckedById[node.id]

        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={isChecked}
              disabled={isVirtual || loading === node.id || (isUserGroupAssignment && !isAdmin)}
              ref={(el) => {
                if (el) el.indeterminate = isIndeterminate
              }}
              onClick={(e) => {
                e.stopPropagation()
              }}
              onChange={(e) => {
                e.stopPropagation()
                if (!isVirtual && (!isUserGroupAssignment || isAdmin)) {
                  toggle(node.id)
                } else if (isUserGroupAssignment && !isAdmin) {
                  alert("User-group assignment is restricted. Only administrators can modify user-group memberships.")
                }
              }}
            />

            {editBasePath && !isVirtual && (
              <div
                className="tree-action-icon"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`${editBasePath}/${node.id}`)
                }}
              >
                <Pencil size={14} />
              </div>
            )}
          </div>
        )
      }}
    />
  )
}
