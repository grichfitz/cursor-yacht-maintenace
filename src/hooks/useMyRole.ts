import { useCallback, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useFocusReload } from "./useFocusReload"
import { useSession } from "../auth/SessionProvider"

export type AppRole = "admin" | "manager" | "crew" | "owner"

export function useMyRole() {
  const { session } = useSession()
  const [role, setRole] = useState<AppRole>("crew")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    // Safety: if a transient network/auth call stalls, don't leave the UI in "Loading…" forever.
    const timeoutId = window.setTimeout(() => {
      setLoading(false)
    }, 1500)

    try {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setRole("crew")
        setLoading(false)
        return
      }

      const { data, error } = await supabase.rpc("current_user_role")
      if (error) {
        setRole("crew")
        setLoading(false)
        return
      }

      const r = data
      if (r === "admin" || r === "manager" || r === "crew" || r === "owner") setRole(r)
      else setRole("crew")
      setLoading(false)
    } catch {
      setLoading(false)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await load()
    }

    run()
    const sub = supabase.auth.onAuthStateChange((event) => {
      // Avoid resume lag: token refresh fires on app resume; don't flip UI back to loading.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        run()
      }
    })

    return () => {
      cancelled = true
      sub.data.subscription.unsubscribe()
    }
  }, [session])

  useFocusReload(() => {
    void load()
  }, true)

  return { role, loading }
}

