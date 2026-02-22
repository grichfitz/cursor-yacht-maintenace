import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export type GroupRowMinimal = {
  id: string
  name: string
  parent_group_id: string | null
}

export function useGroups() {
  const [groups, setGroups] = useState<GroupRowMinimal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from("groups")
      .select("id,name,parent_group_id")
      .order("name")
      .limit(10000)

    if (err) {
      setGroups([])
      setError(err.message ?? "Failed to load groups.")
      setLoading(false)
      return
    }

    setGroups(((data as any[]) ?? []) as GroupRowMinimal[])
    setLoading(false)
  }, [])

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

