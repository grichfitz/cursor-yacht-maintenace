import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export type TaskAssignmentRowAny = Record<string, any>

export function useUserAssignedTasks(userId: string | null) {
  const [tasks, setTasks] = useState<TaskAssignmentRowAny[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) {
      setTasks([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from("task_assignments")
      .select("*")
      .eq("assigned_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10000)

    if (err) {
      setTasks([])
      setError(err.message ?? "Failed to load assigned tasks.")
      setLoading(false)
      return
    }

    setTasks(((data as any[]) ?? []) as TaskAssignmentRowAny[])
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

  return { tasks, loading, error, reload: load }
}

