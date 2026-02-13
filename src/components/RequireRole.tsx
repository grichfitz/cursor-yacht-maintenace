import React from "react"
import { Navigate } from "react-router-dom"
import { useMyRole, type AppRole } from "../hooks/useMyRole"

type RequireRoleProps = {
  allow: AppRole[]
  redirectTo?: string
  children: React.ReactNode
}

export default function RequireRole({
  allow,
  redirectTo = "/dashboard",
  children,
}: RequireRoleProps) {
  const { role, loading } = useMyRole()

  if (loading) return <div className="screen">Loading…</div>

  if (!allow.includes(role)) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}

