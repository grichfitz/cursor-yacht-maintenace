import { supabase } from "../lib/supabase"

type GroupMemberRow = { group_id: string }
type YachtGroupLinkRow = { yacht_id: string }

/**
 * Flat access model (canonical):
 * - user -> group_members(user_id, group_id)
 * - group -> yacht_group_links(group_id, yacht_id)
 *
 * No recursive parent_group resolution.
 */
export async function loadAccessibleYachtIds(userId: string): Promise<string[]> {
  const { data: memberships, error: mErr } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)

  if (mErr) throw mErr

  const groupIds = Array.from(
    new Set(((memberships as GroupMemberRow[]) ?? []).map((m) => m.group_id).filter(Boolean))
  )
  if (groupIds.length === 0) return []

  const { data: links, error: lErr } = await supabase
    .from("yacht_group_links")
    .select("yacht_id")
    .in("group_id", groupIds)

  if (lErr) throw lErr

  return Array.from(
    new Set(((links as YachtGroupLinkRow[]) ?? []).map((l) => l.yacht_id).filter(Boolean))
  )
}

