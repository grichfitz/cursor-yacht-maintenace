import { supabase } from "../lib/supabase"

type GroupRow = { id: string; parent_group_id: string | null }

function toIdList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    // RPC returning SETOF uuid often comes back as string[]
    if (raw.every((x) => typeof x === "string")) return raw as string[]
    // Or array of objects like [{ id: "..." }] depending on SQL
    const ids = (raw as any[]).map((r) => String(r?.id ?? r?.group_id ?? "")).filter(Boolean)
    if (ids.length) return ids
  }
  return []
}

async function loadUserGroupIdsViaRpc(): Promise<string[] | null> {
  const { data, error } = await supabase.rpc("user_group_ids")
  if (error) return null
  return toIdList(data)
}

async function loadUserDirectGroupIds(userId: string): Promise<string[]> {
  const ids = new Set<string>()

  const [m1, m2] = await Promise.allSettled([
    supabase.from("group_memberships").select("group_id").eq("user_id", userId),
    supabase.from("group_members").select("group_id").eq("user_id", userId),
  ])

  if (m1.status === "fulfilled" && !m1.value.error) {
    ;((m1.value.data as any[]) ?? []).forEach((r) => {
      const gid = String(r?.group_id ?? "")
      if (gid) ids.add(gid)
    })
  }

  if (m2.status === "fulfilled" && !m2.value.error) {
    ;((m2.value.data as any[]) ?? []).forEach((r) => {
      const gid = String(r?.group_id ?? "")
      if (gid) ids.add(gid)
    })
  }

  return Array.from(ids)
}

async function loadAllGroupsMinimal(): Promise<GroupRow[]> {
  const { data, error } = await supabase.from("groups").select("id,parent_group_id").limit(10000)
  if (error) throw error
  return ((data as any[]) ?? []).map((r) => ({
    id: String(r.id),
    parent_group_id: (r.parent_group_id ?? null) as string | null,
  }))
}

function computeDescendants(all: GroupRow[], roots: string[]): string[] {
  const byParent = new Map<string, string[]>()
  for (const g of all) {
    const pid = g.parent_group_id
    if (!pid) continue
    const arr = byParent.get(pid) ?? []
    arr.push(g.id)
    byParent.set(pid, arr)
  }

  const out = new Set<string>()
  const stack = [...roots]
  while (stack.length) {
    const cur = stack.pop()!
    if (out.has(cur)) continue
    out.add(cur)
    const kids = byParent.get(cur) ?? []
    for (const k of kids) stack.push(k)
  }
  return Array.from(out)
}

/**
 * Returns the group IDs the current user can manage, including descendants ("this group and down").
 *
 * Strategy:
 * - Prefer server-side `user_group_ids()` RPC (authoritative, recursive).
 * - Fallback: read direct memberships and compute descendants client-side.
 */
export async function loadManagerScopeGroupIds(userId: string): Promise<string[]> {
  const rpcIds = await loadUserGroupIdsViaRpc()
  if (rpcIds && rpcIds.length > 0) return Array.from(new Set(rpcIds.filter(Boolean)))

  const direct = await loadUserDirectGroupIds(userId)
  if (direct.length === 0) return []

  const all = await loadAllGroupsMinimal()
  return computeDescendants(all, direct)
}

