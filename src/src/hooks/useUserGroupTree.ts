import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"

/* ---------- Types ---------- */

type GroupRow = {
  id: string
  name: string
  parent_group_id: string | null
}

type UserRow = {
  id: string
  display_name: string | null
  email: string | null
}

/* ---------- Hook ---------- */

export function useUserGroupTree() {
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
        .select("id, name, parent_group_id")

      if (groupError) {
        setError(groupError.message)
        setLoading(false)
        return
      }

      /* ---------- 2. Load users linked to groups ---------- */

      const { data: links, error: linkError } = await supabase
        .from("user_group_links")
        .select(`
          group_id,
          users (
            id,
            display_name,
            email
          )
        `)

      if (linkError) {
        setError(linkError.message)
        setLoading(false)
        return
      }

      /* ---------- 3. Build group nodes ---------- */

      const groupNodes: TreeNode[] = (groups ?? []).map((g: any) => {
        const group = g as GroupRow

        return {
          id: group.id,
          parentId: group.parent_group_id,
          label: group.name,
          nodeType: "group",
          meta: group,
        }
      })

      /* ---------- 4. Build user nodes (safe boundary handling) ---------- */

      const userNodes: TreeNode[] = (links ?? []).flatMap((l: any) => {
        const users: UserRow[] = Array.isArray(l.users) ? l.users : []

        return users.map((u) => ({
          id: u.id,
          parentId: l.group_id,
          label: u.display_name || u.email || "Unnamed user",
          nodeType: "user",
          meta: u,
        }))
      })

      /* ---------- 5. Combine ---------- */

      setNodes([...groupNodes, ...userNodes])
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
