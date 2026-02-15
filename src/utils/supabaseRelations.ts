type SupabaseErrorLike = {
  message?: string
  code?: string
  status?: number
}

const STORAGE_KEY = "ym.missingRelations.v1"
const missingRelations = new Set<string>()

// Persist within a tab session to avoid re-spamming missing table 404s.
try {
  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (raw) {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      parsed.forEach((v) => {
        if (typeof v === "string" && v.trim()) missingRelations.add(v)
      })
    }
  }
} catch {
  // ignore
}

export function rememberMissingRelation(relation: string) {
  missingRelations.add(relation)
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(missingRelations.values())))
  } catch {
    // ignore
  }
}

export function isRelationKnownMissing(relation: string) {
  return missingRelations.has(relation)
}

export function isMissingRelationError(err: unknown) {
  const e = err as SupabaseErrorLike | null | undefined
  const msg = String(e?.message ?? "")
  const code = String(e?.code ?? "")
  const status = typeof e?.status === "number" ? e?.status : undefined

  return (
    code === "PGRST205" ||
    status === 404 ||
    msg.includes("Could not find the table") ||
    msg.toLowerCase().includes("schema cache")
  )
}
