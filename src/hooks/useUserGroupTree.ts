import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { TreeNode } from "../components/TreeDisplay"
import { useSession } from "../auth/SessionProvider"

/* ---------- Constants ---------- */

const UNASSIGNED_GROUP_ID = "__unassigned_users__"

/* ---------- Types (schema CSV source of truth) ---------- */

type GroupRow = {
  id: string
  name: string
  parent_group_id: string | null
}

type UserRow = {
  id: string
  full_name: string | null
  email: string | null
  archived_at?: string | null
}

type UserGroupLinkRow = {
  user_id: string
  group_id: string
}

/* ---------- Hook ---------- */

export function useUserGroupTree() {
  const { session } = useSession()
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      const timeoutId = window.setTimeout(() => {
        if (!cancelled) setLoading(false)
      }, 1500)

      try {

      /* ---------- 1. Load groups ---------- */

      const { data: groups, error: groupError } = await supabase
        .from("groups")
        .select("id, name, parent_group_id")
        .order("name")

      if (cancelled) return

      if (groupError) {
        setError(groupError.message)
        setLoading(false)
        return
      }

      /* ---------- 2. Load user-group links ---------- */

      const { data: links, error: linkError } = await supabase
        .from("group_members")
        .select("user_id, group_id")

      if (cancelled) return

      if (linkError) {
        setError(linkError.message)
        setLoading(false)
        return
      }

      const groupList = (groups as GroupRow[]) ?? []
      const groupIdSet = new Set(groupList.map((g) => g.id))
      const activeLinks = ((links as UserGroupLinkRow[]) ?? []).filter((l) => groupIdSet.has(l.group_id))

      // Defensive: remove duplicate link rows (prevents duplicate render keys)
      const seenLinkKeys = new Set<string>()
      const activeLinksUnique: UserGroupLinkRow[] = []
      for (const l of activeLinks) {
        const key = `${l.user_id}:${l.group_id}`
        if (seenLinkKeys.has(key)) continue
        seenLinkKeys.add(key)
        activeLinksUnique.push(l)
      }

      /* ---------- 4. Group nodes ---------- */

      const groupNodes: TreeNode[] = groupList.map((g) => ({
        id: g.id,
        parentId: g.parent_group_id && groupIdSet.has(g.parent_group_id) ? g.parent_group_id : null,
        label: g.name,
        nodeType: "group",
        meta: g,
      }))

      /* ---------- 5. Load users ---------- */

      const { data: users, error: userErr } = await supabase
        .from("users")
        .select("id,full_name,email,archived_at")
        .order("full_name", { ascending: true })
        .limit(5000)

      if (cancelled) return

      if (userErr) {
        setError(userErr.message)
        setLoading(false)
        return
      }

      const userList = (((users as any[]) ?? []) as UserRow[]).filter((u) => !u.archived_at)

      const userById = new Map<string, UserRow>()
      userList.forEach((u) => userById.set(u.id, u))

      const groupIdsByUserId = new Map<string, string[]>()
      for (const l of activeLinksUnique) {
        if (!userById.has(l.user_id)) continue
        const arr = groupIdsByUserId.get(l.user_id) ?? []
        arr.push(l.group_id)
        groupIdsByUserId.set(l.user_id, arr)
      }

      const hasUnassignedUsers = userList.some((u) => (groupIdsByUserId.get(u.id) ?? []).length === 0)

      const unassignedNode: TreeNode | null = hasUnassignedUsers
        ? {
            id: UNASSIGNED_GROUP_ID,
            parentId: null,
            label: "Unassigned users",
            nodeType: "group",
            meta: { isVirtual: true },
          }
        : null

      // User nodes: unique ID per (user, group) to avoid collisions when a user is in multiple groups.
      const userNodes: TreeNode[] = []
      for (const u of userList) {
        const groupsForUser = groupIdsByUserId.get(u.id) ?? []
        if (groupsForUser.length === 0) {
          userNodes.push({
            id: `u:${u.id}:${UNASSIGNED_GROUP_ID}`,
            parentId: UNASSIGNED_GROUP_ID,
            label: u.full_name || u.email || u.id,
            nodeType: "user",
            meta: { user_id: u.id, ...u },
          })
          continue
        }
        for (const gid of groupsForUser) {
          userNodes.push({
            id: `u:${u.id}:${gid}`,
            parentId: gid,
            label: u.full_name || u.email || u.id,
            nodeType: "user",
            meta: { user_id: u.id, ...u },
          })
        }
      }

      /* ---------- 6. Combine ---------- */

      setNodes([...(unassignedNode ? [unassignedNode] : []), ...groupNodes, ...userNodes])
      setLoading(false)
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    let lastReloadAt = Date.now()
    let resumeInFlight = false

    load()

    const sub = supabase.auth.onAuthStateChange((event) => {
      // Avoid resume lag: token refresh fires on app resume; don't flip UI back to loading.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load()
      }
    })
    const maybeReloadOnResume = () => {
      const now = Date.now()
      if (resumeInFlight) return
      if (now - lastReloadAt < 60_000) return
      lastReloadAt = now
      resumeInFlight = true
      Promise.resolve(load()).finally(() => {
        resumeInFlight = false
      })
    }
    const onFocus = () => maybeReloadOnResume()
    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeReloadOnResume()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      sub.data.subscription.unsubscribe()
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [session])

  return {
    nodes,
    loading,
    error,
  }
}
