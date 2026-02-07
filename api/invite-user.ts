import { createClient } from "@supabase/supabase-js"

type Json = Record<string, any>

function send(res: any, status: number, body: Json) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(body))
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

  let payload: { email?: string; displayName?: string; redirectTo?: string }
  try {
    payload =
      typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    return send(res, 400, { error: "Invalid JSON body" })
  }

  const email = (payload.email ?? "").trim()
  const displayName = (payload.displayName ?? "").trim()
  const redirectTo = (payload.redirectTo ?? "").trim() || undefined

  if (!email) {
    return send(res, 400, { error: "Email is required" })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Invite user via Supabase Auth (sends email to set password).
  const { data: inviteData, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: displayName ? { display_name: displayName } : undefined,
      redirectTo,
    })

  if (inviteError) {
    return send(res, 400, { error: inviteError.message })
  }

  const invitedUserId = inviteData?.user?.id
  if (!invitedUserId) {
    return send(res, 500, { error: "Invite succeeded, but no user id returned." })
  }

  // Keep a matching directory record in public.users (schema has users_id_fkey).
  const { error: upsertError } = await supabaseAdmin
    .from("users")
    .upsert(
      {
        id: invitedUserId,
        display_name: displayName || null,
        email,
      },
      { onConflict: "id" }
    )

  if (upsertError) {
    return send(res, 500, { error: upsertError.message })
  }

  return send(res, 200, { userId: invitedUserId })
}

