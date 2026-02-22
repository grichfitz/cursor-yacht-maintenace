import React from "react"

export type DetailTab<T extends string> = {
  id: T
  label: string
}

type DetailTabsProps<T extends string> = {
  tabs: DetailTab<T>[]
  active: T
  onChange: (tab: T) => void
}

export default function DetailTabs<T extends string>({ tabs, active, onChange }: DetailTabsProps<T>) {
  return (
    <div className="detail-tabs" role="tablist" aria-label="Detail tabs">
      {tabs.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`detail-tab ${isActive ? "active" : ""}`.trim()}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

