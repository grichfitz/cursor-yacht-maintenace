import React, { useMemo } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { CheckSquare, Folder, Ship, Tag, User } from "lucide-react"
import { useMyRole } from "../../hooks/useMyRole"

type Section = { label: string; to: string; match: (pathname: string) => boolean }

const sections: Section[] = [
  { label: "Yachts", to: "/editor/yachts", match: (p) => p.startsWith("/editor/yachts") },
  { label: "Groups", to: "/editor/groups", match: (p) => p.startsWith("/editor/groups") },
  { label: "Blueprint", to: "/editor/blueprint", match: (p) => p.startsWith("/editor/blueprint") },
  { label: "Assignments", to: "/editor/assignments", match: (p) => p.startsWith("/editor/assignments") },
  { label: "Users", to: "/users", match: (p) => p.startsWith("/users") },
]

export default function EditorNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { role } = useMyRole()

  const visibleSections = useMemo(() => {
    // Keep nav aligned with route guards:
    // - admin: full editor
    // - manager: groups + assignments
    // - crew: no editor nav (shouldn't reach here, but keep safe)
    if (role === "admin") return sections
    if (role === "manager") return sections.filter((s) => s.to === "/editor/groups" || s.to === "/editor/assignments")
    return []
  }, [role])

  const sectionTo = useMemo(() => {
    const match = visibleSections.find((s) => s.match(pathname))?.to
    if (match) return match
    return visibleSections[0]?.to ?? "/dashboard"
  }, [pathname, visibleSections])

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 10,
        marginTop: -6,
        alignItems: "center",
      }}
    >
      <button type="button" className="primary-button" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {role === "admin" ? (
        <button
          type="button"
          className="primary-button"
          aria-label="Editor · Yachts"
          title="Yachts"
          onClick={() => navigate("/editor/yachts")}
          style={{
            background:
              sectionTo === "/editor/yachts" ? "rgba(10, 132, 255, 0.14)" : "rgba(0, 0, 0, 0.06)",
            borderColor:
              sectionTo === "/editor/yachts" ? "rgba(10, 132, 255, 0.22)" : "rgba(0, 0, 0, 0.06)",
            width: 44,
            height: 34,
            padding: 0,
          }}
        >
          <Ship size={18} />
        </button>
        ) : null}

        {role === "admin" || role === "manager" ? (
        <button
          type="button"
          className="primary-button"
          aria-label="Editor · Groups"
          title="Groups"
          onClick={() => navigate("/editor/groups")}
          style={{
            background:
              sectionTo === "/editor/groups" ? "rgba(10, 132, 255, 0.14)" : "rgba(0, 0, 0, 0.06)",
            borderColor:
              sectionTo === "/editor/groups" ? "rgba(10, 132, 255, 0.22)" : "rgba(0, 0, 0, 0.06)",
            width: 44,
            height: 34,
            padding: 0,
          }}
        >
          <Folder size={18} />
        </button>
        ) : null}

        {role === "admin" ? (
          <button
            type="button"
            className="primary-button"
            aria-label="Editor · Blueprint"
            title="Blueprint"
            onClick={() => navigate("/editor/blueprint")}
            style={{
              background:
                sectionTo === "/editor/blueprint" ? "rgba(10, 132, 255, 0.14)" : "rgba(0, 0, 0, 0.06)",
              borderColor:
                sectionTo === "/editor/blueprint" ? "rgba(10, 132, 255, 0.22)" : "rgba(0, 0, 0, 0.06)",
              width: 44,
              height: 34,
              padding: 0,
            }}
          >
            <Tag size={18} />
          </button>
        ) : null}

        {role === "admin" || role === "manager" ? (
          <button
            type="button"
            className="primary-button"
            aria-label="Editor · Assignments"
            title="Assignments"
            onClick={() => navigate("/editor/assignments")}
            style={{
              background:
                sectionTo === "/editor/assignments" ? "rgba(10, 132, 255, 0.14)" : "rgba(0, 0, 0, 0.06)",
              borderColor:
                sectionTo === "/editor/assignments" ? "rgba(10, 132, 255, 0.22)" : "rgba(0, 0, 0, 0.06)",
              width: 44,
              height: 34,
              padding: 0,
            }}
          >
            <CheckSquare size={18} />
          </button>
        ) : null}

        {role === "admin" ? (
          <button
          type="button"
          className="primary-button"
          aria-label="Editor · Users"
          title="Users"
          onClick={() => navigate("/users")}
          style={{
            background:
              sectionTo === "/users" ? "rgba(10, 132, 255, 0.14)" : "rgba(0, 0, 0, 0.06)",
            borderColor:
              sectionTo === "/users" ? "rgba(10, 132, 255, 0.22)" : "rgba(0, 0, 0, 0.06)",
            width: 44,
            height: 34,
            padding: 0,
          }}
        >
          <User size={18} />
        </button>
        ) : null}
      </div>
    </div>
  )
}

