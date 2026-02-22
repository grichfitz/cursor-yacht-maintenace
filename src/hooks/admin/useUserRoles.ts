import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export type UserRoleRow = {
  roles: { name: string } | null
}

export function useUserRoles(userId: string | null) {
  const [roles, setRoles] = useState<UserRoleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) {
      setRoles([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", userId)
      .limit(1000)

    if (err) {
      setRoles([])
      setError(err.message ?? "Failed to load roles.")
      setLoading(false)
      return
    }

    setRoles(((data as any[]) ?? []) as UserRoleRow[])
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

  return { roles, loading, error, reload: load }
}

