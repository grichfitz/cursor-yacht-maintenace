import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"

type GroupRow = {
  id: string
  name: string
  parent_group_id: string | null
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
        .select("id, name, parent_group_id")
        .order("name")

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const mapped: TreeNode[] =
        (data as GroupRow[]).map((g) => ({
          id: g.id,
          parentId: g.parent_group_id,
          label: g.name,
          nodeType: "group",
          meta: g,
        }))

      setNodes(mapped)
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
