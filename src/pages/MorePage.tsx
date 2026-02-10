import React, { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function MorePage() {
  const [userLabel, setUserLabel] = useState<string>("")

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setUserLabel("")
        return
      }

      // Prefer directory display_name if available; fall back to auth email.
      const { data } = await supabase
        .from("users")
        .select("display_name, email")
        .eq("id", user.id)
        .single()

      const displayName = (data as any)?.display_name as string | null | undefined
      const email = (data as any)?.email as string | null | undefined

      setUserLabel((displayName?.trim() || email?.trim() || user.email || "").trim())
    }

    load()
  }, [])

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

