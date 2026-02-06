import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"

const ARCHIVE_ID = "__archive__"

type GroupRow = {
  id: string
  name: string
  parent_group_id: string | null
  is_archived: boolean | null
}

export function useGroupTree() {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from("groups")
        .select("id, name, parent_group_id, is_archived")
        .order("name")

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const active: TreeNode[] = []
      const archived: TreeNode[] = []

      for (const g of data as GroupRow[]) {
        const node: TreeNode = {
          id: g.id,
          parentId: g.parent_group_id,
          label: g.name,
          nodeType: "group",
          meta: g,
        }

        if (g.is_archived) archived.push(node)
        else active.push(node)
      }

      // Virtual Archive root (bottom), same pattern as categories
      if (archived.length) {
        active.push({
          id: ARCHIVE_ID,
          label: "Archive",
          parentId: null,
          nodeType: "group",
          meta: { isVirtual: true },
        })

        archived.forEach((a) => (a.parentId = ARCHIVE_ID))
        active.push(...archived)
      }

      setNodes(active)
      setLoading(false)
    }

    load()
  }, [])

  return {
    nodes,
    ARCHIVE_ID,
    loading,
    error,
  }
}
