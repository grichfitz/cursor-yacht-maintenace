export type BadgeVariant =
  | "blue"
  | "teal"
  | "orange"
  | "purple"
  | "indigo"
  | "red"
  | "gray"

const VARIANTS: BadgeVariant[] = [
  "blue",
  "teal",
  "orange",
  "purple",
  "indigo",
  "red",
]

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

export function pickBadgeVariant(seed: string | null | undefined): BadgeVariant {
  const s = (seed ?? "").toString()
  if (!s) return "blue"
  const idx = hashString(s) % VARIANTS.length
  return VARIANTS[idx] ?? "blue"
}

