export type CategoryTreeRow = {
  id: string
  name: string
  parent_category_id: string | null
}

export type CategorySelectOption = {
  id: string
  depth: number
  label: string
}

function safeName(raw: unknown): string {
  const s = String(raw ?? "").trim()
  return s || "Unnamed category"
}

function formatPathLabel(byId: Map<string, CategoryTreeRow>, c: CategoryTreeRow): string {
  const parts: string[] = []
  const visited = new Set<string>()

  let cur: CategoryTreeRow | undefined = c
  let guard = 0
  while (cur && guard < 50) {
    guard++
    if (visited.has(cur.id)) break
    visited.add(cur.id)
    parts.push(safeName(cur.name))
    cur = cur.parent_category_id ? byId.get(cur.parent_category_id) : undefined
  }

  return parts.reverse().join(" › ")
}

/**
 * Order categories like a tree (depth-first, siblings by name).
 * Missing parent references are treated as roots.
 */
export function buildCategorySelectOptions(categories: CategoryTreeRow[]): CategorySelectOption[] {
  const rows = (categories ?? []).slice()
  const byId = new Map<string, CategoryTreeRow>()
  rows.forEach((c) => byId.set(c.id, c))

  const children = new Map<string, CategoryTreeRow[]>()
  const roots: CategoryTreeRow[] = []

  for (const c of rows) {
    const pid = c.parent_category_id
    const parentExists = pid ? byId.has(pid) : false
    if (!pid || !parentExists) {
      roots.push(c)
      continue
    }
    if (!children.has(pid)) children.set(pid, [])
    children.get(pid)!.push(c)
  }

  const byName = (a: CategoryTreeRow, b: CategoryTreeRow) => safeName(a.name).localeCompare(safeName(b.name))
  roots.sort(byName)
  for (const list of children.values()) list.sort(byName)

  const out: CategorySelectOption[] = []
  const visit = (c: CategoryTreeRow, depth: number) => {
    const path = formatPathLabel(byId, c)
    const indent = depth > 0 ? `${"↳ ".repeat(depth)}` : ""
    out.push({ id: c.id, depth, label: `${indent}${path}` })

    const kids = children.get(c.id) ?? []
    for (const k of kids) visit(k, depth + 1)
  }

  for (const r of roots) visit(r, 0)
  return out
}

