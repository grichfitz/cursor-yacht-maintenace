import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import GenericTreeAssignPage from "./GenericTreeAssignPage"
import { useGroupTree } from "../hooks/useGroupTree"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"

export default function UserGroupAssignPage() {
  const navigate = useNavigate()
  const { userId } = useParams<{ userId: string }>()
  const { session } = useSession()
  const { nodes } = useGroupTree()

  const [isAdmin, setIsAdmin] = useState(false)
  const [isSelf, setIsSelf] = useState(false)
  const [memberGroupIds, setMemberGroupIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userLabel, setUserLabel] = useState<string>("")

  useEffect(() => {
    if (!session) return
    if (!userId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) {
          setIsAdmin(false)
          setIsSelf(false)
          setMemberGroupIds([])
          setLoading(false)
        }
        return
      }

      const self = user.id === userId
      if (!cancelled) setIsSelf(self)

      const { data: rolesData } = await supabase
        .from("user_role_links")
        .select("roles(name)")
        .eq("user_id", user.id)

      const admin =
        (rolesData as any[])?.some((r: any) => r?.roles?.name?.toLowerCase() === "admin") ?? false
      if (!cancelled) setIsAdmin(admin)

      // For non-admins, we only support viewing memberships for self.
      if (!admin && !self) {
        if (!cancelled) {
          setError("Only administrators can view or edit other users’ group memberships.")
          setLoading(false)
        }
        return
      }

      // Load the target user's label for clarity (admin flows).
      if (!cancelled) {
        setUserLabel(String(userId))
      }

      const { data: links, error: linkErr } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId)

      if (linkErr) {
        if (!cancelled) {
          setError(linkErr.message)
          setLoading(false)
        }
        return
      }

      if (!cancelled) {
        setMemberGroupIds(((links as any[]) ?? []).map((l) => l.group_id).filter(Boolean))
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId, session])

  const memberGroups = useMemo(() => {
    const set = new Set(memberGroupIds)
    return nodes
      .filter((n) => set.has(n.id))
      .map((n) => n.label)
      .sort((a, b) => a.localeCompare(b))
  }, [nodes, memberGroupIds])

  if (!userId) return null

  return (
    <div
      className="screen"
      style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          className="primary-button"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        Groups{userLabel ? ` for ${userLabel}` : ""}
      </div>

      {!isAdmin ? (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: "rgba(255, 193, 7, 0.1)",
            border: "1px solid rgba(255, 193, 7, 0.3)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        >
          <strong>Note:</strong> Group membership changes are restricted to administrators.
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: "rgba(255, 0, 0, 0.08)",
            border: "1px solid rgba(255, 0, 0, 0.2)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ opacity: 0.75, fontSize: 13 }}>Loading…</div>
      ) : !isAdmin ? (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Your groups</div>
          {memberGroups.length === 0 ? (
            <div style={{ opacity: 0.75, fontSize: 13 }}>No groups.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {memberGroups.map((g) => (
                <li key={g} style={{ marginBottom: 6 }}>
                  {g}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
            <GenericTreeAssignPage
              targetId={userId}
              nodes={nodes}
              // Schema source of truth: group_members(user_id, group_id)
              mapTable="group_members"
              mapTargetField="user_id"
              mapNodeField="group_id"
              editBasePath="/groups"
            />
          </div>

          <hr />

          <div style={{ paddingTop: 6 }}>
            <button
              onClick={() => navigate("/groups/new")}
              style={{
                background: "var(--border-subtle)",
                border: "none",
                borderRadius: 12,
                padding: "4px 10px",
                cursor: "pointer",
                color: "var(--text-primary)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              New Group
            </button>
          </div>
        </>
      )}
    </div>
  )
}

