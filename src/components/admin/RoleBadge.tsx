import React from "react"

export default function RoleBadge({ name }: { name: string }) {
  const n = String(name ?? "").toLowerCase()
  const cls =
    n === "admin" ? "role-admin"
    : n === "manager" ? "role-manager"
    : n === "crew" ? "role-crew"
    : n === "owner" ? "role-owner"
    : ""

  return <span className={`badge ${cls}`.trim()}>{name}</span>
}

