import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import EditorNav from "./EditorNav"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import { useGroupTree } from "../../hooks/useGroupTree"
import GenericTreeAssignPage from "../GenericTreeAssignPage"

export default function EditorUserGroupsPage() {
  const { session } = useSession()
  const { userId } = useParams<{ userId: string }>()
  const { nodes, loading: groupsLoading, error: groupsError } = useGroupTree()

  const [userLabel, setUserLabel] = useState<string>("")
  const [userLoading, setUserLoading] = useState(true)
  const [userError, setUserError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    if (!userId) return
    let cancelled = false

    const loadUser = async () => {
      setUserLoading(true)
      setUserError(null)

      if (cancelled) return

      setUserLabel(userId)
      setUserLoading(false)
    }

    loadUser()
    return () => {
      cancelled = true
    }
  }, [session, userId])

  if (!userId) return null

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Editor · User Groups</div>
      <div className="screen-subtitle">Admin-only.</div>

      {userError ? (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {userError}
        </div>
      ) : null}

      {groupsError ? (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {groupsError}
        </div>
      ) : null}

      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 6 }}>
          Assign groups{userLabel ? ` for ${userLabel}` : ""}
        </div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Changes apply immediately (no separate Save button).
        </div>
      </div>

      {userLoading || groupsLoading ? (
        <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>Loading…</div>
      ) : (
        <div className="card" style={{ padding: 12 }}>
          <GenericTreeAssignPage
            targetId={userId}
            nodes={nodes}
            mapTable="group_memberships"
            mapTargetField="user_id"
            mapNodeField="group_id"
          />
        </div>
      )}
    </div>
  )
}

