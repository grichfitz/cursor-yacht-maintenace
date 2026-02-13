import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"

export function useIsAdmin() {
  const { session } = useSession()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const load = async () => {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) {
          setIsAdmin(false)
          setLoading(false)
        }
        return
      }

      // Prefer the authoritative SQL helper if available.
      const { data: rpcData, error: rpcErr } = await supabase.rpc("is_admin")
      if (!cancelled && !rpcErr && typeof rpcData === "boolean") {
        setIsAdmin(rpcData)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("user_role_links")
        .select("roles(name)")
        .eq("user_id", user.id)

      if (!cancelled) {
        if (error) {
          setIsAdmin(false)
          setLoading(false)
          return
        }

        const admin =
          (data as any[])?.some(
            (r: any) => r?.roles?.name?.toLowerCase() === "admin"
          ) ?? false
        setIsAdmin(admin)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session])

  return { isAdmin, loading }
}

