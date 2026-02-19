export function parseOptionalJson(raw: string): { ok: true; value: any } | { ok: false; error: string } {
  const s = String(raw ?? "").trim()
  if (!s) return { ok: true, value: null }
  try {
    return { ok: true, value: JSON.parse(s) }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Invalid JSON." }
  }
}

export function stringifyJsonForEdit(value: unknown): string {
  if (value == null) return ""
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ""
  }
}

