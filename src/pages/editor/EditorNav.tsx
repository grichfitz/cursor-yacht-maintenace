import React from "react"
import { useLocation, useNavigate } from "react-router-dom"

type Item = { label: string; to: string }

const items: Item[] = [
  { label: "Yachts", to: "/editor/yachts" },
  { label: "Groups", to: "/editor/groups" },
  { label: "Categories", to: "/editor/categories" },
  { label: "Tasks", to: "/editor/task-templates" },
]

export default function EditorNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 10,
        marginTop: -6,
      }}
    >
      <button type="button" className="primary-button" onClick={() => navigate(-1)}>
        ← Back
      </button>

      {items.map((i) => {
        const active = pathname.startsWith(i.to)
        return (
          <button
            key={i.to}
            type="button"
            className="primary-button"
            onClick={() => navigate(i.to)}
            style={{
              background: active ? "rgba(10, 132, 255, 0.14)" : "rgba(0, 0, 0, 0.06)",
              borderColor: active ? "rgba(10, 132, 255, 0.22)" : "rgba(0, 0, 0, 0.06)",
              color: "var(--text-primary)",
            }}
          >
            {i.label}
          </button>
        )
      })}
    </div>
  )
}

