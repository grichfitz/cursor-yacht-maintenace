import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export type GroupRowFull = {
  id: string
  name: string
  parent_group_id: string | null
  created_at?: string
  archived_at?: string | null
}

export function useSubgroups(parentGroupId: string | null) {
  const [groups, setGroups] = useState<GroupRowFull[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!parentGroupId) {
      setGroups([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from("groups")
      .select("*")
      .eq("parent_group_id", parentGroupId)
      .order("name")
      .limit(10000)

    if (err) {
      setGroups([])
      setError(err.message ?? "Failed to load subgroups.")
      setLoading(false)
      return
    }

    setGroups(((data as any[]) ?? []) as GroupRowFull[])
    setLoading(false)
  }, [parentGroupId])

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

  return { subgroups: groups, loading, error, reload: load }
}

