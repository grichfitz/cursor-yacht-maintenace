import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export type AccessibleGroupRow = {
  group_id: string
}

export function useUserAccessibleGroups(userId: string | null) {
  const [groups, setGroups] = useState<AccessibleGroupRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) {
      setGroups([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase.rpc("user_accessible_groups", {
      uid: userId,
    })

    if (err) {
      setGroups([])
      setError(err.message ?? "Failed to load accessible groups.")
      setLoading(false)
      return
    }

    setGroups(((data as any[]) ?? []) as AccessibleGroupRow[])
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

  return { groups, loading, error, reload: load }
}

