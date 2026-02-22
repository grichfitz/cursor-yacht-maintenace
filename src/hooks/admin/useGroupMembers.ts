import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export type GroupMembershipRow = {
  created_at: string
  group_id: string
  user_id: string
  users?: {
    id: string
    email: string
    user_roles?: { roles?: { name: string } | null } | null
  } | null
}

export function useGroupMembers(groupId: string | null) {
  const [members, setMembers] = useState<GroupMembershipRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!groupId) {
      setMembers([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from("group_memberships")
      // Best-effort embed (contract expects users(id,email); role embed may be unavailable depending on FK exposure).
      .select("created_at,group_id,user_id,users(id,email,user_roles(roles(name)))")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(10000)

    if (err) {
      setMembers([])
      setError(err.message ?? "Failed to load members.")
      setLoading(false)
      return
    }

    setMembers(((data as any[]) ?? []) as GroupMembershipRow[])
    setLoading(false)
  }, [groupId])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await load()
    }
    run()
    return () => {
      cancelled = true
    }
  }, [load])

  return { members, loading, error, reload: load }
}

