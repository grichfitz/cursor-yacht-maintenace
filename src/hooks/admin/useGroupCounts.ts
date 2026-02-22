import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

type CountState = { count: number | null; loading: boolean; error: string | null; reload: () => Promise<void> }

function useCountQuery(run: () => Promise<number | null>, deps: any[]): CountState {
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const c = await run()
      setCount(c)
      setLoading(false)
    } catch (e: any) {
      setCount(null)
      setError(e?.message || "Failed to load count.")
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    let cancelled = false
    const go = async () => {
      if (cancelled) return
      await load()
    }
    go()
    return () => {
      cancelled = true
    }
  }, [load])

  return { count, loading, error, reload: load }
}

export function useGroupDirectMemberCount(groupId: string | null) {
  return useCountQuery(
    async () => {
      if (!groupId) return null
      const { count, error } = await supabase
        .from("group_memberships")
        .select("user_id", { count: "exact", head: true })
        .eq("group_id", groupId)
      if (error) throw error
      return typeof count === "number" ? count : 0
    },
    [groupId]
  )
}

export function useGroupDirectYachtCount(groupId: string | null) {
  return useCountQuery(
    async () => {
      if (!groupId) return null
      const { count, error } = await supabase.from("yachts").select("id", { count: "exact", head: true }).eq("group_id", groupId)
      if (error) throw error
      return typeof count === "number" ? count : 0
    },
    [groupId]
  )
}

export function useGroupChildGroupCount(groupId: string | null) {
  return useCountQuery(
    async () => {
      if (!groupId) return null
      const { count, error } = await supabase.from("groups").select("id", { count: "exact", head: true }).eq("parent_group_id", groupId)
      if (error) throw error
      return typeof count === "number" ? count : 0
    },
    [groupId]
  )
}

