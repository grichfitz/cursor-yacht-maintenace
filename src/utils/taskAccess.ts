import { supabase } from "../lib/supabase"
import { loadManagerScopeGroupIds } from "./groupScope"

type GroupMemberRow = { group_id: string }
type YachtRow = { id: string }

/**
 * Yacht visibility:
 * - Prefer RPC `user_group_ids()` (includes descendants) when available
 * - Fallback to direct memberships (group_memberships and/or group_members)
 */
export async function loadAccessibleYachtIds(userId: string): Promise<string[]> {
  // Try to include descendant groups via RPC where available.
  let groupIdList: string[] = []
  try {
    groupIdList = await loadManagerScopeGroupIds(userId)
  } catch {
    groupIdList = []
  }

  // Fallback: direct memberships only (non-recursive).
  if (groupIdList.length === 0) {
    const groupIds = new Set<string>()

    const [m1, m2] = await Promise.allSettled([
      supabase.from("group_memberships").select("group_id").eq("user_id", userId),
      supabase.from("group_members").select("group_id").eq("user_id", userId),
    ])

    if (m1.status === "fulfilled") {
      const { data, error } = m1.value
      if (error) throw error
      ;((data as GroupMemberRow[]) ?? []).forEach((r) => {
        if (r?.group_id) groupIds.add(r.group_id)
      })
    }

    if (m2.status === "fulfilled") {
      const { data, error } = m2.value
      if (error) throw error
      ;((data as GroupMemberRow[]) ?? []).forEach((r) => {
        if (r?.group_id) groupIds.add(r.group_id)
      })
    }

    groupIdList = Array.from(groupIds)
  }

  if (groupIdList.length === 0) return []

  const { data: yachts, error: yErr } = await supabase
    .from("yachts")
    .select("id")
    .in("group_id", groupIdList)

  if (yErr) throw yErr

  return Array.from(new Set(((yachts as YachtRow[]) ?? []).map((y) => y.id).filter(Boolean)))
}

