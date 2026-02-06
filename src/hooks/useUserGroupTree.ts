import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"

/* ---------- Constants ---------- */

const UNASSIGNED_GROUP_ID = "__unassigned_users__"

/* ---------- Types (schema CSV source of truth) ---------- */

type GroupRow = {
  id: string
  name: string
  parent_group_id: string | null
  is_archived: boolean | null
}

type UserRow = {
  id: string
  display_name: string | null
  email: string | null
}

type UserGroupLinkRow = {
  user_id: string
  group_id: string
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
        .select("id, name, parent_group_id, is_archived")
        .order("name")

      if (groupError) {
        setError(groupError.message)
        setLoading(false)
        return
      }

      /* ---------- 2. Load user-group links ---------- */

      const { data: links, error: linkError } = await supabase
        .from("user_group_links")
        .select("user_id, group_id")

      if (linkError) {
        setError(linkError.message)
        setLoading(false)
        return
      }

      /* ---------- 3. Load all users ---------- */

      const { data: users, error: userError } = await supabase
        .from("users")
        .select("id, display_name, email")
        .order("display_name")

      if (userError) {
        setError(userError.message)
        setLoading(false)
        return
      }

      /* ---------- 4. Ignore archived groups in the user tree ---------- */

      const activeGroups = (groups as GroupRow[]).filter((g) => !g.is_archived)
      const activeGroupIds = new Set(activeGroups.map((g) => g.id))

      const activeLinks = (links as UserGroupLinkRow[]).filter((l) =>
        activeGroupIds.has(l.group_id)
      )

      /* ---------- 5. Build lookup maps ---------- */

      const userMap = new Map<string, UserRow>()
      ;(users as UserRow[]).forEach((u) => userMap.set(u.id, u))

      const assignedUserIds = new Set(activeLinks.map((l) => l.user_id))

      /* ---------- 6. Group nodes ---------- */

      const groupNodes: TreeNode[] = activeGroups.map((g) => ({
        id: g.id,
        parentId: g.parent_group_id,
        label: g.name,
        nodeType: "group",
        meta: g,
      }))

      /* ---------- 7. User nodes (assigned) ---------- */

      const userNodes: TreeNode[] = activeLinks
        .map((l) => {
          const u = userMap.get(l.user_id)
          if (!u) return null

          return {
            id: u.id,
            parentId: l.group_id,
            label: u.display_name || u.email || "Unnamed user",
            nodeType: "user",
            meta: u,
          } as TreeNode
        })
        .filter(Boolean) as TreeNode[]

      /* ---------- 8. Unassigned users ---------- */

      const unassignedUsers: TreeNode[] = (users as UserRow[])
        .filter((u) => !assignedUserIds.has(u.id))
        .map((u) => ({
          id: u.id,
          parentId: UNASSIGNED_GROUP_ID,
          label: u.display_name || u.email || "Unnamed user",
          nodeType: "user",
          meta: u,
        }))

      const unassignedGroupNode: TreeNode | null =
        unassignedUsers.length > 0
          ? {
              id: UNASSIGNED_GROUP_ID,
              parentId: null,
              label: "Unassigned users",
              nodeType: "group",
              meta: { isVirtual: true },
            }
          : null

      /* ---------- 9. Combine ---------- */

      setNodes([
        ...groupNodes,
        ...(unassignedGroupNode ? [unassignedGroupNode] : []),
        ...userNodes,
        ...unassignedUsers,
      ])
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
