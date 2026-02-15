export type GroupTreeRow = {
  id: string
  name: string
  parent_group_id: string | null
}

export type GroupSelectOption = {
  id: string
  depth: number
  label: string
}

function safeName(raw: unknown): string {
  const s = String(raw ?? "").trim()
  return s || "Unnamed group"
}

function formatPathLabel(byId: Map<string, GroupTreeRow>, g: GroupTreeRow): string {
  const parts: string[] = []
  const visited = new Set<string>()

  let cur: GroupTreeRow | undefined = g
  let guard = 0
  while (cur && guard < 50) {
    guard++
    if (visited.has(cur.id)) break
    visited.add(cur.id)
    parts.push(safeName(cur.name))
    cur = cur.parent_group_id ? byId.get(cur.parent_group_id) : undefined
  }

  return parts.reverse().join(" › ")
}

/**
 * Order groups like a tree (depth-first, siblings by name).
 * Missing parent references are treated as roots.
 */
export function buildGroupParentSelectOptions(groups: GroupTreeRow[]): GroupSelectOption[] {
  const rows = (groups ?? []).slice()
  const byId = new Map<string, GroupTreeRow>()
  rows.forEach((g) => byId.set(g.id, g))

  const children = new Map<string, GroupTreeRow[]>()
  const roots: GroupTreeRow[] = []

  for (const g of rows) {
    const pid = g.parent_group_id
    const parentExists = pid ? byId.has(pid) : false
    if (!pid || !parentExists) {
      roots.push(g)
      continue
    }
    if (!children.has(pid)) children.set(pid, [])
    children.get(pid)!.push(g)
  }

  const byName = (a: GroupTreeRow, b: GroupTreeRow) => safeName(a.name).localeCompare(safeName(b.name))
  roots.sort(byName)
  for (const list of children.values()) list.sort(byName)

  const out: GroupSelectOption[] = []
  const visit = (g: GroupTreeRow, depth: number) => {
    const path = formatPathLabel(byId, g)
    const indent = depth > 0 ? `${"↳ ".repeat(depth)}` : ""
    out.push({ id: g.id, depth, label: `${indent}${path}` })

    const kids = children.get(g.id) ?? []
    for (const k of kids) visit(k, depth + 1)
  }

  for (const r of roots) visit(r, 0)
  return out
}

