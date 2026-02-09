import { createClient } from "@supabase/supabase-js"

type Json = Record<string, any>

function send(res: any, status: number, body: Json) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(body))
}

function getBearerToken(req: any): string | null {
  const raw = (req.headers?.authorization || req.headers?.Authorization) as
    | string
    | undefined

  if (!raw) return null
  const m = raw.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() || null
}

async function findAuthUserIdByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string
): Promise<{ id: string; email?: string | null; user_metadata?: any } | null> {
  const target = email.trim().toLowerCase()
  if (!target) return null

  // Supabase Admin API doesn't provide a direct "get user by email",
  // so we scan listUsers pages (OK for small tenant sizes).
  const perPage = 200
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) return null

    const users = (data?.users ?? []) as any[]
    if (!users.length) return null

    const found = users.find(
      (u) => (u?.email ?? "").toString().toLowerCase() === target
    )
    if (found?.id) return found

    // If we got fewer than perPage, there are no more pages.
    if (users.length < perPage) return null
  }

  return null
}

async function requireCaller(
  supabaseAdmin: ReturnType<typeof createClient>,
  req: any
): Promise<{ id: string; email?: string | null } | null> {
  const token = getBearerToken(req)
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null

  const u = data?.user
  if (!u?.id) return null

  return { id: u.id, email: u.email }
}

async function requireGroupExists(
  supabaseAdmin: ReturnType<typeof createClient>,
  groupId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("groups")
    .select("id")
    .eq("id", groupId)
    .maybeSingle()

  if (error) return false
  return !!(data as any)?.id
}

async function isCallerAdmin(
  supabaseAdmin: ReturnType<typeof createClient>,
  callerUserId: string
): Promise<boolean> {
  // Authorization model (current DB): global "admin" role.
  // If roles are later removed/changed, this rule must be revisited explicitly.
  const { data, error } = await supabaseAdmin
    .from("user_role_links")
    .select("roles(name)")
    .eq("user_id", callerUserId)

  if (error) return false

  const rows = (data as any[]) ?? []
  return rows.some((r) => (r?.roles?.name ?? "").toString().toLowerCase() === "admin")
}

async function isCallerMemberOfGroup(
  supabaseAdmin: ReturnType<typeof createClient>,
  callerUserId: string,
  groupId: string
): Promise<"yes" | "no" | "error"> {
  // Prefer ULTRA terminology, fall back to legacy table name.
  {
    const { data, error } = await supabaseAdmin
      .from("group_users")
      .select("group_id")
      .eq("user_id", callerUserId)
      .eq("group_id", groupId)
      .limit(1)

    if (!error) return (data as any[])?.length ? "yes" : "no"
    if ((error as any)?.code !== "42P01") return "error"
  }

  {
    const { data, error } = await supabaseAdmin
      .from("user_group_links")
      .select("group_id")
      .eq("user_id", callerUserId)
      .eq("group_id", groupId)
      .limit(1)

    if (!error) return (data as any[])?.length ? "yes" : "no"
    if ((error as any)?.code !== "42P01") return "error"
  }

  return "error"
}

async function ensureMembership(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  groupId: string
): Promise<{ ok: true; table: "group_users" | "user_group_links" } | { ok: false; error: string }> {
  // Prefer ULTRA terminology, fall back to legacy table name.
  {
    const { error } = await supabaseAdmin.from("group_users").upsert(
      { user_id: userId, group_id: groupId },
      {
        onConflict: "user_id,group_id",
      }
    )
    if (!error) return { ok: true, table: "group_users" }
    if ((error as any)?.code !== "42P01") {
      return { ok: false, error: error.message }
    }
  }

  {
    const { error } = await supabaseAdmin.from("user_group_links").upsert(
      { user_id: userId, group_id: groupId },
      {
        onConflict: "user_id,group_id",
      }
    )
    if (!error) return { ok: true, table: "user_group_links" }
    if ((error as any)?.code !== "42P01") {
      return { ok: false, error: error.message }
    }
  }

  return {
    ok: false,
    error: "No membership table found (expected group_users or user_group_links).",
  }
}

