import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export type RoleRow = { id: string; name: string }

export function useRoles() {
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase.from("roles").select("id,name").order("name").limit(1000)

    if (err) {
      setRoles([])
      setError(err.message ?? "Failed to load roles.")
      setLoading(false)
      return
    }

    setRoles(((data as any[]) ?? []) as RoleRow[])
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

  return { roles, loading, error, reload: load }
}

