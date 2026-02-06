import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"

/* ---------- Constants ---------- */

const UNASSIGNED_GROUP_ID = "__unassigned_yachts__"

/* ---------- DB Row Types ---------- */

type GroupRow = {
  id: string
  name: string
  parent_group_id: string | null
  is_archived: boolean | null
}

type YachtRow = {
  id: string
  name: string
  make_model: string | null
  location: string | null
}

type YachtGroupLinkRow = {
  yacht_id: string
  group_id: string
}

/* ---------- Hook ---------- */

export function useYachtGroupTree() {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      /* ---------- 1. Load groups ---------- */

      const { data: groups, error: groupError } = await supabase
        .from("groups")
        .select("id, name, parent_group_id, is_archived")
        .order("name")

      if (groupError) {
        setError(groupError.message)
        setLoading(false)
        return
      }

      /* ---------- 2. Load yacht-group links ---------- */

      const { data: links, error: linkError } = await supabase
        .from("yacht_group_links")
        .select("yacht_id, group_id")

      if (linkError) {
        setError(linkError.message)
        setLoading(false)
        return
      }

      /* ---------- 3. Load all yachts ---------- */

      const { data: yachts, error: yachtError } = await supabase
        .from("yachts")
        .select("id, name, make_model, location")
        .order("name")

      if (yachtError) {
        setError(yachtError.message)
        setLoading(false)
        return
      }

      /* ---------- 4. Build lookup sets ---------- */

      // Ignore archived groups in the yacht tree (archive is an admin concern).
      const activeGroups = (groups as GroupRow[]).filter((g) => !g.is_archived)
      const activeGroupIds = new Set(activeGroups.map((g) => g.id))

      const activeLinks = (links as YachtGroupLinkRow[]).filter((l) =>
        activeGroupIds.has(l.group_id)
      )

      const assignedYachtIds = new Set(activeLinks.map((l) => l.yacht_id))

      const yachtMap = new Map<string, YachtRow>()
      ;(yachts as YachtRow[]).forEach((y) => {
        yachtMap.set(y.id, y)
      })

      /* ---------- 5. Group nodes ---------- */

      const groupNodes: TreeNode[] =
        activeGroups.map((g) => ({
          id: g.id,
          parentId: g.parent_group_id,
          label: g.name,
          nodeType: "group",
          meta: g,
        }))

      /* ---------- 6. Yacht nodes (assigned) ---------- */

      const yachtNodes: TreeNode[] =
        activeLinks
          .map((l) => {
            const yacht = yachtMap.get(l.yacht_id)
            if (!yacht) return null

            return {
              id: yacht.id,
              parentId: l.group_id,
              label: yacht.name,
              nodeType: "yacht",
              meta: yacht,
            } as TreeNode
          })
          .filter(Boolean) as TreeNode[]

      /* ---------- 7. Unassigned yachts ---------- */

      const unassignedYachts: TreeNode[] =
        (yachts as YachtRow[])
          .filter((y) => !assignedYachtIds.has(y.id))
          .map((y) => ({
            id: y.id,
            parentId: UNASSIGNED_GROUP_ID,
            label: y.name,
            nodeType: "yacht",
            meta: y,
          }))

      const unassignedGroupNode: TreeNode | null =
        unassignedYachts.length > 0
          ? {
              id: UNASSIGNED_GROUP_ID,
              parentId: null,
              label: "Unassigned yachts",
              nodeType: "group",
              meta: { isVirtual: true },
            }
          : null

      /* ---------- 8. Combine & publish ---------- */

      const allNodes: TreeNode[] = [
        ...groupNodes,
        ...(unassignedGroupNode ? [unassignedGroupNode] : []),
        ...yachtNodes,
        ...unassignedYachts,
      ]

      setNodes(allNodes)
      setLoading(false)
    }

    load()
  }, [])

  return {
    nodes,
    loading,
    error,
  }
}
