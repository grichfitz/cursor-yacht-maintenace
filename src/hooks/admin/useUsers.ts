import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export type UserRowMinimal = {
  id: string
  email: string
}

export function useUsers() {
  const [users, setUsers] = useState<UserRowMinimal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from("users")
      .select("id,email")
      .order("email")
      .limit(10000)

    if (err) {
      setUsers([])
      setError(err.message ?? "Failed to load users.")
      setLoading(false)
      return
    }

    setUsers(((data as any[]) ?? []) as UserRowMinimal[])
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

  return { users, loading, error, reload: load }
}

