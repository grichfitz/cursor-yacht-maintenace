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

  const [fullName, setFullName] = useState<string>("")
  const [email, setEmail] = useState<string>("")
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

      try {
        const { data, error } = await supabase
          .from("users")
          .select("id,full_name,email")
          .eq("id", userId)
          .maybeSingle()

        if (error) throw error

        setFullName(String((data as any)?.full_name ?? ""))
        setEmail(String((data as any)?.email ?? ""))
        setUserLoading(false)
      } catch (e: any) {
        setFullName("")
        setEmail("")
        setUserError(e?.message || "Failed to load user.")
        setUserLoading(false)
      }
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

      {userLoading || groupsLoading ? (
        <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>Loading…</div>
      ) : (
        <>
          <div className="card">
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Profile</div>

            <label>Email (read-only):</label>
            <input value={email || userId} disabled style={{ marginBottom: 12, opacity: 0.85 }} />

            <label>Name (read-only):</label>
            <input value={fullName} disabled style={{ opacity: 0.85 }} placeholder="—" />
          </div>

          <div className="card">
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Groups</div>
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
              Toggle groups in the tree below. Changes apply immediately.
            </div>

            <GenericTreeAssignPage
              targetId={userId}
              nodes={nodes}
              mapTable="group_members"
              mapTargetField="user_id"
              mapNodeField="group_id"
            />
          </div>
        </>
      )}
    </div>
  )
}

