import React from "react"
import { supabase } from "../lib/supabase"

export default function MorePage() {
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
            <div className="list-button-subtitle">Sign out of this device</div>
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

