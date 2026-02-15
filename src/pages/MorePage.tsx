import React, { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"

export default function MorePage() {
  const { session } = useSession()
  const [userLabel, setUserLabel] = useState<string>("")

  useEffect(() => {
    if (!session) return
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setUserLabel("")
        return
      }

      const displayName = (user.user_metadata as any)?.display_name as string | null | undefined
      setUserLabel((displayName?.trim() || user.email || "").trim())
    }

    load()
  }, [session])

  return (
    <div className="screen">
      <div className="screen-title">More</div>

      <div className="card">
        <button
          type="button"
          className="list-button"
          onClick={async () => {
            await supabase.auth.signOut()
          }}
        >
          <div className="list-button-main">
            <div className="list-button-title">Logout</div>
            {userLabel ? (
              <div
                className="list-button-subtitle"
                style={{
                  color: "var(--text-primary)",
                  opacity: 0.85,
                  wordBreak: "break-word",
                }}
              >
                {userLabel}
              </div>
            ) : null}
          </div>
          <div className="list-button-chevron">›</div>
        </button>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          © Worthy Marine
        </div>
      </div>
    </div>
  )
}

