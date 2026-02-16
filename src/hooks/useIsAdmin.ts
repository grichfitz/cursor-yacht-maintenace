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

      // Fallback: use user_roles + roles (avoid legacy/nonexistent user_role_links table).
      const { data: ur, error: urErr } = await supabase
        .from("user_roles")
        .select("role_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (cancelled) return

      if (urErr) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      const roleId = (ur as any)?.role_id ? String((ur as any).role_id) : ""
      if (!roleId) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      const { data: roleRow, error: rErr } = await supabase
        .from("roles")
        .select("name")
        .eq("id", roleId)
        .maybeSingle()

      if (cancelled) return

      if (rErr) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      const name = String((roleRow as any)?.name ?? "").toLowerCase()
      setIsAdmin(name === "admin")
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session])

  return { isAdmin, loading }
}

