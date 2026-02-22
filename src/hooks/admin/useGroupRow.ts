import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export type GroupRow = {
  id: string
  name: string
  parent_group_id: string | null
  created_at: string
  archived_at: string | null
}

export function useGroupRow(groupId: string | null) {
  const [group, setGroup] = useState<GroupRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!groupId) {
      setGroup(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from("groups")
      .select("id,name,parent_group_id,created_at,archived_at")
      .eq("id", groupId)
      .maybeSingle()

    if (err) {
      setGroup(null)
      setError(err.message ?? "Failed to load group.")
      setLoading(false)
      return
    }

    setGroup((data as any) as GroupRow)
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

  return { group, loading, error, reload: load }
}

