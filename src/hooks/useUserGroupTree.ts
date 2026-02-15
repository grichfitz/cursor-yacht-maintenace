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
  display_name: string | null
  email: string | null
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
        parentId: null,
        label: g.name,
        nodeType: "group",
        meta: g,
      }))

      /* ---------- 5. Combine ---------- */

      // No user directory table, so we only render group nodes here.
      setNodes(groupNodes)
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
