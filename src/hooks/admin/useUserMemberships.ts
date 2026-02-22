import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export type UserMembershipRow = {
  created_at: string
  group_id: string
  user_id: string
}

export function useUserMemberships(userId: string | null) {
  const [memberships, setMemberships] = useState<UserMembershipRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) {
      setMemberships([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from("group_memberships")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10000)

    if (err) {
      setMemberships([])
      setError(err.message ?? "Failed to load memberships.")
      setLoading(false)
      return
    }

    setMemberships(((data as any[]) ?? []) as UserMembershipRow[])
    setLoading(false)
  }, [userId])

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

  return { memberships, loading, error, reload: load }
}

