import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export type YachtRow = {
  id: string
  name: string
  group_id: string
  archived_at: string | null
}

export function useYachts(groupId: string | null) {
  const [yachts, setYachts] = useState<YachtRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!groupId) {
      setYachts([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from("yachts")
      .select("*")
      .eq("group_id", groupId)
      .order("name")
      .limit(10000)

    if (err) {
      setYachts([])
      setError(err.message ?? "Failed to load yachts.")
      setLoading(false)
      return
    }

    setYachts(((data as any[]) ?? []) as YachtRow[])
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

  return { yachts, loading, error, reload: load }
}