export default async function handler(req: any, res: any) {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Safe diagnostics endpoint (does not leak values).
  if (req.method === "GET") {
    return send(res, 200, {
      ok: true,
      env: {
        supabaseUrlPresent: !!supabaseUrl,
        serviceRoleKeyPresent: !!serviceRoleKey,
      },
    })
  }

  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return send(res, 500, {
      error:
        "Server is missing SUPABASE_URL (or VITE_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY.",
      env: {
        supabaseUrlPresent: !!supabaseUrl,
        serviceRoleKeyPresent: !!serviceRoleKey,
      },
    })
  }

  let payload: {
    email?: string
    displayName?: string
    redirectTo?: string
    groupId?: string
  }
  try {
    payload =
      typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    return send(res, 400, { error: "Invalid JSON body" })
  }

  const email = (payload.email ?? "").trim()
  const displayName = (payload.displayName ?? "").trim()
  const requestedRedirectTo = (payload.redirectTo ?? "").trim() || undefined
  const groupId = (payload.groupId ?? "").trim()

  if (!email) {
    return send(res, 400, { error: "Email is required" })
  }
  if (!groupId) {
    return send(res, 400, { error: "groupId is required" })
  }

  // If caller didn't supply redirectTo, default to this request's origin.
  // This avoids Supabase falling back to a misconfigured localhost Site URL.
  const proto =
    (req.headers?.["x-forwarded-proto"] as string | undefined) || "https"
  const host =
    (req.headers?.["x-forwarded-host"] as string | undefined) ||
    (req.headers?.host as string | undefined)
  const origin = host ? `${proto}://${host}` : undefined

  const redirectTo = requestedRedirectTo || (origin ? `${origin}/desktop` : undefined)

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Enforce authn/authz for this admin endpoint.
  const caller = await requireCaller(supabaseAdmin, req)
  if (!caller?.id) {
    return send(res, 401, { error: "Unauthorized (missing/invalid bearer token)." })
  }

  const groupExists = await requireGroupExists(supabaseAdmin, groupId)
  if (!groupExists) {
    return send(res, 400, { error: "Invalid groupId (group does not exist)." })
  }

  const callerIsAdmin = await isCallerAdmin(supabaseAdmin, caller.id)
  if (!callerIsAdmin) {
    return send(res, 403, { error: "Forbidden (admin role required)." })
  }

  const member = await isCallerMemberOfGroup(supabaseAdmin, caller.id, groupId)
  if (member === "error") {
    return send(res, 500, { error: "Failed to verify caller group membership." })
  }
  if (member === "no") {
    return send(res, 403, { error: "Forbidden (not a member of target group)." })
  }

  // Invite user via Supabase Auth (sends email to set password).
  const { data: inviteData, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: displayName ? { display_name: displayName } : undefined,
      redirectTo,
    })

  let userId: string | undefined = inviteData?.user?.id
  let action: "invited" | "synced_existing" = "invited"

  if (inviteError) {
    // Common case: user already exists in Auth.
    const existing = await findAuthUserIdByEmail(supabaseAdmin, email)
    if (!existing?.id) {
      return send(res, 400, { error: inviteError.message })
    }

    userId = existing.id
    action = "synced_existing"
  }

  if (!userId) {
    return send(res, 500, { error: "No user id returned from Auth." })
  }

  // Keep a matching directory record in public.users (schema has users_id_fkey).
  const { error: upsertError } = await supabaseAdmin
    .from("users")
    .upsert(
      {
        id: userId,
        display_name: displayName || null,
        email,
      },
      { onConflict: "id" }
    )

  if (upsertError) {
    return send(res, 500, { error: upsertError.message })
  }

  // Create group membership for the invited user.
  const membership = await ensureMembership(supabaseAdmin, userId, groupId)
  if (!membership.ok) {
    return send(res, 500, { error: membership.error })
  }

  return send(res, 200, { userId, action, groupId, membershipTable: membership.table })
}

